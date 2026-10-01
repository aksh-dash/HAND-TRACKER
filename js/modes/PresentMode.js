import { BaseMode } from './BaseMode.js';
import { bridge } from '../Bridge.js';

export class PresentMode extends BaseMode {
    constructor() {
        super('Present');
        this.cooldown = 0;
        this.lastX = 0;
    }
    
    onFrame(ctx, width, height, handsData) {
        if (this.cooldown > 0) this.cooldown--;
        
        if (handsData.length > 0) {
            const hand = handsData[0];
            const pt = hand.landmarks[8];
            
            if (hand.gesture.gesture === 'Pointing') {
                ctx.beginPath();
                ctx.arc(pt.x * width, pt.y * height, 8, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'red';
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            
            let dx = pt.x - this.lastX;
            if (this.cooldown === 0 && Math.abs(dx) > 0.05 && hand.gesture.gesture === 'Open Palm') {
                if (dx > 0) {
                    bridge.send({action: 'key', key: 'right'});
                } else {
                    bridge.send({action: 'key', key: 'left'});
                }
                this.cooldown = 30;
            }
            this.lastX = pt.x;
        }
    }
}
