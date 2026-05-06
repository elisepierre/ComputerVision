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

// --- BASE DE DONNÉES SÉCURISÉE ---
const ASL_DATABASE = {
    "GOODBYE": (lm) => {
        return lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y && Math.abs(lm[4].x - lm[5].x) > 0.1;
    },
    "HELLO": (lm) => {
        const fingersTogether = Math.abs(lm[8].x - lm[12].x) < 0.03;
        return fingersTogether && lm[8].y < lm[6].y && lm[12].y < lm[10].y;
    },
    "I LOVE YOU": (lm) => {
        // Index, Auriculaire et Pouce levés / Majeur et Annulaire pliés
        return lm[8].y < lm[6].y && lm[20].y < lm[18].y && lm[4].x < lm[2].x && lm[12].y > lm[10].y && lm[16].y > lm[14].y;
    },
    "NO": (lm) => {
        // Index et Majeur touchent le Pouce (forme de pince)
        const distIndexThumb = Math.hypot(lm[8].x - lm[4].x, lm[8].y - lm[4].y);
        return distIndexThumb < 0.05 && lm[16].y > lm[14].y;
    },
    "YES": (lm) => {
        // Poing fermé (tous les doigts pliés) qui "hoche"
        return lm[8].y > lm[6].y && lm[12].y > lm[10].y && lm[16].y > lm[14].y && lm[20].y > lm[18].y;
    },
    "OK": (lm) => {
        // Index et Pouce forment un cercle, les 3 autres sont levés
        const circle = Math.hypot(lm[8].x - lm[4].x, lm[8].y - lm[4].y) < 0.05;
        return circle && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y;
    },
    "PLEASE": (lm) => {
        // Main plate sur la poitrine (on simule par une main plate très proche du centre)
        return lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[4].z > -0.05;
    },
    "THANKS": (lm) => {
        // Main plate partant du menton vers l'avant (Z-axis dynamique)
        return lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[0].z - lm[8].z > 0.1;
    },
    "STOP": (lm) => {
        // Main plate, paume très verticale et doigts serrés
        return lm[8].y < lm[6].y && lm[12].y < lm[10].y && Math.abs(lm[8].x - lm[20].x) < 0.15;
    },
    "PEACE": (lm) => {
        // Index et Majeur levés en V, les autres pliés
        return lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y > lm[14].y && lm[20].y > lm[18].y;
    }
};

const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12], [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20]
];

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
        statusBar.innerText = "System Ready";
    } catch (e) {
        statusBar.innerText = "Error loading AI";
    }
}
init();

async function predict() {
    if (video.readyState >= 2 && handLandmarker) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;

        const results = await handLandmarker.detectForVideo(video, performance.now());
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // 1. DESSINER LE SQUELETTE (Indépendant de la validation)
            drawHand(landmarks);

            // 2. TENTER LA VALIDATION (Dans un bloc sécurisé)
            try {
                const currentTarget = targetWordEl.innerText.toUpperCase();
                if (ASL_DATABASE[currentTarget] && ASL_DATABASE[currentTarget](landmarks)) {
                    if (canValidate) handleSuccess();
                }
            } catch (err) {
                console.log("Validation skip");
            }
        }
    }
    // Relance TOUJOURS la boucle
    window.requestAnimationFrame(predict);
}

function drawHand(landmarks) {
    const w = canvasElement.width;
    const h = canvasElement.height;

    // Traits
    canvasCtx.strokeStyle = "#8a2be2";
    canvasCtx.lineWidth = 4;
    canvasCtx.lineCap = "round";
    HAND_CONNECTIONS.forEach(([s, e]) => {
        if (landmarks[s] && landmarks[e]) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(landmarks[s].x * w, landmarks[s].y * h);
            canvasCtx.lineTo(landmarks[e].x * w, landmarks[e].y * h);
            canvasCtx.stroke();
        }
    });

    // Points
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
    
    // Effet visuel sur le container
    document.querySelector('.app-container').classList.add('success-flash');
    document.getElementById("feedback-pop").style.display = "block";

    setTimeout(() => {
        document.getElementById("feedback-pop").style.display = "none";
        document.querySelector('.app-container').classList.remove('success-flash');
        
        // Nouvelle cible aléatoire parmi les 10 signes
        const signs = Object.keys(ASL_DATABASE);
        const randomSign = signs[Math.floor(Math.random() * signs.length)];
        targetWordEl.innerText = randomSign;
        
        canValidate = true;
    }, 1500);
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    predict();
    document.getElementById("enableWebcamButton").style.display = "none";
});
