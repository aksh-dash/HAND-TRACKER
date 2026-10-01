import { BaseMode } from './BaseMode.js';

export class DetectMode extends BaseMode {
    constructor() { super('Detect'); }
    
    // Skeleton drawing is now handled globally in main.js via the settings toggle.
    // DetectMode becomes a purely clean visualization of the base layout.
    onFrame(ctx, width, height, handsData) {}
}
