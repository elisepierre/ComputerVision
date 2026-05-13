import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const statusBar = document.getElementById("status-bar");
const imageUpload = document.getElementById("image-upload");
const batchBtn = document.getElementById("batch-process");

let handLandmarker;
let myReferenceDataset = {};

// --- 1. INIT MEDIAPIPE ---
async function init() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
        },
        runningMode: "IMAGE", // Mode IMAGE pour le scan automatique
        numHands: 1
    });
    statusBar.innerText = "MediaPipe Loaded - Ready to Scan";
}
init();

// --- 2. LOGIQUE D'EXTRACTION AUTOMATIQUE ---
batchBtn.onclick = () => imageUpload.click();

imageUpload.onchange = async (e) => {
    const files = e.target.files;
    if (files.length === 0) return;

    statusBar.innerText = `Scanning ${files.length} images...`;
    myReferenceDataset = {}; 

    for (let file of files) {
        try {
            const bitmap = await createImageBitmap(file);
            
            // Création du canvas avec les dimensions réelles de l'image
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = bitmap.width;
            tempCanvas.height = bitmap.height;
            const ctx = tempCanvas.getContext("2d");
            ctx.drawImage(bitmap, 0, 0);

            // IMPORTANT : On passe l'image ET on s'assure que le mode IMAGE est actif
            // La détection sur image fixe nécessite ces dimensions pour ne pas bugger
            const results = await handLandmarker.detect(tempCanvas);

            if (results.landmarks && results.landmarks.length > 0) {
                let label = file.name.split('.')[0].toUpperCase(); 
                if (file.name.includes('_')) {
                    label = file.name.split('_')[0].toUpperCase();
                }

                myReferenceDataset[label] = results.landmarks[0];
                console.log(`✅ Succès : [${label}] extrait de ${file.name}`);
            } else {
                // Si MediaPipe échoue encore, cela peut être dû à la qualité de l'image
                console.warn(`❌ MediaPipe n'a pas trouvé de main dans : ${file.name}. Vérifiez l'éclairage de la photo.`);
            }
        } catch (err) {
            console.error(`🔥 Erreur technique sur ${file.name}:`, err);
        }
    }

    const finalSize = Object.keys(myReferenceDataset).length;
    if (finalSize > 0) {
        downloadJSON(myReferenceDataset);
        statusBar.innerText = `Extraction finie : ${finalSize} signes sauvegardés !`;
    } else {
        statusBar.innerText = "Aucun signe extrait. Essayez des photos plus nettes.";
    }
};

function downloadJSON(data) {
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reference_signs.json";
    a.click();
}

// --- 3. WEBCAM (Pour tester après) ---
document.getElementById("enableWebcamButton").onclick = async () => {
    // On change le mode en VIDEO pour la webcam
    await handLandmarker.setOptions({ runningMode: "VIDEO" });
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    predict();
};

async function predict() {
    if (video.readyState >= 2) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        const results = await handLandmarker.detectForVideo(video, performance.now());
        
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        if (results.landmarks && results.landmarks.length > 0) {
            drawHand(results.landmarks[0]);
        }
    }
    window.requestAnimationFrame(predict);
}

function drawHand(landmarks) {
    const w = canvasElement.width;
    const h = canvasElement.height;
    canvasCtx.strokeStyle = "#8a2be2";
    canvasCtx.lineWidth = 4;
    landmarks.forEach(p => {
        canvasCtx.beginPath();
        canvasCtx.arc(p.x * w, p.y * h, 3, 0, 2 * Math.PI);
        canvasCtx.fill();
    });
}
