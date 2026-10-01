import { BaseMode } from './BaseMode.js';
import { bridge } from '../Bridge.js';

export class MediaMode extends BaseMode {
    constructor() {
        super('Media');
        this.startY = 0;
        this.startVol = 0.5;
        this.startBright = 50;
        this.lastX = 0;
        this.swipeCooldown = 0;
    }
    
    onFrame(ctx, width, height, handsData) {
        if (this.swipeCooldown > 0) this.swipeCooldown--;
        
        if (handsData.length > 0) {
            const hand = handsData[0];
            const pt = hand.landmarks[8]; // index finger
            const y = pt.y;
            const x = pt.x;
            
            // Volume logic
            if (hand.gesture.gesture === 'Pinch') {
                if (hand.gesture.candidate === 'Pinch' && hand.gesture.progress === 100) {
                    let dy = this.startY - y;
                    let vol = this.startVol + dy * 1.5;
                    vol = Math.max(0, Math.min(1, vol));
                    bridge.send({action: 'volume', value: vol});
                    
                    // Render Volume slider
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(width - 40, height/2 - 100, 15, 200);
                    ctx.fillStyle = '#00ffcc';
                    ctx.fillRect(width - 40, height/2 + 100 - vol*200, 15, vol*200);
                    ctx.fillText("Vol", width - 40, height/2 + 120);
                } else {
                    this.startY = y;
                }
            } else {
                this.startY = y;
            }
            
            // Swipe logic (Next/Prev track)
            let dx = x - this.lastX;
            if (this.swipeCooldown === 0 && Math.abs(dx) > 0.05 && hand.gesture.gesture === 'Open Palm') {
                if (dx > 0) {
                    bridge.send({action: 'media', command: 'nexttrack'});
                    this.showIndicator(ctx, width, height, "Next Track ->");
                } else {
                    bridge.send({action: 'media', command: 'prevtrack'});
                    this.showIndicator(ctx, width, height, "<- Prev Track");
                }
                this.swipeCooldown = 30; // ~0.5s at 60fps
            }
            this.lastX = x;
            
            // Circle motion = repeat could go here (skipped for brevity)
        }
    }
    
    showIndicator(ctx, width, height, text) {
        ctx.fillStyle = 'white';
        ctx.font = '30px Arial';
        ctx.fillText(text, width/2 - 50, height/2);
    }
}
