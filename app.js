// Extrait de la logique dans app.js
async function predictWebcam() {
    let results = await handLandmarker.detectForVideo(video, timestamp);
    
    if (results.landmarks.length > 0) {
        let currentCoords = normalize(results.landmarks[0]);
        buffer.push(currentCoords);
        
        if (buffer.length === 40) {
            let dist = compare(buffer, database[targetWord]);
            if (dist < threshold) {
                showSuccessAnimation();
                nextWord();
            }
        }
    }
}
