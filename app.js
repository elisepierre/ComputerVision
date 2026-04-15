import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const statusBar = document.getElementById("status-bar");

let handLandmarker;
let GE; // Gesture Estimator
let lastVideoTime = -1;

// 1. Initialisation de Fingerpose (Crée ton Hello ici)
const initGestures = () => {
    GE = new fp.GestureEstimator([
        fp.Gestures.VictoryGesture,
        fp.Gestures.ThumbsUpGesture,
    ]);

    // Définir le signe HELLO
    const helloGesture = new fp.GestureDescription('HELLO');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        helloGesture.addCurl(finger, fp.FingerCurl.NoCurl, 1.0); 
        helloGesture.addDirection(finger, fp.FingerDirection.VerticalUp, 0.8);
    }
    helloGesture.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
    GE.addGesture(helloGesture);
    console.log("Fingerpose Ready");
};

async function setup() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
        runningMode: "VIDEO", numHands: 1
    });
    initGestures();
    statusBar.innerText = "Coach Ready! Click START CAMERA.";
}
setup();

// 2. Boucle de Prédiction (Flux continu)
async function predictWebcam() {
    // 1. On s'assure que la vidéo est bien en train de jouer
    if (video.paused || video.ended) {
        window.requestAnimationFrame(predictWebcam);
        return;
    }

    // 2. Ajustement du Canvas
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    // 3. LA CORRECTION : On utilise un bloc try/catch pour éviter que l'IA ne bloque tout
    try {
        if (lastVideoTime !== video.currentTime) {
            lastVideoTime = video.currentTime;
            
            // On utilise la détection "normale" mais on attend qu'elle finisse
            const results = await handLandmarker.detectForVideo(video, performance.now());

            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                drawHand(landmarks); // Tes points blancs

                // --- ON DESACTIVE FINGERPOSE TEMPORAIREMENT POUR TESTER ---
                // Si ça marche sans Fingerpose, on saura que c'est lui qui fait ramer.
                /*
                const pixelLandmarks = landmarks.map(l => [l.x * canvasElement.width, l.y * canvasElement.height, l.z]);
                const estimated = await GE.estimate(pixelLandmarks, 7.5);
                if (estimated.gestures.length > 0) {
                    const best = estimated.gestures.reduce((p, c) => (p.score > c.score) ? p : c);
                    if (best.name.toUpperCase() === targetWordEl.innerText) {
                        handleSuccess();
                    }
                }
                */
            }
        }
    } catch (error) {
        console.error("IA Error:", error);
    }

    // 4. On relance IMMÉDIATEMENT la boucle
    setTimeout(() => {
        window.requestAnimationFrame(predictWebcam);
    }, 10); // Un léger délai de 10ms aide souvent les Chromebooks à "respirer"
}

function drawHand(landmarks) {
    // Dessiner les points blancs comme sur Python
    canvasCtx.fillStyle = "white";
    canvasCtx.strokeStyle = "black";
    canvasCtx.lineWidth = 1;

    for (const point of landmarks) {
        canvasCtx.beginPath();
        // Coordonnées MediaPipe directes (0-1 * Taille réelle)
        canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 5, 0, 2 * Math.PI);
        canvasCtx.fill();
        canvasCtx.stroke();
    }
}

function handleSuccess() {
    // Score + Message Excellent + Nouveau mot
    console.log("VALIDE!");
}

// Bouton Start
document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.onloadeddata = () => {
        predictWebcam();
        statusBar.innerText = "Coach analysis running...";
    };
    document.getElementById("enableWebcamButton").style.display = "none";
});
