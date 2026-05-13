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

// --- 2. CHARGEMENT DU DATASET (L'Alphabet) ---
async function loadReferences() {
    try {
        const response = await fetch('reference_signs.json');
        myReferenceDataset = await response.json();
        statusBar.innerText = "✅ Alphabet chargé (A-Y, 0-9)";
        console.log("Dataset prêt avec", Object.keys(myReferenceDataset).length, "signes.");
    } catch (err) {
        statusBar.innerText = "❌ Erreur de chargement du dataset JSON";
        console.error(err);
    }
}

// --- 3. MOTEUR DE COMPARAISON (MATCHING) ---
function calculateDistance(hand1, hand2) {
    let totalDist = 0;
    for (let i = 0; i < 21; i++) {
        // Normalisation : on soustrait le poignet (point 0) 
        // pour comparer la FORME et non la POSITION
        const dx1 = hand1[i].x - hand1[0].x;
        const dy1 = hand1[i].y - hand1[0].y;
        const dx2 = hand2[i].x - hand2[0].x;
        const dy2 = hand2[i].y - hand2[0].y;
        
        totalDist += Math.hypot(dx1 - dx2, dy1 - dy2);
    }
    return totalDist;
}

// --- 4. INITIALISATION MEDIAPIPE ---
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

// --- 5. BOUCLE DE PRÉDICTION ---
async function predict() {
    if (video.readyState >= 2 && handLandmarker) {
        // Ajustement dynamique du canvas
        if (canvasElement.width !== video.videoWidth) {
            canvasElement.width = video.videoWidth;
            canvasElement.height = video.videoHeight;
        }

        const results = await handLandmarker.detectForVideo(video, performance.now());
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const currentHand = results.landmarks[0];
            drawHand(currentHand);

            const target = targetWordEl.innerText.toUpperCase();
            const reference = myReferenceDataset[target];

            if (reference && canValidate) {
                const diff = calculateDistance(currentHand, reference);
                
                // SEUIL : 0.5 - 0.7 est généralement le "sweet spot"
                // Plus c'est petit, plus c'est difficile.
                if (diff < 0.65) {
                    handleSuccess();
                }
            }
        }
    }
    window.requestAnimationFrame(predict);
}

// --- 6. GESTION DU SUCCÈS ---
function handleSuccess() {
    canValidate = false;
    score++;
    scoreEl.innerText = score;
    
    // Feedback visuel
    document.querySelector('.app-container').classList.add('success-flash');
    document.getElementById("feedback-pop").style.display = "block";
    
    setTimeout(() => {
        document.getElementById("feedback-pop").style.display = "none";
        document.querySelector('.app-container').classList.remove('success-flash');
        
        // Choisir une nouvelle lettre au hasard dans ton dataset
        const signs = Object.keys(myReferenceDataset);
        targetWordEl.innerText = signs[Math.floor(Math.random() * signs.length)];
        canValidate = true;
    }, 1500);
}

// --- UTILS : DESSIN & WEBCAM ---
function drawHand(landmarks) {
    const w = canvasElement.width;
    const h = canvasElement.height;
    canvasCtx.strokeStyle = "#8a2be2";
    canvasCtx.lineWidth = 5;
    
    // On peut ajouter ici les connexions si tu veux un squelette complet
    landmarks.forEach(p => {
        canvasCtx.beginPath();
        canvasCtx.arc(p.x * w, p.y * h, 4, 0, 2 * Math.PI);
        canvasCtx.fillStyle = "white";
        canvasCtx.fill();
    });
}

document.getElementById("enableWebcamButton").onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    video.srcObject = stream;
    video.play();
    predict();
    document.getElementById("enableWebcamButton").style.display = "none";
};

// Gestion Gemini Help
document.getElementById("help-btn").onclick = async () => {
    if (!aiModel) {
        alert("Configure ta clé API dans les réglages !");
        return;
    }
    const currentWord = targetWordEl.innerText;
    statusBar.innerText = "Consultation du prof Gemini...";
    
    const prompt = `Explain in 2 very short sentences how to do the ASL sign for letter "${currentWord}". Focus on fingers position.`;
    try {
        const result = await aiModel.generateContent(prompt);
        alert(result.response.text());
        statusBar.innerText = "Conseil reçu !";
    } catch (e) {
        statusBar.innerText = "Erreur quota API (429).";
    }
};
