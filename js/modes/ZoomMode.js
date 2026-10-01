import { BaseMode } from './BaseMode.js';

export class ZoomMode extends BaseMode {
    constructor() {
        super('Zoom');
        this.minSpread = Infinity;
        this.maxSpread = -Infinity;
        this.calibrating = false;
        this.calibrationTimer = 0;
        this.ui = null;
    }
    
    init() {
        this.ui = document.createElement('div');
        this.ui.className = 'panel';
        this.ui.style.position = 'absolute';
        this.ui.style.top = '20px';
        this.ui.style.right = '20px';
        this.ui.innerHTML = `
            <div style="margin-bottom:10px;"><b>Zoom Controls</b></div>
            <button id="z-recal" class="theme-btn" style="width:100%;">Recalibrate (3s)</button>
            <div id="z-status" style="margin-top:10px; color: yellow;">Needs Calibration</div>
        `;
        document.body.appendChild(this.ui);
        document.getElementById('ui-zoom-info').style.display = 'flex';
        
        document.getElementById('z-recal').onclick = () => {
            this.minSpread = Infinity;
            this.maxSpread = -Infinity;
            this.calibrating = true;
            this.calibrationTimer = 180; // 3 seconds at 60fps
            document.getElementById('z-status').innerText = 'Spread min->max!';
            document.getElementById('z-status').style.color = 'yellow';
        };
    }
    
    updateZoom(scale) {
        const container = document.querySelector('#zoom-container');
        container.style.transform = `scale(${scale})`; 
        document.getElementById('ui-zoom-val').innerText = `${scale.toFixed(1)}x`;
    }
    
    onFrame(ctx, width, height, handsData) {
        if (this.calibrating && this.calibrationTimer > 0) {
            this.calibrationTimer--;
            if (handsData.length > 0 && handsData[0].gesture.metrics.zoomArmed) {
                const spread = handsData[0].gesture.metrics.zoomSpread;
                this.minSpread = Math.min(this.minSpread, spread);
                this.maxSpread = Math.max(this.maxSpread, spread);
            }
            if (this.calibrationTimer === 0) {
                this.calibrating = false;
                document.getElementById('z-status').innerText = 'Ready! (Armed = Idx+Mid)';
                document.getElementById('z-status').style.color = '#00ffcc';
            }
            
            ctx.fillStyle = 'yellow';
            ctx.font = '30px Arial';
            ctx.fillText(`Calibrating: ${Math.ceil(this.calibrationTimer/60)}s`, width/2 - 100, 80);
            return;
        }

        if (handsData.length > 0) {
            const hand = handsData[0];
            if (hand.gesture.metrics.zoomArmed && !this.calibrating && this.maxSpread > this.minSpread) {
                const spread = hand.gesture.metrics.zoomSpread;
                // Direct mapping
                let zoom = 1.0 + 4.0 * (spread - this.minSpread) / (this.maxSpread - this.minSpread);
                zoom = Math.max(1.0, Math.min(5.0, zoom)); // hard clamp to 1x - 5x
                
                this.updateZoom(zoom);
                
                ctx.fillStyle = '#00ffcc';
                ctx.font = '30px Arial';
                ctx.fillText("ARMED", width/2 - 50, 80);
            }
        }
    }
    
    destroy() {
        if (this.ui) this.ui.remove();
        document.getElementById('ui-zoom-info').style.display = 'none';
        this.updateZoom(1.0);
    }
}
