import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// --- ÉLÉMENTS UI ---
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");
const settingsBtn = document.getElementById("open-settings");
const settingsModal = document.getElementById("settings-modal");
const saveSettingsBtn = document.getElementById("save-settings");
const apiKeyInput = document.getElementById("api-key-input");
const helpBtn = document.getElementById("help-btn");
const helpModal = document.getElementById("help-modal");
const helpText = document.getElementById("help-text");

let handLandmarker;
let score = 0;
let canValidate = true;
let myReferenceDataset = {};

// --- 1. CONFIGURATION GEMINI ---
let API_KEY = localStorage.getItem("GEMINI_API_KEY");
let genAI = null;
let aiModel = null;

function setupAI() {
    API_KEY = localStorage.getItem("GEMINI_API_KEY");
    if (API_KEY) {
        try {
            genAI = new GoogleGenerativeAI(API_KEY);
            // Utilise "gemini-2.0-flash" (la plus rapide et performante pour ton projet)
            aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            console.log("🤖 Gemini 2.5 Flash est prêt !");
        } catch (e) {
            console.error("Erreur setup AI:", e);
        }
    }
}
// On appelle setupAI après l'avoir définie
setupAI();

// --- 2. CHARGEMENT DU DATASET ---
async function loadReferences() {
    try {
        const response = await fetch('reference_signs.json');
        myReferenceDataset = await response.json();
        
        const signs = Object.keys(myReferenceDataset);
        console.log("Dataset prêt avec", signs.length, "signes.");

        if (signs.length > 0 && targetWordEl) {
            const firstSign = signs[Math.floor(Math.random() * signs.length)];
            targetWordEl.innerText = firstSign;
            statusBar.innerText = "✅ Prêt ! Fais le signe : " + firstSign;
        }
    } catch (err) {
        statusBar.innerText = "❌ Erreur de chargement du dataset JSON";
        console.error(err);
    }
}

// --- 3. ÉVÉNEMENTS (MODALES & BOUTONS) ---
settingsBtn.onclick = () => {
    settingsModal.style.display = "flex";
    if (API_KEY) apiKeyInput.value = API_KEY;
};

saveSettingsBtn.onclick = () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem("GEMINI_API_KEY", key);
        setupAI(); 
        settingsModal.style.display = "none";
        statusBar.innerText = "✅ Clé API enregistrée !";
    }
};

document.getElementById("close-settings").onclick = () => {
    settingsModal.style.display = "none";
};

helpBtn.onclick = async () => {
    if (!aiModel) {
        statusBar.innerText = "❌ Configure ta clé API d'abord ! (⚙️)";
        settingsModal.style.display = "flex";
        return;
    }

    const currentLetter = targetWordEl.innerText;
    helpText.innerText = "Le prof Gemini réfléchit... 🧠";
    helpModal.style.display = "flex";

    // On force Gemini à être un prof de langue des signes
    const prompt = `Tu es un expert en langue des signes. En une seule phrase courte, explique comment placer les doigts pour la lettre '${currentLetter}' en ASL.`;

    try {
        // Ajoute "generateContent" avec une gestion d'erreur plus précise
        const result = await aiModel.generateContent(prompt);
        const text = result.response.text(); // Pas besoin de await sur .text() ici d'habitude
        
        if (text) {
            helpText.innerText = text;
        } else {
            helpText.innerText = "Gemini n'a pas pu générer de réponse.";
        }
    } catch (error) {
        console.error("Détail de l'erreur Gemini:", error);
        // Regarde si l'erreur parle de "Safety" ou de "429"
        helpText.innerText = "Erreur: " + (error.message.includes("429") ? "Trop de requêtes, attends 1 min." : "Vérifie ta clé ou ta connexion.");
    }
};
const closeHelpBtn = document.querySelector(".close-help");
if (closeHelpBtn) {
    closeHelpBtn.onclick = () => { helpModal.style.display = "none"; };
}

// --- 4. MATHS & DESSIN ---
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

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]
];

function drawStyledHand(landmarks) {
    const w = canvasElement.width;
    const h = canvasElement.height;
    canvasCtx.strokeStyle = "#8a2be2";
    canvasCtx.lineWidth = 4;
    canvasCtx.lineCap = "round";

    HAND_CONNECTIONS.forEach(([start, end]) => {
        canvasCtx.beginPath();
        canvasCtx.moveTo(landmarks[start].x * w, landmarks[start].y * h);
        canvasCtx.lineTo(landmarks[end].x * w, landmarks[end].y * h);
        canvasCtx.stroke();
    });

    landmarks.forEach(p => {
        canvasCtx.beginPath();
        canvasCtx.arc(p.x * w, p.y * h, 5, 0, 2 * Math.PI);
        canvasCtx.fillStyle = "white";
        canvasCtx.fill();
    });
}

// --- 5. PRÉDICTION & WEBCAM ---
async function predict() {
    if (video.readyState >= 2 && handLandmarker) {
        if (canvasElement.width !== video.videoWidth || canvasElement.height !== video.videoHeight) {
            canvasElement.width = video.videoWidth;
            canvasElement.height = video.videoHeight;
        }

        const results = await handLandmarker.detectForVideo(video, performance.now(), {
            width: video.videoWidth,
            height: video.videoHeight
        });

        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const currentHand = results.landmarks[0];
            drawStyledHand(currentHand);

            const target = targetWordEl.innerText.toUpperCase();
            const reference = myReferenceDataset[target];

            if (reference && canValidate) {
                const diff = calculateDistance(currentHand, reference);
                console.log(`Distance pour ${target}: ${diff.toFixed(2)}`);

                if (diff < 3.5) {
                    statusBar.innerText = "✨ PARFAIT !";
                    handleSuccess();
                } else if (diff < 5.5) {
                    statusBar.innerText = "⚡ Tu y es presque...";
                } else {
                    statusBar.innerText = "Fais le signe : " + target;
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
    const feedback = document.getElementById("feedback-pop");
    feedback.innerText = "BIEN ! ✨";
    feedback.style.display = "block";
    
    setTimeout(() => {
        feedback.style.display = "none";
        const signs = Object.keys(myReferenceDataset);
        targetWordEl.innerText = signs[Math.floor(Math.random() * signs.length)];
        canValidate = true;
    }, 2000);
}

document.getElementById("enableWebcamButton").onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            predict();
            document.getElementById("enableWebcamButton").innerText = "Webcam Active ✅";
            document.getElementById("enableWebcamButton").disabled = true;
        };
    } catch (err) {
        alert("Erreur webcam : " + err.message);
    }
};

// --- 6. LANCEMENT ---
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
