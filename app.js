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
const initGestures = () => {
    GE = new fp.GestureEstimator([]);

    // HELLO / GOODBYE (Main à plat)
    const flatHand = new fp.GestureDescription('HELLO');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        flatHand.addCurl(finger, fp.FingerCurl.NoCurl, 1.0); 
    }
    GE.addGesture(flatHand);

    // THANK YOU (Main à plat mais un peu penchée)
    const tiltedHand = new fp.GestureDescription('THANK YOU');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        tiltedHand.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    tiltedHand.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpRight, 0.5);
    tiltedHand.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpLeft, 0.5);
    GE.addGesture(tiltedHand);
    
    // GOODBYE (On utilise la même base que Hello pour plus de facilité)
    const byeHand = new fp.GestureDescription('GOODBYE');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        byeHand.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    GE.addGesture(byeHand);
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

async function runDetection() {
    if (!handLandmarker || video.paused || video.readyState < 2) return;

    canvasElement.width = video.clientWidth;
    canvasElement.height = video.clientHeight;

    const results = await handLandmarker.detectForVideo(video, performance.now());
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // Dessin des points
        canvasCtx.fillStyle = "white";
        for (const point of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 4, 0, 2 * Math.PI);
            canvasCtx.fill();
        }

        // --- RECONNAISSANCE ---
        const pixelLandmarks = landmarks.map(l => [l.x * canvasElement.width, l.y * canvasElement.height, l.z]);
        const estimated = await GE.estimate(pixelLandmarks, 6.0); // Seuil baissé à 6.0 pour être plus indulgent

        if (estimated.gestures.length > 0) {
            const best = estimated.gestures.reduce((p, c) => (p.score > c.score) ? p : c);
            
            // --- DÉBUGGER VISUEL ---
            // Affiche en haut de l'écran ce que l'IA voit actuellement
            canvasCtx.fillStyle = "#00ffcc";
            canvasCtx.font = "20px Arial";
            canvasCtx.fillText("IA SEES: " + best.name + " (" + best.score.toFixed(1) + ")", 20, 40);

            if (best.name === targetWordEl.innerText) {
                handleSuccess();
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
