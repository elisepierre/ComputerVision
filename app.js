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


let lastVideoTime = -1;

async function predictWebcam() {
    // 1. Synchronisation de la taille du canvas
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    // 2. SÉCURITÉ CRUCIALE : On ne traite l'image que si la vidéo a avancé
    let startTimeMs = performance.now();
    
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        
        // On passe video.currentTime en millisecondes pour MediaPipe
        const results = await handLandmarker.detectForVideo(video, startTimeMs);

        // 3. Dessin
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            for (const landmarks of results.landmarks) {
                drawHand(landmarks); // Ta fonction qui dessine les points blancs

                // Reconnaissance Fingerpose
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
    }

    // 4. ON RELANCE LA BOUCLE QUOI QU'IL ARRIVE
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
