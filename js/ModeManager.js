export class ModeManager {
    constructor() {
        this.modes = {};
        this.currentMode = null;
        this.uiContainer = document.getElementById('modes-bar');
    }

    register(name, modeInstance) {
        this.modes[name] = modeInstance;
        
        const btn = document.createElement('button');
        btn.className = 'theme-btn';
        btn.innerText = name;
        btn.onclick = () => this.switchMode(name);
        this.uiContainer.appendChild(btn);
    }

    switchMode(name) {
        if (this.currentMode && this.modes[this.currentMode]) {
            this.modes[this.currentMode].destroy();
        }
        
        Array.from(this.uiContainer.children).forEach(btn => {
            if (btn.innerText === name) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        this.currentMode = name;
        document.getElementById('ui-mode').innerText = name;
        
        if (this.modes[name]) {
            this.modes[name].init();
        }
    }

    onFrame(ctx, width, height, handsData) {
        if (this.currentMode && this.modes[this.currentMode]) {
            this.modes[this.currentMode].onFrame(ctx, width, height, handsData);
        }
    }
}
