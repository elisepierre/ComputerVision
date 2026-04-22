import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const targetWordEl = document.getElementById("target-word");
const scoreEl = document.getElementById("score");

let handLandmarker;
let GE;
let score = 0;
let canValidate = true; // Pour éviter de gagner 100 points d'un coup

// 1. DÉFINITIONS DES GESTES
const initGestures = () => {
    GE = new fp.GestureEstimator([]);

    // Geste universel "Main Plate" pour HELLO et THANK YOU
    // C'est le plus simple à reconnaître : aucun doigt plié.
    const flatHand = new fp.GestureDescription('THANK YOU');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky, fp.Finger.Thumb]) {
        flatHand.addCurl(finger, fp.FingerCurl.NoCurl, 1.0); 
    }
    
    // On l'ajoute pour les trois mots pour être sûr que tu puisses gagner ton point
    GE.addGesture(flatHand);
    
    // On crée une copie pour HELLO
    const helloHand = fp.GestureDescription.copy(flatHand);
    helloHand.name = "HELLO";
    GE.addGesture(helloHand);

    const byeHand = fp.GestureDescription.copy(flatHand);
    byeHand.name = "GOODBYE";
    GE.addGesture(byeHand);
};

async function loadModels() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
        runningMode: "VIDEO", numHands: 1
    });
    initGestures();
    console.log("Modèles et Gestes chargés !");
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
        
        // --- DESSIN DES POINTS BLANCS ---
        canvasCtx.fillStyle = "white";
        for (const point of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 4, 0, 2 * Math.PI);
            canvasCtx.fill();
        }

        // --- RECONNAISSANCE ---
        const pixelLandmarks = landmarks.map(l => [l.x * canvasElement.width, l.y * canvasElement.height, l.z]);
        const estimated = await GE.estimate(pixelLandmarks, 6.5); 

        if (estimated.gestures.length > 0) {
            const best = estimated.gestures.reduce((p, c) => (p.score > c.score) ? p : c);
            
            // --- DÉBUGGER VISUEL ---
            canvasCtx.fillStyle = "#00ffcc";
            canvasCtx.font = "bold 24px Arial";
            canvasCtx.fillText("IA SEES: " + best.name + " (" + Math.round(best.score) + "/10)", 20, 40);

            // Vérification simple (on compare le nom en majuscules)
            const target = targetWordEl.innerText.toUpperCase().trim();
            if (best.name.toUpperCase() === target && canValidate) {
                handleSuccess();
            }
        }
    }
}

function handleSuccess() {
    canValidate = false; // Bloque la validation
    score++;
    scoreEl.innerText = score;
    
    document.getElementById("feedback-pop").style.display = "block";
    
    setTimeout(() => { 
        document.getElementById("feedback-pop").style.display = "none";
        
        // Nouveau mot aléatoire
        const words = ["HELLO", "GOODBYE", "THANK YOU"];
        let nextWord;
        do {
            nextWord = words[Math.floor(Math.random() * words.length)];
        } while (nextWord === targetWordEl.innerText);
        
        targetWordEl.innerText = nextWord;
        canValidate = true; // Débloque pour le prochain mot
    }, 2000); // 2 secondes de pause pour changer de position
}

document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    setInterval(runDetection, 50); // Un peu plus lent (50ms) pour laisser souffler le processeur
    document.getElementById("enableWebcamButton").style.display = "none";
});
