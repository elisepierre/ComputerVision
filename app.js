import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const statusBar = document.getElementById("status-bar");
const scoreEl = document.getElementById("score");

let handLandmarker;
let GE;
let score = 0;

// 1. Initialisation des Gestes
const initGestures = () => {
    GE = new fp.GestureEstimator([
        fp.Gestures.VictoryGesture,
        fp.Gestures.ThumbsUpGesture,
    ]);
    const hello = new fp.GestureDescription('HELLO');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        hello.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    hello.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
    GE.addGesture(hello);
};

// 2. Chargement des modèles
async function loadModels() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { 
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU" 
        },
        runningMode: "VIDEO", numHands: 1
    });
    initGestures();
    statusBar.innerText = "Models Loaded. Ready!";
}
loadModels();

// 3. Boucle de détection forcée
async function runDetection() {
    if (!handLandmarker || video.paused || video.readyState < 2) return;

    // Ajuster le canvas à la taille AFFICHÉE de la vidéo
    canvasElement.width = video.clientWidth;
    canvasElement.height = video.clientHeight;

    const results = await handLandmarker.detectForVideo(video, performance.now());
    
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // DESSIN DES POINTS BLANCS
        canvasCtx.fillStyle = "white";
        canvasCtx.strokeStyle = "black";
        for (const point of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 4, 0, 2 * Math.PI);
            canvasCtx.fill();
            canvasCtx.stroke();
        }

        // RECONNAISSANCE
        const pixelLandmarks = landmarks.map(l => [l.x * canvasElement.width, l.y * canvasElement.height, l.z]);
        const estimated = await GE.estimate(pixelLandmarks, 7.5);
        
        if (estimated.gestures.length > 0) {
            const best = estimated.gestures.reduce((p, c) => (p.score > c.score) ? p : c);
            if (best.name.toUpperCase() === targetWordEl.innerText) {
                handleSuccess();
            }
        }
    }
}

function handleSuccess() {
    score++;
    scoreEl.innerText = score;
    const pop = document.getElementById("feedback-pop");
    pop.style.display = "block";
    setTimeout(() => { 
        pop.style.display = "none";
        const words = ["HELLO", "VICTORY", "THUMBS_UP"];
        targetWordEl.innerText = words[Math.floor(Math.random() * words.length)];
    }, 1000);
}

// 4. Démarrage
document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
    });
    video.srcObject = stream;
    video.play();
    
    // On lance la boucle toutes le 40ms (25 images/sec) - Très stable
    setInterval(runDetection, 40);
    
    document.getElementById("enableWebcamButton").style.display = "none";
    statusBar.innerText = "Analysis Running...";
});
