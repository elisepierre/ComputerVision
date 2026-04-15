import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const statusBar = document.getElementById("status-bar");

let handLandmarker;
let GE;

// 1. Initialisation Fingerpose (Les gestes)
const initGestures = () => {
    GE = new fp.GestureEstimator([
        fp.Gestures.VictoryGesture,
        fp.Gestures.ThumbsUpGesture,
    ]);
    console.log("Fingerpose Ready");
};

// 2. Charger MediaPipe avec le bon lien
async function setup() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { 
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU" 
        },
        runningMode: "VIDEO", 
        numHands: 1
    });
    initGestures();
    statusBar.innerText = "IA Ready! Click Start Camera.";
}
setup();

// 3. Boucle de détection
async function predictWebcam() {
    // S'assurer que le canvas fait la même taille que la vidéo
    if (video.videoWidth > 0) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
    }

    const startTimeMs = performance.now();
    const results = await handLandmarker.detectForVideo(video, startTimeMs);

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // --- DESSIN DES POINTS ---
        drawHand(landmarks);

        // --- RECONNAISSANCE ---
        const pixelLandmarks = landmarks.map(l => [l.x * canvasElement.width, l.y * canvasElement.height, l.z]);
        const estimated = await GE.estimate(pixelLandmarks, 7.5);
        
        if (estimated.gestures.length > 0) {
            console.log("Gesture detected:", estimated.gestures[0].name);
        }
    }

    window.requestAnimationFrame(predictWebcam);
}

function drawHand(landmarks) {
    canvasCtx.fillStyle = "#00ffcc";
    for (const point of landmarks) {
        canvasCtx.beginPath();
        // On dessine avec les coordonnées normalisées * taille réelle
        canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 5, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}

// 4. Bouton Start
document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.onloadeddata = predictWebcam;
    document.getElementById("enableWebcamButton").style.display = "none";
});
