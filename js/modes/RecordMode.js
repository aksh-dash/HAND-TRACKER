import { BaseMode } from './BaseMode.js';

export class RecordMode extends BaseMode {
    constructor() {
        super('Record');
        this.recorder = null;
        this.chunks = [];
        this.isRecording = false;
        this.stream = null;
        this.countdown = 0;
    }
    
    init() {
        // Record the mainCanvas
        const canvas = document.getElementById('mainCanvas');
        this.stream = canvas.captureStream(30);
        this.recorder = new MediaRecorder(this.stream, { mimeType: 'video/webm' });
        this.recorder.ondataavailable = e => { if(e.data.size > 0) this.chunks.push(e.data); };
        this.recorder.onstop = () => {
            const blob = new Blob(this.chunks, { 'type' : 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'capture.webm';
            a.click();
            this.chunks = [];
        };
    }
    
    onFrame(ctx, width, height, handsData) {
        // To record video behind, we must draw the video onto the canvas.
        const video = document.querySelector('.input_video');
        // Because canvas is on top, we just manually draw video first to composite them
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(video, 0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
        
        if (handsData.length > 0) {
            const hand = handsData[0];
            if (hand.gesture.gesture === 'O' && hand.gesture.progress === 100) {
                if (!this.isRecording && this.countdown === 0) {
                    this.countdown = 180; // 3 seconds at 60fps
                    hand.gesture.gesture = "None"; // debounce hack
                } else if (this.isRecording) {
                    this.recorder.stop();
                    this.isRecording = false;
                    hand.gesture.gesture = "None";
                }
            }
        }
        
        if (this.countdown > 0) {
            this.countdown--;
            ctx.fillStyle = 'white';
            ctx.font = '100px Arial';
            ctx.fillText(Math.ceil(this.countdown / 60).toString(), width/2 - 30, height/2);
            if (this.countdown === 0) {
                this.recorder.start();
                this.isRecording = true;
            }
        }
        
        if (this.isRecording) {
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(40, 40, 15, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = '20px Arial';
            ctx.fillText("REC", 65, 47);
        }
    }
    
    destroy() {
        if (this.isRecording) this.recorder.stop();
    }
}
