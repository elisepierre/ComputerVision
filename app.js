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
    // 1. On vérifie que la vidéo est prête
    if (video.readyState !== 4) {
        window.requestAnimationFrame(predictWebcam);
        return;
    }

    // 2. On ajuste le canvas à la taille de la vidéo à chaque frame
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    // 3. Détection MediaPipe
    const startTimeMs = performance.now();
    const results = await handLandmarker.detectForVideo(video, startTimeMs);

    // 4. On efface l'ancien dessin avant de faire le nouveau
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        for (const landmarks of results.landmarks) {
            // --- DESSIN DES POINTS BLANCS ---
            drawHand(landmarks);

            // --- RECONNAISSANCE (FINGERPOSE) ---
            const pixelLandmarks = landmarks.map(l => [
                l.x * canvasElement.width, 
                l.y * canvasElement.height, 
                l.z
            ]);
            
            const estimated = await GE.estimate(pixelLandmarks, 7.5);
            if (estimated.gestures.length > 0) {
                const best = estimated.gestures.reduce((p, c) => (p.score > c.score) ? p : c);
                if (best.name.toUpperCase() === targetWordEl.innerText) {
                    handleSuccess();
                }
            }
        }
    }

    // 5. CRUCIAL : On demande à relancer la fonction pour la frame suivante
    window.requestAnimationFrame(predictWebcam);
}

function drawHand(landmarks) {
    canvasCtx.fillStyle = "white";
    canvasCtx.strokeStyle = "black";
    canvasCtx.lineWidth = 1;

    for (const point of landmarks) {
        canvasCtx.beginPath();
        // Utilisation des coordonnées x,y brutes (le miroir est géré par le CSS)
        canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 4, 0, 2 * Math.PI);
        canvasCtx.fill();
        canvasCtx.stroke();
    }
}

// 4. Bouton Start
document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.onloadeddata = predictWebcam;
    document.getElementById("enableWebcamButton").style.display = "none";
});
