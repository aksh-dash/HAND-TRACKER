import { BaseMode } from './BaseMode.js';

export class CustomMode extends BaseMode {
    constructor() {
        super('Custom');
        this.samples = [];
        this.trainingMode = false;
        this.ui = null;
    }
    
    init() {
        this.ui = document.createElement('div');
        this.ui.className = 'panel';
        this.ui.style.position = 'absolute';
        this.ui.style.top = '20px';
        this.ui.style.right = '20px';
        this.ui.innerHTML = `
            <div style="margin-bottom:10px;"><b>Custom Gestures</b></div>
            <button id="c-train" class="theme-btn">Train 5 Samples</button>
            <div id="c-status" style="margin-top:10px; font-size:12px;">Waiting...</div>
        `;
        document.body.appendChild(this.ui);
        
        document.getElementById('c-train').onclick = () => {
            this.samples = [];
            this.trainingMode = true;
            document.getElementById('c-status').innerText = 'Make gesture...';
        };
    }
    
    onFrame(ctx, width, height, handsData) {
        if (this.trainingMode && handsData.length > 0) {
            const norm = handsData[0].gesture.normLandmarks;
            // sample every 20 frames
            if (Math.random() < 0.05 && this.samples.length < 5) {
                this.samples.push(norm);
                document.getElementById('c-status').innerText = `Samples: ${this.samples.length}/5`;
                if (this.samples.length >= 5) {
                    this.trainingMode = false;
                    document.getElementById('c-status').innerText = 'Trained!';
                }
            }
        }
    }
    
    destroy() {
        if (this.ui) this.ui.remove();
    }
}
