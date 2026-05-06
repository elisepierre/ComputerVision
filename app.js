import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");

let handLandmarker;
let score = 0;
let canValidate = true;

// --- BASE DE DONNÉES SÉCURISÉE ---
const ASL_DATABASE = {
    "GOODBYE": (lm) => {
        if (!lm[8] || !lm[12] || !lm[16] || !lm[20] || !lm[4]) return false;
        const allUp = lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y;
        const thumbOut = Math.abs(lm[4].x - lm[5].x) > 0.1;
        return allUp && thumbOut;
    },
    "HELLO": (lm) => {
        if (!lm[8] || !lm[12]) return false;
        const fingersTogether = Math.abs(lm[8].x - lm[12].x) < 0.03;
        const up = lm[8].y < lm[6].y && lm[12].y < lm[10].y;
        return fingersTogether && up;
    }
};

const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12], [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20]
];

async function init() {
    try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        statusBar.innerText = "System Ready";
    } catch (e) {
        statusBar.innerText = "Error loading AI";
    }
}
init();

async function predict() {
    if (video.readyState >= 2 && handLandmarker) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;

        const results = await handLandmarker.detectForVideo(video, performance.now());
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // 1. DESSINER LE SQUELETTE (Indépendant de la validation)
            drawHand(landmarks);

            // 2. TENTER LA VALIDATION (Dans un bloc sécurisé)
            try {
                const currentTarget = targetWordEl.innerText.toUpperCase();
                if (ASL_DATABASE[currentTarget] && ASL_DATABASE[currentTarget](landmarks)) {
                    if (canValidate) handleSuccess();
                }
            } catch (err) {
                console.log("Validation skip");
            }
        }
    }
    // Relance TOUJOURS la boucle
    window.requestAnimationFrame(predict);
}

function drawHand(landmarks) {
    const w = canvasElement.width;
    const h = canvasElement.height;

    // Traits
    canvasCtx.strokeStyle = "#8a2be2";
    canvasCtx.lineWidth = 4;
    canvasCtx.lineCap = "round";
    HAND_CONNECTIONS.forEach(([s, e]) => {
        if (landmarks[s] && landmarks[e]) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(landmarks[s].x * w, landmarks[s].y * h);
            canvasCtx.lineTo(landmarks[e].x * w, landmarks[e].y * h);
            canvasCtx.stroke();
        }
    });

    // Points
    canvasCtx.fillStyle = "white";
    landmarks.forEach(p => {
        canvasCtx.beginPath();
        canvasCtx.arc(p.x * w, p.y * h, 4, 0, 2 * Math.PI);
        canvasCtx.fill();
    });
}

function handleSuccess() {
    canValidate = false;
    score++;
    scoreEl.innerText = score;
    document.getElementById("feedback-pop").style.display = "block";
    setTimeout(() => {
        document.getElementById("feedback-pop").style.display = "none";
        // Change de mot
        const words = Object.keys(ASL_DATABASE);
        targetWordEl.innerText = words[Math.floor(Math.random() * words.length)];
        canValidate = true;
    }, 2000);
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    predict();
    document.getElementById("enableWebcamButton").style.display = "none";
});
