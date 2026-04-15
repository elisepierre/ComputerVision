import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");

let handLandmarker;
let GE;
let score = 0;

// 1. Initialisation des modèles
async function loadModels() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { 
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU" 
        },
        runningMode: "VIDEO", numHands: 1
    });

    // Configuration Fingerpose
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

    document.getElementById("status-bar").innerText = "Ready to go!";
}
loadModels();

// 2. La boucle de détection (Version Stable)
async function runDetection() {
    if (!handLandmarker || video.paused || video.readyState < 2) return;

    // On synchronise les tailles
    canvasElement.width = video.clientWidth;
    canvasElement.height = video.clientHeight;

    // Détection
    const results = await handLandmarker.detectForVideo(video, performance.now());
    
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // DESSIN DES POINTS
        canvasCtx.fillStyle = "white";
        for (const point of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 4, 0, 2 * Math.PI);
            canvasCtx.fill();
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

// 3. Démarrage
document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    // Résolution équilibrée pour éviter le lag
    const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
    });
    video.srcObject = stream;
    video.play();
    
    // ON REPREND LE SETINTERVAL QUI MARCHAIT
    // On le règle à 30ms pour supprimer le délai visuel
    setInterval(runDetection, 30);
    
    document.getElementById("enableWebcamButton").style.display = "none";
});
