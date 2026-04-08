import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const statusBar = document.getElementById("status-bar");
let handLandmarker = undefined;

// 1. Charger MediaPipe
async function createHandLandmarker() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
        runningMode: "VIDEO", numHands: 1
    });
    statusBar.innerText = "Predicting...";
}
createHandLandmarker();

// 2. Activer la Webcam
const enableWebcamButton = document.getElementById("enableWebcamButton");
enableWebcamButton.addEventListener("click", () => {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
        enableWebcamButton.style.display = "none";
    });
});

async function predictWebcam() {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    let startTimeMs = performance.now();
    const results = await handLandmarker.detectForVideo(video, startTimeMs);

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (results.landmarks) {
        for (const landmarks of results.landmarks) {
            // Dessiner les points (Simplifié)
            for (let point of landmarks) {
                canvasCtx.fillStyle = "#00ffcc";
                canvasCtx.beginPath();
                canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 3, 0, 2 * Math.PI);
                canvasCtx.fill();
            }
        }
    }
    window.requestAnimationFrame(predictWebcam);
}
