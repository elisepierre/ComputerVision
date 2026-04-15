import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");

let handLandmarker;
let GE;
let score = 0;
let isProcessing = false; // Verrou anti-lag

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

async function loadModels() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { 
            // ON UTILISE LE MODÈLE LITE POUR PLUS DE VITESSE
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU" 
        },
        runningMode: "VIDEO",
        numHands: 1,
        // OPTIMISATION : On baisse la confiance minimale pour gagner en vitesse
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5
    });
    initGestures();
    document.getElementById("status-bar").innerText = "Turbo Mode Ready!";
}
loadModels();

async function renderLoop() {
    if (!handLandmarker || video.paused || video.readyState < 2) {
        window.requestAnimationFrame(renderLoop);
        return;
    }

    // Si l'IA est déjà en train de calculer la frame précédente, on saute celle-ci
    if (!isProcessing) {
        isProcessing = true;
        
        canvasElement.width = video.clientWidth;
        canvasElement.height = video.clientHeight;

        const results = await handLandmarker.detectForVideo(video, performance.now());
        
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // Dessin rapide
            drawHand(landmarks);

            // Reconnaissance (on ne le fait que si nécessaire pour économiser le CPU)
            const pixelLandmarks = landmarks.map(l => [l.x * canvasElement.width, l.y * canvasElement.height, l.z]);
            const estimated = await GE.estimate(pixelLandmarks, 7.5);
            
            if (estimated.gestures.length > 0) {
                const best = estimated.gestures.reduce((p, c) => (p.score > c.score) ? p : c);
                if (best.name.toUpperCase() === targetWordEl.innerText) {
                    handleSuccess();
                }
            }
        }
        isProcessing = false;
    }

    window.requestAnimationFrame(renderLoop);
}

function drawHand(landmarks) {
    canvasCtx.fillStyle = "white";
    for (const point of landmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 3, 0, 2 * Math.PI);
        canvasCtx.fill();
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

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    // OPTIMISATION : On demande une résolution plus petite pour la caméra
    const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 480, height: 360, frameRate: 30 } 
    });
    video.srcObject = stream;
    video.play();
    renderLoop();
    document.getElementById("enableWebcamButton").style.display = "none";
});
