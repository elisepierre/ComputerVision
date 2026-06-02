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
let currentStep = 0; // Pour suivre l'étape actuelle du mouvement (J et Z)

// --- 1. CONFIGURATION GEMINI ---
let API_KEY = localStorage.getItem("GEMINI_API_KEY");
let genAI = null;
let aiModel = null;

function setupAI() {
    API_KEY = localStorage.getItem("GEMINI_API_KEY");
    if (API_KEY) {
        try {
            genAI = new GoogleGenerativeAI(API_KEY);
            // Utilise "gemini-2.5-flash" (la plus rapide et performante pour ton projet)
            aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            console.log("Gemini 2.5 Flash is ready!");
        } catch (e) {
            console.error("AI Setup Error:", e);
        }
    }
}
// On appelle setupAI après l'avoir définie
setupAI();

// --- 2. CHARGEMENT DU DATASET ---
async function loadReferences() {
    try {
        const url = window.location.href;
        let jsonToLoad = "alphabet_signs.json"; // Default file

        // Logic to select the correct JSON based on the URL
        if (url.includes("meetings.html")) {
            jsonToLoad = "meetings_signs.json";
        } else if (url.includes("ordering.html")) {
            jsonToLoad = "ordering_signs.json";
        }

        console.log("📍 Attempting to fetch:", jsonToLoad);

        // Le "?v=" suivi de l'heure actuelle empêche le navigateur d'utiliser le cache
        const response = await fetch(`${jsonToLoad}?v=${new Date().getTime()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        myReferenceDataset = data;
        
        // Extracting keys (signs) from the object
        const signs = Object.keys(myReferenceDataset);
        console.log("🔍 Signs found in dataset:", signs);

        if (signs.length > 0 && targetWordEl) {
            const firstSign = signs[Math.floor(Math.random() * signs.length)];
            targetWordEl.innerText = firstSign;
            statusBar.innerText = "✅ Ready! Perform the sign: " + firstSign;
        } else {
            console.error("The JSON is empty or incorrectly formatted.");
            statusBar.innerText = "❌ Empty dataset (0 signs found)";
        }
    } catch (err) {
        console.error("Loading error:", err);
        statusBar.innerText = "❌ Error loading signs. Check console.";
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
        statusBar.innerText = "API Key saved!";
    }
};

document.getElementById("close-settings").onclick = () => {
    settingsModal.style.display = "none";
};

helpBtn.onclick = async () => {
    if (!aiModel) {
        statusBar.innerText = "Configure your API Key first! (⚙️)";
        settingsModal.style.display = "flex";
        return;
    }

    const currentLetter = targetWordEl.innerText;
    helpText.innerText = "Professor Gemini is thinking...";
    helpModal.style.display = "flex";

    // On force Gemini à être un prof de langue des signes
    const prompt = `You are a sign language expert. In one short sentence, explain how to position the fingers for the letter '${currentLetter}' in ASL.`;

    try {
        // Ajoute "generateContent" avec une gestion d'erreur plus précise
        const result = await aiModel.generateContent(prompt);
        const text = result.response.text(); // Pas besoin de await sur .text() ici d'habitude
        
        if (text) {
            helpText.innerText = text;
        } else {
            helpText.innerText = "Gemini could not generate a response.";
        }
    } catch (error) {
        console.error("Gemini Error Detail:", error);
        // Regarde si l'erreur parle de "Safety" ou de "429"
        helpText.innerText = "Error: " + (error.message.includes("429") ? "Too many requests, wait 1 min." : "Check your key or connection.");
    }
};
const closeHelpBtn = document.querySelector(".close-help");
if (closeHelpBtn) {
    closeHelpBtn.onclick = () => { helpModal.style.display = "none"; };
}

// Function to flip the hand data for the opposite hand
function mirrorHand(hand) {
    if (!hand || !Array.isArray(hand)) return null;
    return hand.map(p => ({
        x: 1 - p.x, // Inverse le X par rapport au centre de l'image (0.5)
        y: p.y,
        z: p.z
    }));
}

function calculateDistance(hand1, hand2) {
    let totalDist = 0;
    // Normalization: use distance between wrist(0) and middle finger base(9) as scale
    const size1 = Math.hypot(hand1[9].x - hand1[0].x, hand1[9].y - hand1[0].y) || 1;
    const size2 = Math.hypot(hand2[9].x - hand2[0].x, hand2[9].y - hand2[0].y) || 1;

    for (let i = 0; i < 21; i++) {
        const dx1 = (hand1[i].x - hand1[0].x) / size1;
        const dy1 = (hand1[i].y - hand1[0].y) / size1;
        const dx2 = (hand2[i].x - hand2[0].x) / size2;
        const dy2 = (hand2[i].y - hand2[0].y) / size2;
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

            try {
                const target = targetWordEl.innerText.toUpperCase();
                const references = myReferenceDataset[target];

                if (references && canValidate) {
                    // --- CAS J et Z (TRAJECTOIRE) ---
                    if (target === "J" || target === "Z") {
                        const targetStepRef = references[currentStep];
                        if (targetStepRef) {
                            const dNormal = calculateDistance(currentHand, targetStepRef);
                            const dMirror = calculateDistance(currentHand, mirrorHand(targetStepRef));
                            const bestDist = Math.min(dNormal, dMirror);

                            if (bestDist < 4.5) {
                                currentStep++;
                                statusBar.innerText = `Step ${currentStep}/${references.length} done! ⚡`;
                                
                                if (currentStep >= references.length) {
                                    statusBar.innerText = "✨ PERFECT MOTION!";
                                    currentStep = 0;
                                    handleSuccess();
                                }
                            }
                        }
                    } 
                    // --- CAS STATIQUE (A, B, C...) ---
                    else {
                        let minDiff = Infinity;
                        const refList = Array.isArray(references[0]) ? references : [references];

                        refList.forEach(ref => {
                            if (ref && ref.length === 21) {
                                const dNormal = calculateDistance(currentHand, ref);
                                const dMirror = calculateDistance(currentHand, mirrorHand(ref));
                                minDiff = Math.min(minDiff, dNormal, dMirror);
                            }
                        });

                        if (minDiff < 3.2) {
                            statusBar.innerText = "✨ PERFECT!";
                            handleSuccess();
                        } else if (minDiff < 4.5) {
                            statusBar.innerText = "⚡ Almost there...";
                        } else {
                            statusBar.innerText = "Perform the sign: " + target;
                        }
                    }
                }
            } catch (calcError) {
                console.error("Logic error:", calcError);
            }
        }
    }
    window.requestAnimationFrame(predict);
}
    
function handleSuccess() {
    canValidate = false;
    currentStep = 0; // Reset obligatoire pour J et Z
    score++;
    scoreEl.innerText = score;
    const feedback = document.getElementById("feedback-pop");
    feedback.innerText = "NICE! ✨";
    feedback.style.display = "block";
    
    setTimeout(() => {
        feedback.style.display = "none";
        const signs = Object.keys(myReferenceDataset);
        targetWordEl.innerText = signs[Math.floor(Math.random() * signs.length)];
        canValidate = true;
    }, 2000);
}

document.getElementById("enableWebcamButton").onclick = async () => {
    if (!handLandmarker) {
        statusBar.innerText = "❌ IA non prête, attends 2 secondes...";
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            video.play();
            // On s'assure que la vidéo tourne avant de lancer la boucle de prédiction
            requestAnimationFrame(predict); 
            document.getElementById("enableWebcamButton").innerText = "Webcam Active";
            document.getElementById("enableWebcamButton").disabled = true;
        };
    } catch (err) {
        console.error("Webcam Error:", err);
        statusBar.innerText = "❌ Caméra bloquée.";
    }
};

// --- 7. EXTRACTEUR DE DONNÉES (POUR LE MODE BATCH) ---
const batchProcessBtn = document.getElementById("batch-process");
const imageUploadInput = document.getElementById("image-upload");

// Quand on clique sur le bouton vert, on ouvre le sélecteur de fichiers
batchProcessBtn.onclick = () => {
    imageUploadInput.click();
};

// Quand les fichiers sont sélectionnés
// Quand les fichiers sont sélectionnés dans l'extracteur
imageUploadInput.onchange = async (event) => {
    const files = event.target.files;
    if (files.length === 0) return;

    statusBar.innerText = "⏳ Processing images... Please wait.";
    
    for (const file of files) {
        const label = file.name.split('_')[0].toUpperCase();
        
        try {
            const landmarks = await extractLandmarksFromImageFile(file);
            if (landmarks) {
                // Si la lettre n'existe pas, on initialise un tableau vide
                if (!myReferenceDataset[label]) {
                    myReferenceDataset[label] = [];
                }
                
                // Si c'était un ancien format objet, on le convertit proprement en tableau
                if (!Array.isArray(myReferenceDataset[label])) {
                    myReferenceDataset[label] = [myReferenceDataset[label]];
                }

                // On pousse la nouvelle photo (tableau de 21 points) dans la liste de cette lettre
                myReferenceDataset[label].push(landmarks);
                console.log(`✅ Added variant for ${label}.`);
            }
        } catch (err) {
            console.error("Error processing " + file.name, err);
        }
    }

    statusBar.innerText = "✅ Done! Downloading your new JSON...";
    downloadNewJSON(myReferenceDataset); // Appelle la fonction de téléchargement propre
};

// Fonction pour extraire les points d'une image uploadée
async function extractLandmarksFromImageFile(file) {
    return new Promise(async (resolve) => {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const tempLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "IMAGE",
            numHands: 1
        });

        const reader = new FileReader();
        reader.onload = async (e) => {
            const img = new Image();
            img.onload = async () => {
                const result = tempLandmarker.detect(img);
                tempLandmarker.close(); 
                if (result.landmarks && result.landmarks.length > 0) {
                    resolve(result.landmarks[0]);
                } else {
                    console.warn("No hand found in: " + file.name);
                    resolve(null);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Fonction pour télécharger le fichier JSON mis à jour
// Fonction pour télécharger le fichier JSON avec un formatage clair (Pretty Print)
// Fonction pour télécharger le fichier JSON parfaitement formaté (Pretty Print)
function downloadNewJSON(data) {
    // Le paramètre 'null, 2' force JavaScript à mettre chaque élément à la ligne avec une indentation propre
    const jsonString = JSON.stringify(data, null, 2);
    
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    downloadAnchorNode.setAttribute("download", "alphabet_signs.json");
    document.body.appendChild(downloadAnchorNode);
    
    downloadAnchorNode.click();
    
    // Nettoyage de la mémoire du navigateur
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
    
    console.log("📁 JSON formatted and downloaded successfully.");
}
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
