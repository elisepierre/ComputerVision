import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// --- ÉLÉMENTS UI ---
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");

let handLandmarker;
let score = 0;
let canValidate = true;
let myReferenceDataset = {};

// --- 1. CONFIGURATION GEMINI ---
let API_KEY = localStorage.getItem("GEMINI_STUDENT_KEY");
let genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
let aiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" }) : null;

// --- 2. CHARGEMENT DU DATASET ---
async function loadReferences() {
    try {
        const response = await fetch('reference_signs.json');
        myReferenceDataset = await response.json();
        statusBar.innerText = "✅ Dataset chargé. Prêt pour le test !";
    } catch (err) {
        statusBar.innerText = "❌ Erreur : reference_signs.json introuvable.";
    }
}

// --- 3. MATHS : DISTANCE EUCLIDIENNE ---
function calculateDistance(hand1, hand2) {
    let totalDist = 0;
    for (let i = 0; i < 21; i++) {
        const dx1 = hand1[i].x - hand1[0].x;
        const dy1 = hand1[i].y - hand1[0].y;
        const dx2 = hand2[i].x - hand2[0].x;
        const dy2 = hand2[i].y - hand2[0].y;
        totalDist += Math.hypot(dx1 - dx2, dy1 - dy2);
    }
    return totalDist;
}

// --- 4. INITIALISATION ---
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
    loadReferences();
}
init();

// --- 5. LOGIQUE DE DESSIN (Squelette Violet) ---
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],       // Pouce
    [0, 5], [5, 6], [6, 7], [7, 8],       // Index
    [0, 9], [9, 10], [10, 11], [11, 12],  // Majeur
    [0, 13], [13, 14], [14, 15], [15, 16], // Annulaire
    [0, 17], [17, 18], [18, 19], [19, 20], // Auriculaire
    [5, 9], [9, 13], [13, 17]             // Paume
];

function drawStyledHand(landmarks) {
    const w = canvasElement.width;
    const h = canvasElement.height;

    // 1. Dessiner les traits violets
    canvasCtx.strokeStyle = "#8a2be2";
    canvasCtx.lineWidth = 4;
    canvasCtx.lineCap = "round";

    HAND_CONNECTIONS.forEach(([start, end]) => {
        canvasCtx.beginPath();
        canvasCtx.moveTo(landmarks[start].x * w, landmarks[start].y * h);
        canvasCtx.lineTo(landmarks[end].x * w, landmarks[end].y * h);
        canvasCtx.stroke();
    });

    // 2. Dessiner les points
    landmarks.forEach(p => {
        canvasCtx.beginPath();
        canvasCtx.arc(p.x * w, p.y * h, 5, 0, 2 * Math.PI);
        canvasCtx.fillStyle = "white";
        canvasCtx.fill();
    });
}

// --- 6. PRÉDICTION & VALIDATION ---
async function predict() {
    if (video.readyState >= 2 && handLandmarker) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;

        const results = await handLandmarker.detectForVideo(video, performance.now());
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const currentHand = results.landmarks[0];
            drawStyledHand(currentHand);

            const target = targetWordEl.innerText.toUpperCase();
            const reference = myReferenceDataset[target];

            if (reference && canValidate) {
                const diff = calculateDistance(currentHand, reference);
                
                // Feedback en temps réel dans la barre de statut
                if (diff < 0.65) {
                    statusBar.innerText = "✨ C'est presque ça ! Garde la pose...";
                    handleSuccess();
                } else if (diff < 1.2) {
                    statusBar.innerText = "⚡ Pas mal, ajuste encore un peu.";
                } else {
                    statusBar.innerText = "❌ Pas encore... regarde l'aide (?)";
                }
            }
        }
    }
    window.requestAnimationFrame(predict);
}

function handleSuccess() {
    canValidate = false;
    score++;
    scoreEl.innerText = score;
    
    document.getElementById("feedback-pop").innerText = "BIEN ! ✨";
    document.getElementById("feedback-pop").style.display = "block";
    
    setTimeout(() => {
        document.getElementById("feedback-pop").style.display = "none";
        const signs = Object.keys(myReferenceDataset);
        targetWordEl.innerText = signs[Math.floor(Math.random() * signs.length)];
        canValidate = true;
    }, 2000);
}

// --- 7. ACTIVATION WEBCAM ---
document.getElementById("enableWebcamButton").onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            predict(); // On lance la boucle seulement quand la vidéo est prête
            document.getElementById("enableWebcamButton").innerText = "Webcam Active ✅";
            document.getElementById("enableWebcamButton").disabled = true;
        };
    } catch (err) {
        alert("Erreur webcam : " + err.message);
    }
};
