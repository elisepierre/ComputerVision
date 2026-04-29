import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");
const startButton = document.getElementById("enableWebcamButton");

let handLandmarker;
let score = 0;
let canValidate = true;

// 1. Initialisation de l'IA (Tasks Vision originale)
async function init() {
    try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU" // Utiliser GPU pour la fluidité
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        statusBar.innerText = "Coach Ready. Analysis loaded.";
        startButton.style.borderColor = "#00ffcc";
        startButton.style.color = "#00ffcc";
    } catch (e) {
        statusBar.innerText = "Error loading AI. Try refreshing.";
        console.error(e);
    }
}
init();

// 2. LOGIQUE DE DÉTECTION HAUTE DIFFICULTÉ
function validateGoodbye(landmarks) {
    // GOODBYE = Open Hand. All fingers must be EXTENDED and UP.
    // We check if fingertips (8, 12, 16, 20) are significantly higher than knuckles (6, 10, 14, 18)

    // A. Les 4 doigts longs doivent être ouverts
    const indexUp = landmarks[8].y < landmarks[6].y - 0.05; // 0.05 = marge de sûreté
    const middleUp = landmarks[12].y < landmarks[10].y - 0.05;
    const ringUp = landmarks[16].y < landmarks[14].y - 0.05;
    const pinkyUp = landmarks[20].y < landmarks[18].y - 0.05;

    // B. Le pouce doit être écarté (pas plié sur la paume)
    // On vérifie que le bout du pouce (4) est plus à l'extérieur que sa base (3)
    const thumbExtended = Math.abs(landmarks[4].x - landmarks[2].x) > 0.05;

    // La détection ne valide QUE si les 5 conditions sont vraies
    if (indexUp && middleUp && ringUp && pinkyUp && thumbExtended) {
        return true; // Match!
    } else {
        return false; // Fail (Peace sign, fist, etc.)
    }
}

async function predict() {
    if (video.readyState >= 2) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;

        const results = await handLandmarker.detectForVideo(video, performance.now());
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];

            // --- DESSIN DES POINTS NÉON (Pro) ---
            canvasCtx.fillStyle = "white"; // Intérieur du point
            canvasCtx.strokeStyle = "#00ffcc"; // Lueure néon
            canvasCtx.lineWidth = 2;

            for (const point of landmarks) {
                const x = point.x * canvasElement.width;
                const y = point.y * canvasElement.height;
                
                canvasCtx.beginPath();
                canvasCtx.arc(x, y, 3, 0, 2 * Math.PI);
                canvasCtx.fill();
                // Effet de lueure
                canvasCtx.shadowColor = "#00ffcc";
                canvasCtx.shadowBlur = 10;
                canvasCtx.stroke();
                // Reset shadow pour ne pas ramer
                canvasCtx.shadowBlur = 0;
            }

            // --- VALIDATION RENFORCÉE ---
            if (validateGoodbye(landmarks) && canValidate) {
                // Petit retour visuel direct sur la main
                canvasCtx.fillStyle = "#00ffcc";
                canvasCtx.fillText("MATCH!", landmarks[0].x * canvasElement.width, landmarks[0].y * canvasElement.height - 20);
                
                handleSuccess();
            }
        }
    }
    window.requestAnimationFrame(predict);
}

function handleSuccess() {
    canValidate = false;
    score++;
    scoreEl.innerText = score;
    
    const pop = document.getElementById("feedback-pop");
    pop.style.display = "block";
    
    // Feedback tactile/vibreur si mobile
    if ("vibrate" in navigator) {
        navigator.vibrate(100);
    }
    
    setTimeout(() => {
        pop.style.display = "none";
        canValidate = true;
    }, 2000);
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        video.srcObject = stream;
        video.play();
        predict();
        startButton.style.display = "none";
        statusBar.innerText = "Analyzing hand ASL...";
    } catch (err) {
        statusBar.innerText = "Error: Camera blocked";
        alert("Please allow camera access.");
    }
});
