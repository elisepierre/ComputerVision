import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");

let handLandmarker;
let GE;
let score = 0;
let canValidate = true;

const initGestures = () => {
    // On crée un geste "GOODBYE" très simple
    GE = new fp.GestureEstimator([]);
    const goodbye = new fp.GestureDescription('GOODBYE');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        goodbye.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    GE.addGesture(goodbye);
};

async function setup() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { 
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU" 
        },
        runningMode: "VIDEO", numHands: 1
    });
    initGestures();
    statusBar.innerText = "IA Prête !";
}
setup();

async function runDetection() {
    if (!handLandmarker || video.readyState < 2) return;

    canvasElement.width = video.clientWidth;
    canvasElement.height = video.clientHeight;

    const results = await handLandmarker.detectForVideo(video, performance.now());
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];

        // 1. DESSIN
        canvasCtx.fillStyle = "white";
        for (const point of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fill();
        }

        // 2. LOGIQUE DE VALIDATION (MATHÉMATIQUE SIMPLE)
        // On vérifie si l'index, le majeur et l'annulaire sont "hauts" (dépliés)
        const isIndexUp = landmarks[8].y < landmarks[6].y;
        const isMiddleUp = landmarks[12].y < landmarks[10].y;
        const isRingUp = landmarks[16].y < landmarks[14].y;

        if (isIndexUp && isMiddleUp && isRingUp && canValidate) {
            // Affichage debug sur le canvas
            canvasCtx.fillStyle = "#00ffcc";
            canvasCtx.fillText("GESTE DÉTECTÉ !", 20, 30);
            
            handleSuccess();
        }
    }
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
        // On pourrait changer le mot ici, mais restons sur GOODBYE pour tester
    }, 2000);
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    setInterval(runDetection, 40); // Boucle forcée
    document.getElementById("enableWebcamButton").style.display = "none";
});
