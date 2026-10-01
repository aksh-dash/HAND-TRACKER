import { OneEuroFilter } from './OneEuroFilter.js';
import { GestureClassifier } from './GestureClassifier.js';
import { ModeManager } from './ModeManager.js';
import { DetectMode } from './modes/DetectMode.js';
import { BoardMode } from './modes/BoardMode.js';
import { MediaMode } from './modes/MediaMode.js';
import { ZoomMode } from './modes/ZoomMode.js';
import { RecordMode } from './modes/RecordMode.js';
import { MouseMode } from './modes/MouseMode.js';
import { PresentMode } from './modes/PresentMode.js';
import { CustomMode } from './modes/CustomMode.js';

// Setup Globals
const videoElement = document.querySelector('.input_video');
const bgCanvas = document.getElementById('bgCanvas');
const mainCanvas = document.getElementById('mainCanvas');
const bgCtx = bgCanvas.getContext('2d');
const ctx = mainCanvas.getContext('2d');
const container = document.getElementById('zoom-container');

// HUD Elements
const uiHands = document.getElementById('ui-hands');
const uiFps = document.getElementById('ui-fps');
const uiDetectFps = document.getElementById('ui-detect-fps');
const uiLatency = document.getElementById('ui-latency');
const uiGesture = document.getElementById('ui-gesture');
const uiConf = document.getElementById('ui-confidence');
const timerRing = document.getElementById('ui-timer-ring');
const uiPinchFill = document.getElementById('ui-pinch-fill');
const uiPinchText = document.getElementById('ui-pinch-text');
const showSkeletonCheckbox = document.getElementById('ui-show-skeleton');
const debugCheckbox = document.getElementById('ui-debug');

// FIX 1: SINGLE COORDINATE MAPPER
export function toScreen(landmark) {
    const rect = container.getBoundingClientRect();
    const vw = videoElement.videoWidth || 1280;
    const vh = videoElement.videoHeight || 720;
    const cw = rect.width;
    const ch = rect.height;
    
    // object-fit: cover logic
    const scale = Math.max(cw / vw, ch / vh);
    const renderW = vw * scale;
    const renderH = vh * scale;
    const offX = (cw - renderW) / 2;
    const offY = (ch - renderH) / 2;
    
    // Mirror X (1 - landmark.x)
    const x = offX + (1 - landmark.x) * renderW;
    const y = offY + landmark.y * renderH;
    
    const dpr = window.devicePixelRatio || 1;
    return { x: x * dpr, y: y * dpr, rawX: x, rawY: y };
}

function resize() {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    bgCanvas.width = rect.width * dpr;
    bgCanvas.height = rect.height * dpr;
    mainCanvas.width = rect.width * dpr;
    mainCanvas.height = rect.height * dpr;
    
    // CSS size matches container
    bgCanvas.style.width = `${rect.width}px`;
    bgCanvas.style.height = `${rect.height}px`;
    mainCanvas.style.width = `${rect.width}px`;
    mainCanvas.style.height = `${rect.height}px`;
}

window.addEventListener('resize', resize);
videoElement.addEventListener('loadedmetadata', resize);
resize();

let framesThisSecond = 0;
let lastFpsTime = performance.now();
let detectFramesThisSec = 0;
let detectLastFpsTime = performance.now();
let latestCaptureTime = 0;
export let lastDetectionTimestamp = 0;

const modeManager = new ModeManager();
const gestureClassifiers = [new GestureClassifier(), new GestureClassifier()];
// Light filtering for continuous interactions
const filters = [new OneEuroFilter(0.1, 0.8), new OneEuroFilter(0.1, 0.8)];

modeManager.register('Detect', new DetectMode());
modeManager.register('Board', new BoardMode());
modeManager.register('Media', new MediaMode());
modeManager.register('Zoom', new ZoomMode());
modeManager.register('Record', new RecordMode());
modeManager.register('Mouse', new MouseMode());
modeManager.register('Present', new PresentMode());
modeManager.register('Custom', new CustomMode());
modeManager.switchMode('Detect');

let latestHandsData = [];
export let processedHands = [];

function setTimerRing(percentage) {
    if(timerRing) timerRing.style.background = `conic-gradient(var(--accent) ${percentage}%, transparent 0%)`;
}

// MediaPipe setup
const hands = new window.Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });

hands.onResults((results) => {
    detectFramesThisSec++;
    const now = performance.now();
    if (now > detectLastFpsTime + 1000) {
        uiDetectFps.innerText = detectFramesThisSec;
        detectFramesThisSec = 0;
        detectLastFpsTime = now;
    }
    
    latestHandsData = results.multiHandLandmarks || [];
    processedHands = [];
    
    const vw = videoElement.videoWidth || 1280;
    const vh = videoElement.videoHeight || 720;

    latestHandsData.forEach((hand, idx) => {
        if (!filters[idx]) filters[idx] = new OneEuroFilter(0.1, 0.8);
        const t = now / 1000.0;
        const flatHand = hand.flatMap(lm => [lm.x, lm.y, lm.z]);
        const filteredFlat = filters[idx].filter(flatHand, t);
        
        const smoothedHand = [];
        for (let i = 0; i < filteredFlat.length; i += 3) {
            smoothedHand.push({ x: filteredFlat[i], y: filteredFlat[i+1], z: filteredFlat[i+2] });
        }

        if (!gestureClassifiers[idx]) gestureClassifiers[idx] = new GestureClassifier();
        const gestData = gestureClassifiers[idx].classify(smoothedHand, vw, vh);
        processedHands.push({ landmarks: smoothedHand, gesture: gestData, raw: hand });
    });
});

// requestVideoFrameCallback Loop
let rVfcActive = false;
const processVideo = async (now, metadata) => {
    latestCaptureTime = metadata.expectedDisplayTime || performance.now();
    lastDetectionTimestamp = metadata.presentationTime || performance.now();
    await hands.send({image: videoElement});
    if (rVfcActive) videoElement.requestVideoFrameCallback(processVideo);
};

// Render Loop
function renderLoop(timestamp) {
    requestAnimationFrame(renderLoop);
    
    const now = performance.now();
    framesThisSecond++;
    if (now > lastFpsTime + 1000) {
        uiFps.innerText = framesThisSecond;
        framesThisSecond = 0;
        lastFpsTime = now;
    }

    if (processedHands.length > 0) {
        const latency = Math.round(now - latestCaptureTime);
        uiLatency.innerText = latency + " ms";
    }

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, rect.width * dpr, rect.height * dpr);
    
    // Skeleton
    if (showSkeletonCheckbox && showSkeletonCheckbox.checked) {
        processedHands.forEach((handObj) => {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            [4, 8, 12, 16, 20].forEach(tip => {
                const pt = toScreen(handObj.landmarks[tip]);
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 4 * dpr, 0, Math.PI * 2);
                ctx.fill();
            });
        });
    }

    // Debug Crosshair
    if (debugCheckbox && debugCheckbox.checked) {
        processedHands.forEach(handObj => {
            const pt = toScreen(handObj.landmarks[8]);
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2 * dpr;
            ctx.beginPath();
            ctx.moveTo(pt.x - 20*dpr, pt.y); ctx.lineTo(pt.x + 20*dpr, pt.y);
            ctx.moveTo(pt.x, pt.y - 20*dpr); ctx.lineTo(pt.x, pt.y + 20*dpr);
            ctx.stroke();
            ctx.fillStyle = 'white';
            ctx.font = `${14*dpr}px Arial`;
            ctx.fillText(`(${Math.round(pt.rawX)}, ${Math.round(pt.rawY)})`, pt.x + 10*dpr, pt.y - 10*dpr);
        });
    }

    // HUD Update
    uiHands.innerText = processedHands.length;
    if (processedHands.length > 0) {
        const primary = processedHands[0].gesture;
        uiGesture.innerText = primary.gesture;
        uiConf.innerText = Math.round(primary.confidence * 100) + "%";
        setTimerRing(primary.progress);
        if (uiPinchFill) {
            uiPinchFill.style.width = Math.min(100, (primary.metrics.pinchRatio / 0.6) * 100) + "%"; 
        }
        if (uiPinchText) {
            uiPinchText.innerText = primary.isPinching ? "PINCHING" : "OPEN";
            uiPinchText.style.color = primary.isPinching ? "lime" : "white";
        }
    } else {
        uiGesture.innerText = "None";
        uiConf.innerText = "0%";
        setTimerRing(0);
        if (uiPinchFill) uiPinchFill.style.width = "0%";
        if (uiPinchText) { uiPinchText.innerText = "OPEN"; uiPinchText.style.color = "white"; }
    }

    modeManager.onFrame(ctx, rect.width * dpr, rect.height * dpr, processedHands);
}

document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('startOverlay').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('modes-bar').classList.remove('hidden');
    
    const startCam = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({video: {width: 1280, height: 720}});
        videoElement.srcObject = stream;
        videoElement.play();
        rVfcActive = true;
        if ('requestVideoFrameCallback' in videoElement) {
            videoElement.requestVideoFrameCallback(processVideo);
        } else {
            setInterval(() => processVideo(performance.now(), {}), 1000/30);
        }
    };
    startCam();
    requestAnimationFrame(renderLoop);
});
