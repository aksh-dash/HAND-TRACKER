import { BaseMode } from './BaseMode.js';
import { bridge } from '../Bridge.js';

export class MouseMode extends BaseMode {
    constructor() {
        super('Mouse');
        this.lastPinch = false;
    }
    
    onFrame(ctx, width, height, handsData) {
        if (handsData.length > 0) {
            const pt = handsData[0].landmarks[8];
            
            // Map index finger to screen, mirroring X
            const mouseX = 1.0 - pt.x;
            const mouseY = pt.y;
            bridge.send({action: 'mouse_move', x: mouseX, y: mouseY});
            
            const pinch = handsData[0].gesture.gesture === 'Pinch';
            if (pinch && !this.lastPinch) {
                bridge.send({action: 'mouse_click'});
            }
            this.lastPinch = pinch;
            
            ctx.beginPath();
            ctx.arc(pt.x * width, pt.y * height, 10, 0, Math.PI*2);
            ctx.fillStyle = pinch ? 'rgba(255,0,0,0.8)' : 'rgba(0,255,204,0.8)';
            ctx.fill();
        }
    }
}
