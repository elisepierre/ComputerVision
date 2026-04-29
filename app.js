import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");

let handLandmarker;
let GE;
let score = 0;
let canValidate = true;

// 1. INITIALISATION : On ne garde QUE Goodbye pour le test
const initGestures = () => {
    GE = new fp.GestureEstimator([]);

    // Définition de GOODBYE : Paume ouverte, tous les doigts tendus
    const goodbye = new fp.GestureDescription('GOODBYE');
    for(let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        goodbye.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    GE.addGesture(goodbye);
    
    // FORCE LE MOT AU DÉMARRAGE
    targetWordEl.innerText = "GOODBYE";
};

async function loadModels() {
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
    document.getElementById("status-bar").innerText = "IA Ready! Show GOODBYE (Open Hand)";
}
loadModels();

async function runDetection() {
    if (!handLandmarker || video.paused || video.readyState < 2) return;

    // Synchronisation taille
    canvasElement.width = video.clientWidth;
    canvasElement.height = video.clientHeight;

    const results = await handLandmarker.detectForVideo(video, performance.now());
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // DESSIN DES POINTS BLANCS
        canvasCtx.fillStyle = "white";
        for (const point of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fill();
        }

        // ANALYSE FINGERPOSE
        const pixelLandmarks = landmarks.map(l => [l.x * canvasElement.width, l.y * canvasElement.height, l.z]);
        const estimated = await GE.estimate(pixelLandmarks, 7.5); 

        if (estimated.gestures.length > 0) {
            const best = estimated.gestures.reduce((p, c) => (p.score > c.score) ? p : c);
            
            // DEBUG SUR LE CANVAS
            canvasCtx.fillStyle = "#00ffcc";
            canvasCtx.font = "bold 24px Arial";
            canvasCtx.fillText("IA SEES: " + best.name, 20, 40);

            // VALIDATION
            if (best.name === "GOODBYE" && canValidate) {
                handleSuccess();
            }
        }
    }
}

function handleSuccess() {
    canValidate = false;
    score++;
    scoreEl.innerText = score;
    
    // Feedback visuel
    const pop = document.getElementById("feedback-pop");
    pop.style.display = "block";
    
    setTimeout(() => { 
        pop.style.display = "none";
        // On reste sur GOODBYE pour l'instant pour valider que le score marche
        canValidate = true;
    }, 2000);
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    setInterval(runDetection, 50); // Boucle stable
    document.getElementById("enableWebcamButton").style.display = "none";
});
