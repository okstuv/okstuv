import * as THREE from 'three';

export class SceneManager {
    constructor(container) {
        this.container = container;

        // 1. Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true,
            alpha: true // Allow transparency for Stars background
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
        this.renderer.autoClear = false;
        this.renderer.setClearColor(0x000000, 0); // Transparent clear
        this.container.appendChild(this.renderer.domElement);

        // 2. Scene
        this.scene = new THREE.Scene();
        // this.scene.background = null; // Default is null, which works with autoClear=false for trails

        // 3. Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 0, 100);
        this.camera.lookAt(0, 0, 0);

        // 4. Trails Overlay
        this.fadeMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.02
        });

        this.fadePlane = new THREE.Mesh(
            new THREE.PlaneGeometry(1000, 1000),
            this.fadeMaterial
        );
        // We do NOT add fadePlane to the main scene anymore, 
        // because we want to control exactly when it draws.

        // We create a separate Scene for the Fade Plane? 
        // Or just render it manually.
        this.fadeScene = new THREE.Scene();
        this.fadeScene.add(this.fadePlane);

        this.clock = new THREE.Clock();
    }

    resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    update() {
        // const time = this.clock.getElapsedTime();
        // Disabling drift for stable drawing canvas (WeaveSilk style)
        // this.camera.position.x = Math.sin(time * 0.1) * 5;
        // this.camera.position.y = Math.cos(time * 0.13) * 5;
        this.camera.lookAt(0, 0, 0);

        // Keep fade plane in front of camera
        this.fadePlane.lookAt(this.camera.position);
        this.fadePlane.position.copy(this.camera.position).add(new THREE.Vector3(0, 0, -10));
    }

    render() {
        // 1. Draw Fade Plane (DISABLED for Infinite Trail Test)
        // this.renderer.render(this.fadeScene, this.camera);

        // 2. Draw the main scene (Brushes)
        // With autoClear=false, this adds the new brush positions
        this.renderer.render(this.scene, this.camera);
    }

    renderFade() {
        this.renderer.render(this.fadeScene, this.camera);
    }

    clear() {
        this.renderer.clear();
    }

    save() {
        // Create a link
        const link = document.createElement('a');
        link.download = 'generative_silk_' + Date.now() + '.png';
        link.href = this.renderer.domElement.toDataURL('image/png');
        link.click();
    }

    // --- UNDO SYSTEM ---
    initUndo() {
        this.undoStack = [];
        this.maxUndo = 25; // Increased for "unlimited" feel (safely)

        // Quad for restoring state
        this.undoScene = new THREE.Scene();
        // this.undoScene.background = new THREE.Color(0x000000); // Not needed with alpha: false

        this.undoMaterial = new THREE.MeshBasicMaterial({
            transparent: false, // Opaque overwrite
            blending: THREE.NoBlending, // Just copy pixels (fastest)
            depthTest: false,
            depthWrite: false
        });
        this.undoPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.undoMaterial);
        this.undoScene.add(this.undoPlane);

        // Ortho camera for full screen quad
        this.undoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    saveState() {
        if (!this.undoStack) this.initUndo();
        // Save current canvas state as Data URL
        const state = this.renderer.domElement.toDataURL('image/png');
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
        // console.log("State Saved. Stack:", this.undoStack.length);
    }

    undo() {
        if (!this.undoStack || this.undoStack.length === 0) return;

        const state = this.undoStack.pop();
        const loader = new THREE.TextureLoader();

        loader.load(state, (texture) => {
            // FIX: Color Space Issue (prevent brightening)
            // The canvas snapshot is sRGB. We must tell Three.js this so it doesn't double-convert.
            texture.colorSpace = THREE.SRGBColorSpace;

            // Render the saved state back to the canvas
            this.undoMaterial.map = texture;
            this.undoMaterial.needsUpdate = true;

            // 1. Clear everything to Black (alpha: false ensures solid black)
            this.renderer.clear();

            // 2. Render the saved image (Opaque)
            this.renderer.render(this.undoScene, this.undoCamera);

            // 3. Ensure we are ready for new drawing (autoClear stays false)
            this.renderer.autoClear = false;
        });
    }
}
