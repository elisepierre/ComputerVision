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

// 1. DÉFINITION DES SIGNES (HELLO, GOODBYE, THANK YOU)
const initGestures = () => {
    GE = new fp.GestureEstimator([]);

    // --- SIGNE : HELLO ---
    const hello = new fp.GestureDescription('HELLO');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        hello.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    hello.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
    GE.addGesture(hello);

    // --- SIGNE : GOODBYE (Similaire à Hello mais souvent avec un léger mouvement/inclinaison) ---
    const goodbye = new fp.GestureDescription('GOODBYE');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        goodbye.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    goodbye.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
    // On différencie Goodbye par l'orientation (souvent vers l'avant/horizontal)
    goodbye.addDirection(fp.Finger.Index, fp.FingerDirection.HorizontalLeft, 0.70);
    goodbye.addDirection(fp.Finger.Index, fp.FingerDirection.HorizontalRight, 0.70);
    GE.addGesture(goodbye);

    // --- SIGNE : THANK YOU (Main plate qui part de la bouche vers l'avant) ---
    const thankYou = new fp.GestureDescription('THANK YOU');
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        thankYou.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    thankYou.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
    // Signe souvent incliné vers l'avant
    thankYou.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpRight, 0.70);
    thankYou.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpLeft, 0.70);
    GE.addGesture(thankYou);
};

// 2. CHARGEMENT DES MODÈLES
async function loadModels() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { 
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU" 
        },
        runningMode: "VIDEO", numHands: 1
    });
    initGestures();
    statusBar.innerText = "IA Coach Ready!";
}
loadModels();

// 3. BOUCLE DE DÉTECTION
async function runDetection() {
    if (!handLandmarker || video.paused || video.readyState < 2) return;

    canvasElement.width = video.clientWidth;
    canvasElement.height = video.clientHeight;

    const results = await handLandmarker.detectForVideo(video, performance.now());
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // Dessin des points blancs (Ton script Python style)
        canvasCtx.fillStyle = "white";
        for (const point of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 4, 0, 2 * Math.PI);
            canvasCtx.fill();
        }

        // --- RECONNAISSANCE ---
        const pixelLandmarks = landmarks.map(l => [l.x * canvasElement.width, l.y * canvasElement.height, l.z]);
        const estimated = await GE.estimate(pixelLandmarks, 7.5); // 7.5 est la confiance minimale
        
        if (estimated.gestures.length > 0) {
            const best = estimated.gestures.reduce((p, c) => (p.score > c.score) ? p : c);
            const currentTarget = targetWordEl.innerText.trim().toUpperCase();
            
            console.log("Geste détecté :", best.name); // Pour t'aider à débugger

            if (best.name.toUpperCase() === currentTarget) {
                handleSuccess();
            }
        }
    }
}

// 4. LOGIQUE DE RÉUSSITE ET CHANGEMENT ALÉATOIRE
function handleSuccess() {
    // Éviter de valider 10 fois par seconde pendant que le geste est maintenu
    if (document.getElementById("feedback-pop").style.display === "block") return;

    score++;
    scoreEl.innerText = score;
    
    // Affichage du message de succès
    const pop = document.getElementById("feedback-pop");
    pop.style.display = "block";

    setTimeout(() => { 
        pop.style.display = "none";
        
        // CHOIX ALÉATOIRE D'UN NOUVEAU MOT
        const words = ["HELLO", "GOODBYE", "THANK YOU"];
        // On s'assure de ne pas retomber sur le même mot immédiatement
        let newWord;
        do {
            newWord = words[Math.floor(Math.random() * words.length)];
        } while (newWord === targetWordEl.innerText);
        
        targetWordEl.innerText = newWord;
    }, 1500); // 1.5 sec de pause pour que l'utilisateur puisse baisser sa main
}

// 5. BOUTON START
document.getElementById("enableWebcamButton").addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    video.play();
    setInterval(runDetection, 30); // 30ms pour garder la fluidité
    document.getElementById("enableWebcamButton").style.display = "none";
});
