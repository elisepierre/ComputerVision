import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");

let handLandmarker;
let score = 0;
let GE; // Gesture Estimator

// 1. Initialisation de la Database de Gestes
const initGestures = () => {
    // 1. Créer l'estimateur avec les gestes par défaut (Victory, Thumbs Up)
    GE = new fp.GestureEstimator([
        fp.Gestures.VictoryGesture,
        fp.Gestures.ThumbsUpGesture,
    ]);

    // 2. Définir le signe HELLO
    const helloGesture = new fp.GestureDescription('HELLO');
    
    // Tous les doigts tendus (No Curl)
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        helloGesture.addCurl(finger, fp.FingerCurl.NoCurl, 1.0); 
        // Optionnel : On précise que les doigts pointent vers le haut
        helloGesture.addDirection(finger, fp.FingerDirection.VerticalUp, 0.8);
    }
    helloGesture.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);

    // 3. Ajouter HELLO à l'estimateur
    GE.addGesture(helloGesture);

    console.log("✅ Gestures initialized: HELLO, VICTORY, THUMBS_UP");
};

async function setup() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { 
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU" 
        },
        runningMode: "VIDEO", numHands: 1
    });
    initGestures();
}
setup();

// 2. Boucle de Prédiction
async function predictWebcam() {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
    const results = await handLandmarker.detectForVideo(video, performance.now());

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Effet Miroir
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // --- RECONNAISSANCE VIA FINGERPOSE ---
        // On convertit les landmarks MediaPipe au format Fingerpose
        // Dans predictWebcam, juste avant GE.estimate :
        const pixelLandmarks = landmarks.map(l => [
            (1 - l.x) * canvasElement.width, // On inverse le X ici pour que l'IA "voit" comme toi
            l.y * canvasElement.height, 
            l.z
        ]);
        const estimatedGestures = await GE.estimate(pixelLandmarks, 8.5); // 8.5 = Seuil de confiance

        if (estimatedGestures.gestures.length > 0) {
            // On prend le geste avec le plus haut score de confiance
            const bestGesture = estimatedGestures.gestures.reduce((p, c) => (p.score > c.score) ? p : c);
            
            // Si le geste correspond au mot affiché (Challenge)
            if (bestGesture.name.toUpperCase() === targetWordEl.innerText) {
                handleSuccess();
            }
        }
        drawHand(landmarks);
    }
    canvasCtx.restore();
    window.requestAnimationFrame(predictWebcam);
}

function handleSuccess() {
    score++;
    scoreEl.innerText = score;
    // Changement de mot (On alterne entre Victory et Thumbs_Up pour tester)
    const words = ["VICTORY", "THUMBS_UP"];
    targetWordEl.innerText = words[Math.floor(Math.random() * words.length)];
}

// Dessin simplifié
function drawHand(landmarks) {
    for (let point of landmarks) {
        canvasCtx.fillStyle = "#00ffcc";
        canvasCtx.beginPath();
        
        // Comme on a fait canvasCtx.scale(-1, 1) avant d'appeler cette fonction,
        // on dessine les points normalement, le canvas s'occupe de l'inversion.
        const x = point.x * canvasElement.width;
        const y = point.y * canvasElement.height;
        
        canvasCtx.arc(x, y, 4, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}

// Bouton Start
document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.onloadeddata = predictWebcam;
    document.getElementById("enableWebcamButton").style.display = "none";
});
