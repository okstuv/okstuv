import * as THREE from 'three';
import { SceneManager } from './scene.js?v=44';
import { Interaction } from './interaction.js?v=44';
import { BrushSystem } from './brushes.js?v=44';
import { Starfield } from './stars.js?v=44';

class App {
    constructor() {
        console.log("App Initialized: Version 2.1 (Stars)");
        this.container = document.getElementById('canvas-container');
        this.cursorCanvas = document.getElementById('cursor-layer');
        // Ensure cursor canvas exists
        if (this.cursorCanvas) {
            this.cursorCtx = this.cursorCanvas.getContext('2d');
            this.cursorCanvas.width = window.innerWidth;
            this.cursorCanvas.height = window.innerHeight;
        }

        // Initialize Background Stars
        // The SceneManager uses alpha: true, so we can see through to the body/container.
        // We attach stars to the container or body.
        this.starfield = new Starfield(document.body);

        this.sceneManager = new SceneManager(this.container);
        this.interaction = new Interaction(this.container);
        this.brushes = new BrushSystem(this.sceneManager.scene, this.sceneManager.camera);

        this.init();
        this.initUI();
    }

    init() {
        window.addEventListener('resize', () => this.onResize());

        // GENERATIVE VARIETY: Randomize brush physics on every stroke start
        const randomize = () => {
            if (this.brushes && this.brushes.randomizeParams) {
                this.brushes.randomizeParams();
            }
        };
        this.container.addEventListener('mousedown', randomize);
        this.container.addEventListener('touchstart', randomize);

        this.onResize();
        this.loop();
    }

    // ... (rest of initUI is same) ...


    initUI() {
        const that = this;

        // 1. Colors
        const buttons = document.querySelectorAll('.color-btn');
        const defaultBtn = document.querySelector('.color-btn[data-color="#E91E63"]');
        if (defaultBtn) defaultBtn.classList.add('active'); // Default active

        buttons.forEach(btn => {
            btn.addEventListener('click', function () {
                buttons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const colorHex = this.getAttribute('data-color');
                if (that.brushes) that.brushes.setColor(colorHex);
            });
        });

        // 2. Symmetry Slider
        const slider = document.getElementById('symmetry-slider');
        const label = document.getElementById('symmetry-label');
        if (slider && label) {
            slider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                label.innerText = val === 0 ? "No rotational symmetry" : val + "-fold symmetry";
                if (that.brushes) that.brushes.updateSymmetry(val);
            });
        }

        // 3. Toggles
        const toggleMirror = document.getElementById('toggle-mirror');
        if (toggleMirror) {
            toggleMirror.addEventListener('click', () => {
                const isOn = toggleMirror.classList.contains('on');
                if (isOn) {
                    toggleMirror.classList.remove('on');
                    toggleMirror.classList.add('off');
                    toggleMirror.innerText = "Off";
                    if (that.brushes) that.brushes.setMirror(false);
                } else {
                    toggleMirror.classList.remove('off');
                    toggleMirror.classList.add('on');
                    toggleMirror.innerText = "On";
                    if (that.brushes) that.brushes.setMirror(true);
                }
            });
        }

        const toggleSpiral = document.getElementById('toggle-spiral');
        if (toggleSpiral) {
            toggleSpiral.addEventListener('click', () => {
                const isOn = toggleSpiral.classList.contains('on');
                if (isOn) {
                    toggleSpiral.classList.remove('on');
                    toggleSpiral.classList.add('off');
                    toggleSpiral.innerText = "Off";
                    if (that.brushes) that.brushes.setSpiral(false);
                } else {
                    toggleSpiral.classList.remove('off');
                    toggleSpiral.classList.add('on');
                    toggleSpiral.innerText = "On";
                    if (that.brushes) that.brushes.setSpiral(true);
                }
            });
        }

        // 4. Actions
        const btnControls = document.getElementById('btn-controls');
        const panel = document.querySelector('.controls-panel');
        if (btnControls && panel) {
            btnControls.addEventListener('click', () => {
                panel.classList.toggle('hidden');
                btnControls.classList.toggle('active');
            });
        }



        const btnNew = document.getElementById('btn-new');
        if (btnNew) {
            btnNew.addEventListener('click', () => this.sceneManager.clear());
        }

        const btnSave = document.getElementById('btn-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => this.sceneManager.save());
        }
    }

    onResize() {
        this.sceneManager.resize();
        this.starfield.resize(); // Resize stars
        this.interaction.resize(window.innerWidth, window.innerHeight);
        if (this.cursorCanvas) {
            this.cursorCanvas.width = window.innerWidth;
            this.cursorCanvas.height = window.innerHeight;
        }
    }

    loop() {
        requestAnimationFrame(() => this.loop());

        // Update Stars
        this.starfield.update();

        // Update Logic
        const inputState = this.interaction.update();

        // Higher steps for smoother "silk" ribbons
        let steps = 2;
        if (inputState.active) {
            // Dynamic stepping: faster = more steps
            let calculatedSteps = Math.ceil((inputState.speed || 0) / 2);
            if (isNaN(calculatedSteps) || calculatedSteps < 2) calculatedSteps = 2;

            steps = Math.min(calculatedSteps, 20); // Cap at 20
        }

        for (let i = 0; i < steps; i++) {
            this.brushes.update(inputState, steps);

            if (inputState.active) {
                this.sceneManager.render();
                const intro = document.getElementById('intro-text');
                if (intro) intro.classList.add('hidden');
            }
        }

        if (!inputState.active) {
            this.brushes.update(inputState, 1);
            // Drifting render enabled for responsiveness
            // this.sceneManager.render(); // Don't render idle frames to keep trails clean? 
            // Actually silk keeps rendering drifts. Let's keep it.
            this.sceneManager.render();
        }

        // Draw Cursor Feedback (Overlay)
        if (this.cursorCtx) {
            this.drawCursorOverlay();
        }

        this.sceneManager.update();
    }

    drawCursorOverlay() {
        if (!this.cursorCtx) return;
        const ctx = this.cursorCtx;
        const width = this.cursorCanvas.width;
        const height = this.cursorCanvas.height;
        ctx.clearRect(0, 0, width, height);

        const guide = this.brushes.guide;
        const symCount = (this.brushes.symmetry === 0) ? 1 : this.brushes.symmetry;
        const angleStep = (this.brushes.symmetry === 0) ? 0 : (Math.PI * 2) / symCount;
        const mirrors = this.brushes.mirror ? 2 : 1;

        const cam = this.sceneManager.camera;
        const vector = new THREE.Vector3();

        // Use current brush color for cursor feedback
        const c = this.brushes.currentColor;
        const style = `rgba(${c.r * 255}, ${c.g * 255}, ${c.b * 255}, 0.8)`;
        ctx.fillStyle = style;

        for (let i = 0; i < symCount; i++) {
            const baseAngle = angleStep * i;

            for (let m = 0; m < mirrors; m++) {
                let angle = baseAngle;
                let scaleX = 1;

                // Mirror logic consistent with brushes.js (if m===1, scaleX = -1)
                // BUT wait, brushes.js rotates first then maybe mirrors?
                // Brushes.js: 
                // let tx = brush.x * scaleX; 
                // let finalX = tx * cos - ty * sin;

                if (this.brushes.mirror && m === 1) scaleX = -1;

                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                // Transform the GUIDE position (not the brush particles)
                let tx = guide.x * scaleX;
                let ty = guide.y;

                let finalX = tx * cos - ty * sin;
                let finalY = tx * sin + ty * cos;
                let finalZ = 0; // Guide is on Z=0 plane usually

                // Project to Screen
                vector.set(finalX, finalY, finalZ);
                vector.project(cam);

                const x = (vector.x * 0.5 + 0.5) * width;
                const y = (-(vector.y * 0.5) + 0.5) * height;

                if (x > 0 && x < width && y > 0 && y < height) {
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2); // Larger, clear dot
                    ctx.fill();
                }
            }
        }
    }
}

// Add Keyboard Controls
const app = new App();
window.app = app; // Expose for listeners

// Undo Hook: Capture state BEFORE a new stroke starts
const canvas = document.getElementById('canvas-container');
canvas.addEventListener('mousedown', () => {
    // Only save if we are about to draw (not just clicking UI)
    // Interaction class handles UI filtering but this is raw event on container
    window.app.sceneManager.saveState();
});
canvas.addEventListener('touchstart', () => {
    window.app.sceneManager.saveState();
});


window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyS') {
        window.app.sceneManager.save();
    }
    // UNDO: Ctrl + Z
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        window.app.sceneManager.undo();
        // Reset brush internal state so they don't 'jump' from old positions
        if (window.app.brushes && window.app.brushes.resetBrushes) {
            window.app.brushes.resetBrushes();
        }
    }
});
