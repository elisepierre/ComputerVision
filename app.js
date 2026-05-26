import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// --- ÉLÉMENTS UI ---
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");

const settingsModal = document.getElementById("settings-modal");
const openSettingsBtn = document.getElementById("open-settings");
const closeSettingsBtn = document.getElementById("close-settings");
const saveSettingsBtn = document.getElementById("save-settings");
const apiKeyInput = document.getElementById("api-key-input");

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
        
        const signs = Object.keys(myReferenceDataset);
        console.log("Dataset prêt avec", signs.length, "signes.");

        if (signs.length > 0 && targetWordEl) {
            // Force l'affichage de la première lettre
            const firstSign = signs[Math.floor(Math.random() * signs.length)];
            targetWordEl.innerText = firstSign;
            statusBar.innerText = "✅ Prêt ! Fais le signe : " + firstSign;
        }
    } catch (err) {
        statusBar.innerText = "❌ Erreur de chargement du dataset JSON";
        console.error(err);
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
    // 1. On vérifie que la vidéo est prête et que le modèle est chargé
    if (video.readyState >= 2 && handLandmarker) {
        
        // 2. Ajustement forcé du canvas aux dimensions de la vidéo
        if (canvasElement.width !== video.videoWidth || canvasElement.height !== video.videoHeight) {
            canvasElement.width = video.videoWidth;
            canvasElement.height = video.videoHeight;
        }

        // 3. APPEL CORRIGÉ : On passe les dimensions explicitement
        // C'est ce paramètre qui supprime l'erreur "NORM_RECT"
        const results = await handLandmarker.detectForVideo(video, performance.now(), {
            width: video.videoWidth,
            height: video.videoHeight
        });

        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const currentHand = results.landmarks[0];
            
            // 4. On dessine ton squelette violet
            drawStyledHand(currentHand);

            // 5. Comparaison avec ton dataset (Template Matching)
            const target = targetWordEl.innerText.toUpperCase();
            const reference = myReferenceDataset[target];

            if (reference && canValidate) {
                const diff = calculateDistance(currentHand, reference);
                
                // Pour t'aider à régler la difficulté, on affiche la distance en console
                console.log(`Distance pour ${target}: ${diff.toFixed(2)}`);

                // SEUIL DE RÉUSSITE : 0.75 est une bonne base
                if (diff < 3.5) {
                    statusBar.innerText = "✨ PARFAIT !";
                    handleSuccess();
                } else if (diff < 5.5) {
                    statusBar.innerText = "⚡ Tu y es presque, ajuste tes doigts...";
                } else {
                    statusBar.innerText = "Fais le signe pour la lettre : " + target;
                }
            }
        }
    }
    // On continue la boucle
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

openSettingsBtn.onclick = () => {
    const savedKey = localStorage.getItem("GEMINI_API_KEY");
    if (savedKey) apiKeyInput.value = savedKey;
    settingsModal.style.display = "flex";
};

// Fermer la modale
closeSettingsBtn.onclick = () => settingsModal.style.display = "none";

// Sauvegarder la clé localement
saveSettingsBtn.onclick = () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem("GEMINI_API_KEY", key);
        alert("Clé API sauvegardée localement ! ✅");
        settingsModal.style.display = "none";
        location.reload(); // Recharge pour initialiser Gemini avec la nouvelle clé
    }
};

// --- INITIALISATION GEMINI PRIVÉE ---
const savedApiKey = localStorage.getItem("GEMINI_API_KEY");
let genAI = null;
let aiModel = null;

if (savedApiKey) {
    genAI = new GoogleGenerativeAI(savedApiKey);
    aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

// --- LOGIQUE DU BOUTON AIDE (?) ---
document.getElementById("help-btn").onclick = async () => {
    if (!aiModel) {
        alert("Clique d'abord sur l'engrenage ⚙️ pour configurer ta clé API Gemini !");
        return;
    }

    const currentLetter = targetWordEl.innerText;
    statusBar.innerText = "L'IA réfléchit... 🧠";

    const prompt = `Explique en une seule phrase simple comment faire la lettre '${currentLetter}' en alphabet de langue des signes (ASL). Sois précis sur la position des doigts.`;

    try {
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Affichage dans la modale d'aide
        document.getElementById("help-text").innerText = text;
        document.getElementById("help-modal").style.display = "flex";
        statusBar.innerText = "Conseil de l'IA reçu ! ✨";
    } catch (error) {
        console.error(error);
        statusBar.innerText = "Erreur Gemini : Vérifie ta clé API.";
    }
};

// Fermer la modale d'aide
document.querySelector(".close-help").onclick = () => {
    document.getElementById("help-modal").style.display = "none";
};
