import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// --- ELEMENTS ---
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");

// Modals
const settingsModal = document.getElementById("settings-modal");
const helpModal = document.getElementById("help-modal");
const helpText = document.getElementById("help-text");

let handLandmarker;
let score = 0;
let canValidate = true;

// --- 1. CONFIGURATION AI (GEMINI) ---
let API_KEY = localStorage.getItem("GEMINI_STUDENT_KEY");
let genAI = null;
let aiModel = null;

if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
    aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

async function getAIInstruction(word) {
    if (!aiModel) return "Please set your API Key in Settings (⚙️) to see AI tips!";
    const prompt = `Explain in 2 short sentences how to do the ASL sign for "${word}". Focus on hand shape.`;
    try {
        const result = await aiModel.generateContent(prompt);
        return result.response.text();
    } catch (e) {
        return "Error connecting to Gemini. Check your API Key.";
    }
}

// --- 2. GESTION DES BOUTONS & INTERFACE ---

// Settings
document.getElementById("open-settings").onclick = () => settingsModal.style.display = "flex";
document.getElementById("close-settings").onclick = () => settingsModal.style.display = "none";
document.getElementById("save-settings").onclick = () => {
    const newKey = document.getElementById("api-key-input").value.trim();
    if (newKey) {
        localStorage.setItem("GEMINI_STUDENT_KEY", newKey);
        alert("Key saved! Refreshing...");
        location.reload();
    }
};

// Help AI (?)
document.getElementById("help-btn").onclick = async () => {
    const currentWord = targetWordEl.innerText;
    helpModal.style.display = "flex";
    helpText.innerText = "Consulting Gemini AI teacher... 🧠✨";
    const advice = await getAIInstruction(currentWord);
    helpText.innerText = advice;
};

document.querySelector(".close-help").onclick = () => helpModal.style.display = "none";

// Fermeture globale des modales
window.onclick = (event) => {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.style.display = "none";
    }
};

// --- 3. BASE DE DONNÉES ASL ---
const ASL_DATABASE = {
    "GOODBYE": (lm) => lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y && Math.abs(lm[4].x - lm[5].x) > 0.1,
    "HELLO": (lm) => Math.abs(lm[8].x - lm[12].x) < 0.03 && lm[8].y < lm[6].y && lm[12].y < lm[10].y,
    "I LOVE YOU": (lm) => lm[8].y < lm[6].y && lm[20].y < lm[18].y && lm[4].x < lm[2].x && lm[12].y > lm[10].y && lm[16].y > lm[14].y,
    "NO": (lm) => Math.hypot(lm[8].x - lm[4].x, lm[8].y - lm[4].y) < 0.05 && lm[16].y > lm[14].y,
    "YES": (lm) => lm[8].y > lm[6].y && lm[12].y > lm[10].y && lm[16].y > lm[14].y && lm[20].y > lm[18].y,
    "OK": (lm) => Math.hypot(lm[8].x - lm[4].x, lm[8].y - lm[4].y) < 0.05 && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y,
    "PLEASE": (lm) => lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[4].z > -0.05,
    "THANKS": (lm) => lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[0].z - lm[8].z > 0.1,
    "STOP": (lm) => lm[8].y < lm[6].y && lm[12].y < lm[10].y && Math.abs(lm[8].x - lm[20].x) < 0.15,
    "PEACE": (lm) => lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y > lm[14].y && lm[20].y > lm[18].y
};

const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20]];

// --- 4. ENGINE MEDIAPIPE ---
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
            drawHand(landmarks);
            try {
                const currentTarget = targetWordEl.innerText.toUpperCase();
                if (ASL_DATABASE[currentTarget] && ASL_DATABASE[currentTarget](landmarks)) {
                    if (canValidate) handleSuccess();
                }
            } catch (err) { console.log("Validation skip"); }
        }
    }
    window.requestAnimationFrame(predict);
}

function drawHand(landmarks) {
    const w = canvasElement.width;
    const h = canvasElement.height;
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
    document.querySelector('.app-container').classList.add('success-flash');
    document.getElementById("feedback-pop").style.display = "block";
    setTimeout(() => {
        document.getElementById("feedback-pop").style.display = "none";
        document.querySelector('.app-container').classList.remove('success-flash');
        const signs = Object.keys(ASL_DATABASE);
        targetWordEl.innerText = signs[Math.floor(Math.random() * signs.length)];
        canValidate = true;
    }, 1500);
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    predict();
    document.getElementById("enableWebcamButton").style.display = "none";
});
