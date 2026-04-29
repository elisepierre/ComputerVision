import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");

let handLandmarker;
let score = 0;
let canValidate = true;

async function setupIA() {
    try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        statusBar.innerText = "IA Ready. Press Start!";
    } catch (e) {
        statusBar.innerText = "Error loading IA. Check connection.";
        console.error(e);
    }
}
setupIA();

async function runDetection() {
    if (!handLandmarker || video.readyState < 2) return;

    canvasElement.width = video.clientWidth;
    canvasElement.height = video.clientHeight;

    const results = await handLandmarker.detectForVideo(video, performance.now());
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];

        // 1. DRAW WHITE DOTS (Python style)
        canvasCtx.fillStyle = "white";
        for (const point of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fill();
        }

        // 2. MATH DETECTION (GOODBYE = Open Hand)
        // We check if fingertips (8, 12, 16, 20) are higher than knuckles (5, 9, 13, 17)
        const isIndexUp = landmarks[8].y < landmarks[5].y;
        const isMiddleUp = landmarks[12].y < landmarks[9].y;
        const isRingUp = landmarks[16].y < landmarks[13].y;
        const isPinkyUp = landmarks[20].y < landmarks[17].y;

        if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp && canValidate) {
            canvasCtx.fillStyle = "#00ffcc";
            canvasCtx.font = "bold 20px Arial";
            canvasCtx.fillText("MATCH!", 20, 30);
            handleSuccess();
        }
    }
    window.requestAnimationFrame(runDetection);
}

function handleSuccess() {
    canValidate = false;
    score++;
    scoreEl.innerText = score;
    
    const pop = document.getElementById("feedback-pop");
    pop.style.display = "block";
    
    setTimeout(() => { 
        pop.style.display = "none";
        canValidate = true;
        // Keep GOODBYE for the test to ensure it works
    }, 2000);
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();
        runDetection(); // Start the loop
        document.getElementById("enableWebcamButton").style.display = "none";
        statusBar.innerText = "Scanning hand...";
    } catch (err) {
        alert("Camera access denied.");
    }
});
