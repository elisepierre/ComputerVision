import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");

let handLandmarker = undefined;
let score = 0;
let buffer = [];
const SEQ_LENGTH = 30;

// --- DATABASE DE 15 SIGNES (LOGIQUE SIMPLIFIÉE) ---
const ASL_DICTIONARY = ["HELLO", "THANKS", "SORRY", "PLEASE", "DRINK", "EAT", "YES", "NO", "HELP", "MORE", "WASH", "BOOK", "PLAY", "STOP", "LOVE"];
let currentTarget = ASL_DICTIONARY[0];

// 1. Initialisation MediaPipe
async function init() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { 
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU" 
        },
        runningMode: "VIDEO", numHands: 1
    });
}
init();

// 2. Lancement Caméra
document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
    document.getElementById("enableWebcamButton").style.display = "none";
});

async function predictWebcam() {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    const results = await handLandmarker.detectForVideo(video, performance.now());

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Miroir pour le dessin des points
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        drawConnectors(landmarks); // Fonction de dessin

        // --- LOGIQUE DE RECONNAISSANCE ---
        // On extrait le mouvement (y du bout de l'index)
        const indexTipY = landmarks[8].y;
        const wristY = landmarks[0].y;

        // Exemple simplifié : Si l'index monte au dessus du poignet pour HELLO
        if (currentTarget === "HELLO" && indexTipY < wristY - 0.2) {
            validateSign();
        }
    }
    canvasCtx.restore();
    window.requestAnimationFrame(predictWebcam);
}

function validateSign() {
    score++;
    scoreEl.innerText = score;
    // Animation Flash
    document.body.style.backgroundColor = "#004433";
    setTimeout(() => document.body.style.backgroundColor = "#1e1e2f", 500);
    
    // Prochain mot
    currentTarget = ASL_DICTIONARY[Math.floor(Math.random() * ASL_DICTIONARY.length)];
    targetWordEl.innerText = currentTarget;
}

function drawConnectors(landmarks) {
    for (let point of landmarks) {
        canvasCtx.fillStyle = "#00ffcc";
        canvasCtx.beginPath();
        canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 4, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}
