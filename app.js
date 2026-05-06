import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");
const statusBar = document.getElementById("status-bar");

let handLandmarker;
let score = 0;
let canValidate = true;

// 1. DATABASE SÉCURISÉE (On vérifie chaque point avant de calculer)
const ASL_DATABASE = {
    "GOODBYE": (lm) => {
        const indexUp = lm[8].y < lm[6].y - 0.05;
        const middleUp = lm[12].y < lm[10].y - 0.05;
        const ringUp = lm[16].y < lm[14].y - 0.05;
        const pinkyUp = lm[20].y < lm[18].y - 0.05;
        const thumbOpen = Math.abs(lm[4].x - lm[9].x) > 0.09;
        return indexUp && middleUp && ringUp && pinkyUp && thumbOpen;
    },
    "HELLO": (lm) => {
        // Similaire à goodbye mais doigts serrés (différence de X faible entre index et majeur)
        const allUp = lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y;
        const fingersClose = Math.abs(lm[8].x - lm[12].x) < 0.04;
        return allUp && fingersClose;
    }
};

const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[15,16],[0,17],[17,18],[19,20]];

async function init() {
    try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        statusBar.innerText = "System Active. Ready to scan.";
    } catch (e) {
        statusBar.innerText = "IA Error. Check connection.";
    }
}
init();

async function predict() {
    if (video.readyState >= 2 && handLandmarker) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;

        try {
            const results = await handLandmarker.detectForVideo(video, performance.now());
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                
                // DESSIN DU SQUELETTE
                drawStyledHand(landmarks);

                // RECONNAISSANCE
                const currentWord = targetWordEl.innerText.toUpperCase();
                if (ASL_DATABASE[currentWord] && ASL_DATABASE[currentWord](landmarks)) {
                    if (canValidate) handleSuccess();
                }
            }
        } catch (err) {
            console.error("Detection loop error:", err);
        }
    }
    // Cette ligne est cruciale : elle relance la boucle même s'il y a eu une erreur
    window.requestAnimationFrame(predict);
}

function drawStyledHand(landmarks) {
    const w = canvasElement.width;
    const h = canvasElement.height;

    // Traits Violets
    canvasCtx.strokeStyle = "#8a2be2";
    canvasCtx.lineWidth = 4;
    canvasCtx.lineCap = "round";
    canvasCtx.shadowColor = "#00e5ff";
    canvasCtx.shadowBlur = 10;

    HAND_CONNECTIONS.forEach(([s, e]) => {
        if(landmarks[s] && landmarks[e]) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(landmarks[s].x * w, landmarks[s].y * h);
            canvasCtx.lineTo(landmarks[e].x * w, landmarks[e].y * h);
            canvasCtx.stroke();
        }
    });

    // Points Blancs
    canvasCtx.shadowBlur = 0;
    canvasCtx.fillStyle = "white";
    landmarks.forEach(p => {
        canvasCtx.beginPath();
        canvasCtx.arc(p.x * w, p.y * h, 4, 0, 2 * Math.PI);
        canvasCtx.fill();
    });
}

function handleSuccess() {
    canValidate = false;
    score++;
    scoreEl.innerText = score;
    document.getElementById("feedback-pop").style.display = "block";

    setTimeout(() => {
        document.getElementById("feedback-pop").style.display = "none";
        // On change de mot aléatoirement
        const words = Object.keys(ASL_DATABASE);
        targetWordEl.innerText = words[Math.floor(Math.random() * words.length)];
        canValidate = true;
    }, 2000);
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();
        predict(); // Lancement de la boucle
        document.getElementById("enableWebcamButton").style.display = "none";
    } catch (err) {
        alert("Camera error. Please allow access.");
    }
});
