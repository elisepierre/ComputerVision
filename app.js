import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");

let handLandmarker;
let score = 0;
let canValidate = true;

// --- DATABASE DES SIGNES (Logique Professionnelle) ---
const ASL_DATABASE = {
    "HELLO": (lm) => {
        // Paume face, doigts serrés vers le haut
        return lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y && Math.abs(landmarks[8].x - landmarks[12].x) < 0.05;
    },
    "GOODBYE": (lm) => {
        // Main ouverte, doigts écartés
        return lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y && Math.abs(landmarks[4].x - landmarks[8].x) > 0.1;
    },
    "THANK YOU": (lm) => {
        // Main plate, inclinée vers l'avant (Z-axis)
        return lm[8].y < lm[6].y && lm[8].z < lm[0].z - 0.1;
    }
};

// --- INITIALISATION ---
async function init() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
}
init();

const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20]];

// --- BOUCLE DE DÉTECTION ---
async function predict() {
    if (video.readyState >= 2) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        const results = await handLandmarker.detectForVideo(video, performance.now());
        
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            drawSkeleton(landmarks);

            // LOGIQUE DE RECONNAISSANCE VIA DATABASE
            const currentTarget = targetWordEl.innerText.toUpperCase();
            
            // On appelle la fonction correspondante dans notre BDD
            if (ASL_DATABASE[currentTarget] && ASL_DATABASE[currentTarget](landmarks)) {
                if (canValidate) handleSuccess();
            }
        }
    }
    window.requestAnimationFrame(predict);
}

function drawSkeleton(landmarks) {
    const width = canvasElement.width;
    const height = canvasElement.height;

    // Traits
    canvasCtx.strokeStyle = "#8a2be2";
    canvasCtx.lineWidth = 3;
    HAND_CONNECTIONS.forEach(([s, e]) => {
        canvasCtx.beginPath();
        canvasCtx.moveTo(landmarks[s].x * width, landmarks[s].y * height);
        canvasCtx.lineTo(landmarks[e].x * width, landmarks[e].y * height);
        canvasCtx.stroke();
    });

    // Points
    canvasCtx.fillStyle = "white";
    landmarks.forEach(p => {
        canvasCtx.beginPath();
        canvasCtx.arc(p.x * width, p.y * height, 4, 0, 2 * Math.PI);
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
        // Sélection aléatoire d'un nouveau signe dans la DATABASE
        const keys = Object.keys(ASL_DATABASE);
        targetWordEl.innerText = keys[Math.floor(Math.random() * keys.length)];
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
