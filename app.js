
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");

let handLandmarker;
let score = 0;
let canValidate = true;

async function setupIA() {
    try {
        // On force l'URL vers les fichiers WASM de MediaPipe
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        
        statusBar.innerText = "✅ IA Ready. Click START!";
        console.log("IA Loaded Successfully");
    } catch (e) {
        statusBar.innerText = "❌ IA Error: Check Internet / F12 Console";
        console.error("Critical IA Error:", e);
    }
}

// On lance le chargement immédiatement
setupIA();

async function runDetection() {
    if (!handLandmarker || video.readyState < 2) {
        window.requestAnimationFrame(runDetection);
        return;
    }

    canvasElement.width = video.clientWidth;
    canvasElement.height = video.clientHeight;

    const startTimeMs = performance.now();
    const results = await handLandmarker.detectForVideo(video, startTimeMs);

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];

        // DESSIN DES POINTS
        canvasCtx.fillStyle = "white";
        for (const point of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fill();
        }

        // DETECTION MATHÉMATIQUE (Doigts vers le haut)
        // Comparaison : Bout du doigt (8, 12, 16, 20) vs Articulation (6, 10, 14, 18)
        const isIndexUp = landmarks[8].y < landmarks[6].y;
        const isMiddleUp = landmarks[12].y < landmarks[10].y;
        const isRingUp = landmarks[16].y < landmarks[14].y;
        const isPinkyUp = landmarks[20].y < landmarks[18].y;

        if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp && canValidate) {
            handleSuccess();
        }
    }
    window.requestAnimationFrame(runDetection);
}

function handleSuccess() {
    canValidate = false;
    score++;
    scoreEl.innerText = score;
    document.getElementById("feedback-pop").style.display = "block";
    setTimeout(() => { 
        document.getElementById("feedback-pop").style.display = "none";
        canValidate = true;
    }, 2000);
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });
        video.srcObject = stream;
        video.play();
        runDetection();
        document.getElementById("enableWebcamButton").style.display = "none";
    } catch (err) {
        alert("Camera error: " + err.message);
    }
});
