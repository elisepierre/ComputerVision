import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");

let handLandmarker;
let score = 0;
let canValidate = true;

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

function checkStrictGoodbye(landmarks) {
    // 1. Les 4 doigts longs (Index, Middle, Ring, Pinky) doivent être vers le HAUT
    const indexUp = landmarks[8].y < landmarks[6].y - 0.04;
    const middleUp = landmarks[12].y < landmarks[10].y - 0.04;
    const ringUp = landmarks[16].y < landmarks[14].y - 0.04;
    const pinkyUp = landmarks[20].y < landmarks[18].y - 0.04;

    // 2. Le POUCE doit être ouvert (distance entre pouce et index suffisante)
    const thumbOpen = Math.abs(landmarks[4].x - landmarks[8].x) > 0.1;

    // 3. Paume face caméra (on vérifie que les points ne sont pas trop proches en Z)
    const palmFlat = Math.abs(landmarks[5].z - landmarks[17].z) < 0.1;

    // Retourne vrai uniquement si TOUT est respecté (5 doigts + paume)
    return indexUp && middleUp && ringUp && pinkyUp && thumbOpen && palmFlat;
}

async function predict() {
    if (video.readyState >= 2) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        const results = await handLandmarker.detectForVideo(video, performance.now());
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];

            // Dessin des points style "Apprentissage" (Marron et Blanc)
            canvasCtx.fillStyle = "white";
            canvasCtx.strokeStyle = "#5d4037";
            canvasCtx.lineWidth = 2;
            for (const point of landmarks) {
                canvasCtx.beginPath();
                canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 4, 0, 2 * Math.PI);
                canvasCtx.fill();
                canvasCtx.stroke();
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
    setTimeout(() => {
        pop.style.display = "none";
        canValidate = true;
    }, 2000);
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    predict();
    document.getElementById("enableWebcamButton").style.display = "none";
});
