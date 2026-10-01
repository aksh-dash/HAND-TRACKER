export class GestureClassifier {
    constructor() {
        this.lastGesture = "None";
        this.candidateGesture = "None";
        this.gestureFrames = 0;
        this.debounceThreshold = 10;
        this.lastPinchState = false;
    }

    getDistance(p1, p2) {
        return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    classify(landmarks, videoWidth, videoHeight) {
        if (!landmarks || landmarks.length === 0) return { gesture: "None", progress: 0 };
        
        // FIX 2: Aspect-ratio corrected pixel space distances for pinch
        const vw = videoWidth || 1280;
        const vh = videoHeight || 720;
        
        const pxWrist = { x: landmarks[0].x * vw, y: landmarks[0].y * vh };
        const pxMidMcp = { x: landmarks[9].x * vw, y: landmarks[9].y * vh };
        const pxThumbTip = { x: landmarks[4].x * vw, y: landmarks[4].y * vh };
        const pxIndexTip = { x: landmarks[8].x * vw, y: landmarks[8].y * vh };
        
        const palmSizePx = this.getDistance(pxWrist, pxMidMcp) || 1;
        const pinchDistPx = this.getDistance(pxThumbTip, pxIndexTip);
        const pinchRatio = pinchDistPx / palmSizePx;
        
        // Enforce Exit >= Enter + 0.05
        let pinchEnter = window.PINCH_ENTER || 0.30;
        let pinchExit = window.PINCH_EXIT || 0.45;
        if (pinchExit < pinchEnter + 0.05) pinchExit = pinchEnter + 0.05;
        
        const wasPinching = this.lastPinchState;
        this.lastPinchState = pinchRatio < (this.lastPinchState ? pinchExit : pinchEnter);
        if (wasPinching !== this.lastPinchState) {
            console.log(`[Pinch Detection] State changed to ${this.lastPinchState ? 'PINCHING' : 'OPEN'} (Ratio: ${pinchRatio.toFixed(3)})`);
        }

        // Wrist-relative normalization for standard gestures
        const wrist = landmarks[0];
        let relative = landmarks.map(lm => ({ x: lm.x - wrist.x, y: lm.y - wrist.y, z: lm.z - wrist.z }));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        relative.forEach(lm => { minX=Math.min(minX,lm.x); minY=Math.min(minY,lm.y); maxX=Math.max(maxX,lm.x); maxY=Math.max(maxY,lm.y); });
        const scale = Math.max(maxX - minX, maxY - minY) || 1;
        const norm = relative.map(lm => ({ x: lm.x/scale, y: lm.y/scale, z: lm.z/scale }));
        const palmSizeNorm = this.getDistance(norm[0], norm[9]) || 1;

        // ZOOM GESTURE ARMED
        const indexUp = this.getDistance(norm[8], norm[0]) > this.getDistance(norm[6], norm[0]);
        const middleUp = this.getDistance(norm[12], norm[0]) > this.getDistance(norm[10], norm[0]);
        const ringUp = this.getDistance(norm[16], norm[0]) > this.getDistance(norm[14], norm[0]);
        const pinkyUp = this.getDistance(norm[20], norm[0]) > this.getDistance(norm[18], norm[0]);
        const zoomArmed = indexUp && middleUp && !ringUp && !pinkyUp;
        const zoomSpread = zoomArmed ? this.getDistance(norm[8], norm[12]) / palmSizeNorm : 0;

        // EXCLUSIVE GESTURE CLASSIFIER
        let fingersUp = (indexUp?1:0) + (middleUp?1:0) + (ringUp?1:0) + (pinkyUp?1:0);
        if (this.getDistance(norm[4], norm[17]) > this.getDistance(norm[3], norm[17])) fingersUp++;

        const spread = this.getDistance(norm[8], norm[20]);
        const isGrabbing = this.getDistance(norm[12], norm[0]) < (this.lastGesture === "Grab" ? 0.25 : 0.15) && fingersUp <= 1;
        
        // FIX 4: "O" requires pinch AND other three extended
        const isO = this.lastPinchState && middleUp && ringUp && pinkyUp;

        let scores = { "None": 0.1 };
        if (isO) scores["O"] = 1.0;
        else if (isGrabbing) scores["Grab"] = 1.0;
        else if (fingersUp === 0) scores["Fist"] = 1.0;
        else if (fingersUp === 5) scores[spread < 0.3 ? "Flat Palm" : "Open Palm"] = 1.0;
        else if (zoomArmed) scores["2 Fingers"] = 1.0;
        else if (indexUp && !middleUp && !ringUp && !pinkyUp) scores["Pointing"] = 1.0;
        else scores[fingersUp + " Fingers"] = 0.8;

        let sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);
        let rawGesture = sorted[0][0];
        let conf = sorted[0][1] - (sorted.length > 1 ? sorted[1][1] : 0);

        if (rawGesture === this.candidateGesture) this.gestureFrames++;
        else { this.candidateGesture = rawGesture; this.gestureFrames = 1; }
        if (this.gestureFrames >= this.debounceThreshold) this.lastGesture = rawGesture;

        return {
            gesture: this.lastGesture,
            candidate: this.candidateGesture,
            progress: Math.min(100, Math.round((this.gestureFrames / this.debounceThreshold) * 100)),
            confidence: Math.max(0, Math.min(1.0, conf)),
            metrics: { pinchRatio, zoomArmed, zoomSpread },
            normLandmarks: norm,
            isPinching: this.lastPinchState
        };
    }
}
