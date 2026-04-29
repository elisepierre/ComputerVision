const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");

let score = 0;
let canValidate = true;

// 1. CONFIGURATION DE LA CAMÉRA ET DE L'IA
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// 2. FONCTION DE DÉTECTION (Appelée à chaque frame)
hands.onResults((results) => {
    canvasElement.width = video.clientWidth;
    canvasElement.height = video.clientHeight;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // DESSIN DES POINTS BLANCS
        canvasCtx.fillStyle = "white";
        for (const point of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fill();
        }

        // VALIDATION MATHÉMATIQUE (GOODBYE = Doigts levés)
        const isIndexUp = landmarks[8].y < landmarks[6].y;
        const isMiddleUp = landmarks[12].y < landmarks[10].y;
        const isRingUp = landmarks[16].y < landmarks[14].y;
        const isPinkyUp = landmarks[20].y < landmarks[18].y;

        if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp && canValidate) {
            handleSuccess();
        }
    }
});

function handleSuccess() {
    canValidate = false;
    score++;
    scoreEl.innerText = score;
    document.getElementById("feedback-pop").style.display = "block";
    setTimeout(() => { 
        document.getElementById("feedback-pop").style.display = "none";
        canValidate = true;
    }, 2000);
}

// 3. BOUTON START
document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    statusBar.innerText = "Starting Camera...";
    
    const camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({image: video});
        },
        width: 640,
        height: 480
    });

    camera.start().then(() => {
        statusBar.innerText = "Scanning Hand...";
        document.getElementById("enableWebcamButton").style.display = "none";
    }).catch(err => {
        statusBar.innerText = "Error: Camera blocked";
        console.error(err);
    });
});

// Ajouter ce script au début pour la gestion de la caméra MediaPipe
const script = document.createElement('script');
script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
document.head.appendChild(script);
