import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");

let handLandmarker;
let score = 0;
let canValidate = true;

// 1. Initialisation
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
    statusBar.innerText = "Classroom ready! Click Start.";
}
init();

// 2. Définition des connexions de la main (pour dessiner les traits)
// C'est la "carte" des os de la main.
const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4], // Thumb
    [0,5],[5,6],[6,7],[7,8], // Index
    [0,9],[9,10],[10,11],[11,12], // Middle
    [0,13],[13,14],[14,15],[15,16], // Ring
    [0,17],[17,18],[18,19],[19,20] // Pinky
];

// 3. Logique stricte (les 5 doigts visibles)
function checkStrictGoodbye(landmarks) {
    // We check if fingertips (8, 12, 16, 20) are significantly higher than knuckles (6, 10, 14, 18)
    const indexUp = landmarks[8].y < landmarks[6].y - 0.05;
    const middleUp = landmarks[12].y < landmarks[10].y - 0.05;
    const ringUp = landmarks[16].y < landmarks[14].y - 0.05;
    const pinkyUp = landmarks[20].y < landmarks[18].y - 0.05;

    // Thumb extended (check x distance to middle of palm)
    const thumbOpen = Math.abs(landmarks[4].x - landmarks[9].x) > 0.09;

    return indexUp && middleUp && ringUp && pinkyUp && thumbOpen;
}

// 4. Boucle de détection
async function predict() {
    if (video.readyState >= 2) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        const results = await handLandmarker.detectForVideo(video, performance.now());
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            const width = canvasElement.width;
            const height = canvasElement.height;

            // --- DESSIN STYLÉ (SQUELETTE DIGITAL) ---

            // A. D'abord on dessine les TRAITS (les os)
            canvasCtx.strokeStyle = "#8a2be2"; // Violet Électrique
            canvasCtx.lineWidth = 3;
            canvasCtx.lineCap = "round";

            HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
                const startPoint = landmarks[startIdx];
                const endPoint = landmarks[endIdx];
                
                canvasCtx.beginPath();
                canvasCtx.moveTo(startPoint.x * width, startPoint.y * height);
                canvasCtx.lineTo(endPoint.x * width, endPoint.y * height);
                // Effet de lueur (Néon)
                canvasCtx.shadowColor = "#00e5ff"; // Cyan
                canvasCtx.shadowBlur = 15;
                canvasCtx.stroke();
            });

            // B. Ensuite on dessine les POINTS (les articulations)
            canvasCtx.fillStyle = "white";
            canvasCtx.shadowBlur = 0; // On reset la lueur
            for (const point of landmarks) {
                canvasCtx.beginPath();
                canvasCtx.arc(point.x * width, point.y * height, 4, 0, 2 * Math.PI);
                canvasCtx.fill();
            }

            // Validation
            if (checkStrictGoodbye(landmarks) && canValidate) {
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
    
    // Petite vibration sur les appareils compatibles
    if ("vibrate" in navigator) navigator.vibrate(100);

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
        document.getElementById("enableWebcamButton").style.display = "none";
    } catch (err) {
        statusBar.innerText = "Error: Camera blocked";
        alert("Please allow camera access.");
    }
});
