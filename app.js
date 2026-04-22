import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");

let handLandmarker;
let GE;
let score = 0;

// 1. DÉFINITIONS ULTRA-SIMPLES (Plus faciles à détecter)
// 1. On affine les définitions pour différencier les 3 signes
const initGestures = () => {
    GE = new fp.GestureEstimator([]);

    // --- HELLO : Main plate, doigts vers le HAUT ---
    const hello = new fp.GestureDescription('HELLO');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        hello.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
        hello.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
    }
    GE.addGesture(hello);

    // --- GOODBYE : Main plate, doigts vers le CÔTÉ (mouvement de balayage) ---
    const goodbye = new fp.GestureDescription('GOODBYE');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        goodbye.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
        goodbye.addDirection(finger, fp.FingerDirection.HorizontalLeft, 0.8);
        goodbye.addDirection(finger, fp.FingerDirection.HorizontalRight, 0.8);
    }
    GE.addGesture(goodbye);

    // --- THANK YOU : Main plate, DE FACE ou DIAGONALE ---
    const thankYou = new fp.GestureDescription('THANK YOU');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        thankYou.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    thankYou.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpRight, 0.8);
    thankYou.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpLeft, 0.8);
    GE.addGesture(thankYou);
};

async function loadModels() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
        runningMode: "VIDEO", numHands: 1
    });
    initGestures();
}
loadModels();

// 2. La boucle avec validation flexible
async function runDetection() {
    if (!handLandmarker || video.paused || video.readyState < 2) return;

    canvasElement.width = video.clientWidth;
    canvasElement.height = video.clientHeight;

    const results = await handLandmarker.detectForVideo(video, performance.now());
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        drawHand(landmarks); // Points blancs

        const pixelLandmarks = landmarks.map(l => [l.x * canvasElement.width, l.y * canvasElement.height, l.z]);
        const estimated = await GE.estimate(pixelLandmarks, 6.5); 

        if (estimated.gestures.length > 0) {
            // On trie pour avoir le meilleur score
            const best = estimated.gestures.reduce((p, c) => (p.score > c.score) ? p : c);
            
            // AFFICHAGE DEBUG
            canvasCtx.fillStyle = "#00ffcc";
            canvasCtx.font = "bold 24px Arial";
            canvasCtx.fillText(`DETECTED: ${best.name} (${Math.round(best.score)}/10)`, 20, 40);

            // LOGIQUE DE VALIDATION FLEXIBLE
            const target = targetWordEl.innerText.trim().toUpperCase();
            const recognized = best.name.toUpperCase();

            // Si le mot reconnu est contenu dans la cible (ex: HELLO dans HELLO)
            if (recognized === target || target.includes(recognized)) {
                if (best.score > 7.0) { // On demande un score minimum pour valider
                    handleSuccess();
                }
            }
        }
    }
}


function handleSuccess() {
    if (document.getElementById("feedback-pop").style.display === "block") return;
    score++;
    scoreEl.innerText = score;
    document.getElementById("feedback-pop").style.display = "block";
    setTimeout(() => { 
        document.getElementById("feedback-pop").style.display = "none";
        const words = ["HELLO", "GOODBYE", "THANK YOU"];
        targetWordEl.innerText = words[Math.floor(Math.random() * words.length)];
    }, 1500);
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    setInterval(runDetection, 40);
    document.getElementById("enableWebcamButton").style.display = "none";
});
