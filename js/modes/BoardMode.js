import { BaseMode } from './BaseMode.js';
import { toScreen, lastDetectionTimestamp } from '../main.js';
import { OneEuroFilter } from '../OneEuroFilter.js';

export class BoardMode extends BaseMode {
    constructor() {
        super('Board');
        this.paths = [];
        this.currentPath = null;
        this.boardCanvas = document.createElement('canvas');
        this.bCtx = this.boardCanvas.getContext('2d');
        this.ui = null;
        this.color = '#00ffcc';
        this.brushSize = 4;
        
        // FIX 3: Ink timing and filtering
        this.lastProcessedTimestamp = -1;
        this.inkFilterX = new OneEuroFilter(1.5, 0.05); // min_cutoff=1.5, beta=0.05
        this.inkFilterY = new OneEuroFilter(1.5, 0.05);
        this.latencyComp = 0; // ms
        this.lastFilteredPt = null;
    }
    
    init() {
        const resizeBoard = () => {
            const container = document.getElementById('zoom-container');
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.boardCanvas.width = rect.width * dpr;
            this.boardCanvas.height = rect.height * dpr;
            this.boardCanvas.style.width = `${rect.width}px`;
            this.boardCanvas.style.height = `${rect.height}px`;
        };
        resizeBoard();
        window.addEventListener('resize', resizeBoard);
        
        this.ui = document.createElement('div');
        this.ui.className = 'panel';
        this.ui.style.position = 'absolute';
        this.ui.style.top = '20px';
        this.ui.style.right = '20px';
        this.ui.style.zIndex = '100';
        this.ui.innerHTML = `
            <div style="margin-bottom:10px;"><b>Board Controls</b></div>
            <button id="b-clear" class="theme-btn" style="margin-bottom:5px; width:100%;">Clear</button>
            <button id="b-undo" class="theme-btn" style="margin-bottom:5px; width:100%;">Undo</button>
            <div style="margin-top:5px; display:flex; justify-content:space-between;">
                <label>Color</label><input type="color" id="b-color" value="#00ffcc">
            </div>
            <div style="margin-top:5px;">
                <label>Size</label><input type="range" id="b-size" min="1" max="20" value="4">
            </div>
            <div style="margin-top:5px;">
                <label>Pinch Enter (<span id="pe-val">0.30</span>)</label><br>
                <input type="range" id="b-enter" min="0.1" max="1.0" step="0.05" value="0.30">
            </div>
            <div style="margin-top:5px;">
                <label>Pinch Exit (<span id="px-val">0.45</span>)</label><br>
                <input type="range" id="b-exit" min="0.1" max="1.0" step="0.05" value="0.45">
            </div>
            <div style="margin-top:5px;">
                <label>Latency Comp (<span id="lc-val">0</span>ms)</label><br>
                <input type="range" id="b-lat" min="0" max="40" step="1" value="0">
            </div>
            <div style="margin-top:5px;">
                <label>Trigger</label>
                <select id="b-trigger" style="background:#333; color:white; border:none; padding:4px;"><option value="pinch">Pinch</option><option value="point">Point</option></select>
            </div>
            <button id="b-export" class="theme-btn" style="margin-top:10px; width:100%;">Export PNG</button>
        `;
        document.body.appendChild(this.ui);
        
        document.getElementById('b-clear').onclick = () => { this.paths = []; this.bCtx.clearRect(0,0,this.boardCanvas.width,this.boardCanvas.height); };
        document.getElementById('b-undo').onclick = () => { this.paths.pop(); };
        document.getElementById('b-color').onchange = (e) => this.color = e.target.value;
        document.getElementById('b-size').onchange = (e) => this.brushSize = e.target.value;
        
        document.getElementById('b-enter').onchange = (e) => { 
            window.PINCH_ENTER = parseFloat(e.target.value); 
            document.getElementById('pe-val').innerText = window.PINCH_ENTER.toFixed(2); 
            if ((window.PINCH_EXIT || 0.45) < window.PINCH_ENTER + 0.05) {
                window.PINCH_EXIT = window.PINCH_ENTER + 0.05;
                document.getElementById('b-exit').value = window.PINCH_EXIT;
                document.getElementById('px-val').innerText = window.PINCH_EXIT.toFixed(2);
            }
        };
        document.getElementById('b-exit').onchange = (e) => { 
            window.PINCH_EXIT = parseFloat(e.target.value); 
            if (window.PINCH_EXIT < (window.PINCH_ENTER || 0.30) + 0.05) {
                window.PINCH_EXIT = (window.PINCH_ENTER || 0.30) + 0.05;
                e.target.value = window.PINCH_EXIT;
            }
            document.getElementById('px-val').innerText = window.PINCH_EXIT.toFixed(2);
        };
        document.getElementById('b-lat').onchange = (e) => { 
            this.latencyComp = parseInt(e.target.value); 
            document.getElementById('lc-val').innerText = e.target.value; 
        };
        
        // Init globals if not set
        if (!window.PINCH_ENTER) window.PINCH_ENTER = 0.30;
        if (!window.PINCH_EXIT) window.PINCH_EXIT = 0.45;
    }
    
    onFrame(ctx, width, height, handsData) {
        const triggerMode = this.ui ? document.getElementById('b-trigger').value : 'pinch';
        const dpr = window.devicePixelRatio || 1;
        let cursorPt = null;
        let isDrawing = false;
        let isEraser = false;

        if (handsData.length > 0) {
            const hand = handsData[0];
            const thumb = toScreen(hand.landmarks[4]);
            const index = toScreen(hand.landmarks[8]);
            
            isEraser = hand.gesture.gesture === 'Flat Palm';
            isDrawing = !isEraser && ((triggerMode === 'pinch') ? hand.gesture.isPinching : (hand.gesture.gesture === 'Pointing'));
            
            let rawPt = { x: (thumb.x + index.x)/2, y: (thumb.y + index.y)/2 };
            if (triggerMode === 'point') rawPt = index;
            
            // Only add points strictly when a new detection arrives
            if (lastDetectionTimestamp !== this.lastProcessedTimestamp) {
                this.lastProcessedTimestamp = lastDetectionTimestamp;
                const t = performance.now() / 1000.0;
                
                if (isDrawing && !this.currentPath) {
                    this.inkFilterX = new OneEuroFilter(1.5, 0.05);
                    this.inkFilterY = new OneEuroFilter(1.5, 0.05);
                }
                
                const fX = this.inkFilterX.filter([rawPt.x], t)[0];
                const fY = this.inkFilterY.filter([rawPt.y], t)[0];
                
                // Latency compensation (velocity * time)
                let ex = fX, ey = fY;
                if (this.latencyComp > 0 && this.inkFilterX.dxPrev) {
                    ex = fX + this.inkFilterX.dxPrev[0] * (this.latencyComp / 1000.0);
                    ey = fY + this.inkFilterY.dxPrev[0] * (this.latencyComp / 1000.0);
                }
                
                this.lastFilteredPt = { x: ex, y: ey };

                if (isDrawing) {
                    if (!this.currentPath) {
                        this.currentPath = { points: [this.lastFilteredPt], color: this.color, size: this.brushSize * dpr };
                        this.paths.push(this.currentPath);
                    } else {
                        const last = this.currentPath.points[this.currentPath.points.length-1];
                        if (Math.hypot(this.lastFilteredPt.x - last.x, this.lastFilteredPt.y - last.y) > 1 * dpr) {
                            this.currentPath.points.push(this.lastFilteredPt);
                        }
                    }
                } else {
                    this.currentPath = null;
                }
                
                if (isEraser) {
                    const eraseRad = 40 * dpr;
                    this.paths = this.paths.map(path => {
                        return { ...path, points: path.points.filter(p => Math.hypot(p.x - rawPt.x, p.y - rawPt.y) > eraseRad) };
                    }).filter(path => path.points.length > 0);
                }
            }
            cursorPt = this.lastFilteredPt || rawPt;
        } else {
            this.currentPath = null;
        }
        
        // Full redraw of paths via quadratic curves
        this.bCtx.clearRect(0,0,width,height);
        this.paths.forEach(path => {
            if (path.points.length < 2) return;
            this.bCtx.strokeStyle = path.color;
            this.bCtx.lineWidth = path.size;
            this.bCtx.lineCap = 'round';
            this.bCtx.lineJoin = 'round';
            this.bCtx.beginPath();
            this.bCtx.moveTo(path.points[0].x, path.points[0].y);
            
            let i = 1;
            for (; i < path.points.length - 1; i++) {
                let xc = (path.points[i].x + path.points[i+1].x) / 2;
                let yc = (path.points[i].y + path.points[i+1].y) / 2;
                this.bCtx.quadraticCurveTo(path.points[i].x, path.points[i].y, xc, yc);
            }
            this.bCtx.lineTo(path.points[i].x, path.points[i].y);
            this.bCtx.stroke();
        });
        
        ctx.drawImage(this.boardCanvas, 0, 0);
        
        if (cursorPt) {
            ctx.beginPath();
            if (isEraser) {
                ctx.arc(cursorPt.x, cursorPt.y, 40 * dpr, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2 * dpr;
                ctx.stroke();
            } else if (isDrawing) {
                ctx.arc(cursorPt.x, cursorPt.y, (this.brushSize/2 + 2) * dpr, 0, Math.PI*2);
                ctx.fillStyle = this.color;
                ctx.fill();
            } else {
                ctx.arc(cursorPt.x, cursorPt.y, (this.brushSize/2 + 2) * dpr, 0, Math.PI*2);
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 2 * dpr;
                ctx.stroke();
            }
        }
    }
    
    destroy() {
        if (this.ui) this.ui.remove();
    }
}
