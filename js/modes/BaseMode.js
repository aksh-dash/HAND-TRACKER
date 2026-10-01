export class BaseMode {
    constructor(name) {
        this.name = name;
    }
    init() { console.log(`[Mode] ${this.name} initialized.`); }
    onFrame(ctx, width, height, handsData) {}
    destroy() { console.log(`[Mode] ${this.name} destroyed.`); }
}
