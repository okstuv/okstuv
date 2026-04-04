import * as THREE from 'three';

export class BrushSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        // Configuration
        this.symmetry = 6;
        this.mirror = true;
        this.brushCount = 1200; // Balanced: Silk-like but performant

        // State
        this.time = 0;
        this.guide = { x: 0, y: 0, vx: 0, vy: 0 };
        this.currentColor = new THREE.Color('#ff0044');

        // Geometry setup
        this.initMesh();

        // Initial Randomness
        this.randomizeParams();
    }

    randomizeParams() {
        // Generative Variety: SMOKE & FLUID
        // - Zoom: Higher (0.05 - 0.12) for intricate, non-circular details
        // - Flow: Fast (0.1 - 0.25) for energetic smoke
        // - Chaos: Moderate (0.02 - 0.05) to break symmetry
        this.zoom = 0.05 + Math.random() * 0.07;       // 0.05 - 0.12 (High Complexity)
        this.flowSpeed = 0.1 + Math.random() * 0.15;   // 0.10 - 0.25 (Fast Fluid)
        this.windStrength = 0.5 + Math.random() * 0.5; // 0.50 - 1.00 (Strong Curl)
        this.chaos = 0.02 + Math.random() * 0.03;      // Natural Jitter
    }

    initMesh() {
        // 1. Calculate Total Points
        const effectiveSymmetry = (this.symmetry === 0) ? 1 : this.symmetry;
        this.totalPoints = effectiveSymmetry * (this.mirror ? 2 : 1) * this.brushCount;

        // 2. Texture Generation (Hard Dot for Crisp Lines)
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128; // High Res Texture
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);

        // SILK TEXTURE: Sharp core, no fuzzy halo
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); // SOLID Core
        grad.addColorStop(0.1, 'rgba(255, 255, 255, 0.5)'); // Immediate drop
        grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.0)'); // Kill fuzzy edge early (Crisp)

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        const texture = new THREE.CanvasTexture(canvas);

        // 3. Buffer Initialization
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.totalPoints * 3);
        this.colors = new Float32Array(this.totalPoints * 3);
        this.sizes = new Float32Array(this.totalPoints);
        // Removed alphas buffer - we use uniform alpha

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

        // GOD GUARD: Manual Bounding Sphere
        this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1000);

        // 4. Material Setup
        this.material = new THREE.PointsMaterial({
            map: texture,
            transparent: true,
            opacity: 1.0, // Use vertex colors for opacity
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true,
            size: 1.2, // Reduced from 1.5 for thinner strokes
            sizeAttenuation: true
        });

        this.mesh = new THREE.Points(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        this.scene.add(this.mesh);

        // 5. Physics State Initialization
        this.brushes = [];
        this.hasDrawnOnce = false; // Track first draw
        for (let i = 0; i < this.brushCount; i++) {
            this.brushes.push({
                x: 0, y: 0, // Start at origin (will teleport on first draw)
                vx: 0, vy: 0,
                // Mass controls "laziness" - 
                mass: 1.0 + Math.random() * 2.0, // Lighter mass (was 2.0 + *1.5)
                phase: Math.random() * Math.PI * 2,
                zOffset: (Math.random() - 0.5) * 0.05, // Slight spread for "Ribbon" feel (not single line)
                hueOffset: (Math.random() - 0.5) * 0.06, // Harmonic Shimmer (+/- 0.03)
                speedScale: Math.random(),
                // GHOST OPACITY: 2% - Visible but stackable
                baseAlpha: 0.02
            });
        }
    }

    // 3D Simplex-ish Noise for FBM
    rawNoise(x, y, z) {
        let p = [Math.floor(x), Math.floor(y), Math.floor(z)];
        let f = [x - p[0], y - p[1], z - p[2]];
        f = f.map(a => a * a * (3 - 2 * a));
        const n = p[0] + p[1] * 57 + p[2] * 113;
        const noise = (t) => (Math.sin(n + t) * 43758.5453123) % 1.0;
        return noise(0) + f[0] * (noise(1) - noise(0)) +
            f[1] * (noise(57) - noise(0)) +
            f[2] * (noise(113) - noise(0));
    }

    // Fractal Brownian Motion (Multi-Octave Noise)
    fbm(x, y, t) {
        let val = 0;
        let amp = 0.5;
        // 3 Octaves of noise for fractal detail
        for (let i = 0; i < 3; i++) {
            val += amp * (Math.sin(x) + Math.sin(y) + Math.sin(t)); // Simple trig-noise stack
            x *= 2.0; y *= 2.0; t *= 2.0; amp *= 0.5;
        }
        return val;
    }

    // Cosine Based Palette (Inigo Quilez) - Rich, Non-White Colors
    // col = a + b * cos(2pi * (c*t + d))
    cosineColor(t, outColor) {
        // Palette: Electic Shader
        const a = { r: 0.5, g: 0.5, b: 0.5 };
        const b = { r: 0.5, g: 0.5, b: 0.5 };
        const c = { r: 1.0, g: 1.0, b: 1.0 };
        const d = { r: 0.00, g: 0.33, b: 0.67 };

        outColor.r = a.r + b.r * Math.cos(6.28318 * (c.r * t + d.r));
        outColor.g = a.g + b.g * Math.cos(6.28318 * (c.g * t + d.g));
        outColor.b = a.b + b.b * Math.cos(6.28318 * (c.b * t + d.b));

        // Clamp to prevent blowout
        outColor.r = Math.max(0, Math.min(1, outColor.r));
        outColor.g = Math.max(0, Math.min(1, outColor.g));
        outColor.b = Math.max(0, Math.min(1, outColor.b));
    }

    resetBrushes() {
        if (!this.brushes) return;
        this.hasDrawnOnce = false; // Reset draw trigger
        // Don't reset positions to 0,0 distinctively, just let them teleport on next draw
    }

    update(input, stepsArg = 1) {
        if (!input) return;
        // console.log("Brush Update. Active:", input.active, "Brushes:", this.brushCount);

        // Step Guard
        let steps = stepsArg * 2; // DOUBLE STEPS implicit for smoothness
        if (isNaN(steps) || steps < 1) steps = 1;

        this.time += 0.02 / steps;

        // A. Update Guide (Mouse Follower)
        const frustumHeight = 115.47;
        const frustumWidth = frustumHeight * this.camera.aspect;
        let tx = input.ndc.x * (frustumWidth / 2);
        let ty = input.ndc.y * (frustumHeight / 2);

        // Safety Catch for Guide
        if (isNaN(tx)) tx = 0;
        if (isNaN(ty)) ty = 0;

        const guideEase = 0.05 / steps; // Slower guide following
        this.guide.x += (tx - this.guide.x) * guideEase;
        this.guide.y += (ty - this.guide.y) * guideEase;

        if (isNaN(this.guide.x)) this.guide.x = 0;
        if (isNaN(this.guide.y)) this.guide.y = 0;



        // B. Update Brushes (Flow Physics)
        // SLOW MOTION for Silky Feel
        const MAX_SPEED = 0.8;

        // First Draw: Teleport all brushes to mouse position
        if (input.active && !this.hasDrawnOnce) {
            this.hasDrawnOnce = true;
            for (let b = 0; b < this.brushCount; b++) {
                this.brushes[b].x = this.guide.x;
                this.brushes[b].y = this.guide.y;
            }
        }

        for (let b = 0; b < this.brushCount; b++) {
            const brush = this.brushes[b];

            // 1. Spring Force (Pull to Guide)
            // WEAK PULL: Allows brushes to trail behind and separate
            const dx = this.guide.x - brush.x;
            const dy = this.guide.y - brush.y;

            // "Weave" Effect: Balanced stiffness
            const stiff = 0.01 + (brush.mass * 0.001); // 0.01 is the "Silky" sweet spot
            brush.vx += (dx * stiff / steps);
            brush.vy += (dy * stiff / steps);

            // 2. Coherent Flow (CURL NOISE for Fluidity)
            const zoom = this.zoom; // Generative Scale
            const flowSpeed = this.flowSpeed;

            // DYNAMIC DENSITY: If mouse is slow/still, scatter particles to prevent "Oil Pastel" blob
            // using brush.speedScale calculation from previous frame or approx
            const mouseSpeed = input.speed || 0;
            const isIdle = mouseSpeed < 0.1;

            if (isIdle) {
                // Push away from center if idle
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 5.0) {
                    brush.vx -= dx * 0.05;
                    brush.vy -= dy * 0.05;
                }
            }

            const bx = brush.x * zoom;
            const by = brush.y * zoom;
            const eps = 0.1;

            // Compute Gradient of Noise
            const time = this.time * flowSpeed;
            // Center sample not needed for gradient, but useful for other things

            // Finite Difference for Curl with DOMAIN WARPING (The "Smoke" Look)
            // warp = fbm(p)
            // val = fbm(p + warp)

            const warpX = this.fbm(bx, by, time * 0.5);
            const warpY = this.fbm(bx + 5.2, by + 1.3, time * 0.5);
            const warpStrength = 2.0; // Strong liquid distortion

            const n1 = this.fbm(bx + warpX * warpStrength, by + eps + warpY * warpStrength, time);
            const n2 = this.fbm(bx + warpX * warpStrength, by - eps + warpY * warpStrength, time);
            const n3 = this.fbm(bx + eps + warpX * warpStrength, by + warpY * warpStrength, time);
            const n4 = this.fbm(bx - eps + warpX * warpStrength, by + warpY * warpStrength, time);

            // Curl = (dNoise/dy, -dNoise/dx)
            const dx_noise = (n3 - n4) / (2 * eps);
            const dy_noise = (n1 - n2) / (2 * eps);

            const curlX = dy_noise;
            const curlY = -dx_noise;

            // Apply Curl directly to velocity (Fluid Push)
            // STRONG WIND: Needs to be dominant force for "Smoke" feel
            const windStrength = this.windStrength / steps;
            const chaos = (Math.random() - 0.5) * this.chaos / steps;

            brush.vx += curlX * windStrength + chaos;
            brush.vy += curlY * windStrength + chaos;

            // 3. Spiral (User Toggle)
            if (this.spiral) {
                const odx = brush.x - this.guide.x;
                const ody = brush.y - this.guide.y;
                brush.vx += (-ody * 0.04 / steps);
                brush.vy += (odx * 0.04 / steps);
            }

            // 4. Heavy Friction
            // High drag (0.96) keeps lines smooth and "silky", preventing jitter
            const friction = 0.96;

            brush.vx *= friction;
            brush.vy *= friction;

            // Cap Speed
            const vSq = brush.vx * brush.vx + brush.vy * brush.vy;
            if (vSq > MAX_SPEED * MAX_SPEED) {
                const spd = Math.sqrt(vSq);
                brush.vx = (brush.vx / spd) * MAX_SPEED;
                brush.vy = (brush.vy / spd) * MAX_SPEED;
            }



            // Integrate
            brush.x += brush.vx;
            brush.y += brush.vy;

            // NUCLEAR SAFETY
            if (isNaN(brush.x) || isNaN(brush.y)) {
                brush.x = this.guide.x;
                brush.y = this.guide.y;
                brush.vx = 0;
                brush.vy = 0;
            }
        }

        // C. Update Geometry (Symmetry Level)
        let idx = 0;
        const baseColor = this.currentColor;
        const hsl = {};
        baseColor.getHSL(hsl);
        const visible = (input.active) ? 1.0 : 0.0;
        const tempColor = new THREE.Color();

        const symCount = (this.symmetry === 0) ? 1 : this.symmetry;
        const angleStep = (this.symmetry === 0) ? 0 : (Math.PI * 2) / symCount;

        for (let i = 0; i < symCount; i++) {
            const baseAngle = angleStep * i;
            const mirrors = this.mirror ? 2 : 1;

            for (let m = 0; m < mirrors; m++) {
                let angle = baseAngle;
                let scaleX = 1;
                if (this.mirror && m === 1) scaleX = -1;

                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                for (let b = 0; b < this.brushCount; b++) {
                    const brush = this.brushes[b];

                    // Transform
                    let tx = brush.x * scaleX;
                    let ty = brush.y;

                    let finalX = tx * cos - ty * sin;
                    let finalY = tx * sin + ty * cos;
                    let finalZ = brush.zOffset;

                    // Safety
                    if (isNaN(finalX) || isNaN(finalY)) {
                        finalX = 0; finalY = 0;
                    }


                    // Write Position
                    this.positions[idx * 3] = finalX;
                    this.positions[idx * 3 + 1] = finalY;
                    this.positions[idx * 3 + 2] = finalZ;

                    // Write Color
                    // STRICT COLOR CONTROL (No drifting, No yellowing)

                    // A. Symmetry Hue Shift: Very subtle for richness, not rainbow
                    const symHue = i * 0.01;

                    // D. LIGHTNESS CAP (Prevent Whiteout)
                    // HSL L must occupy [0.2 - 0.35] range.
                    // Any higher and AdditiveBlending sums to white instantly.
                    const baseLightness = 0.25;

                    // FIX: Use User's Selected Color (HSL)
                    // 1. Get User Hue
                    const userHSL = {};
                    this.currentColor.getHSL(userHSL);

                    // 2. Apply variations but KEEP HUE LOCKED
                    // No time drift. No speed brightness.
                    tempColor.setHSL(
                        (userHSL.h + brush.hueOffset + symHue) % 1.0, // Strict Hue
                        userHSL.s, // Use USER saturation (allows Grey)
                        baseLightness // Capped Lightness (0.25)
                    );

                    // MIX OPACITY INTO COLOR FOR SHADER
                    // TRICK: Modulate COLOR by alpha for AdditiveBlending

                    // DYNAMIC OPACITY:
                    // 1. Base Alpha (0.005) - Ghostly
                    // 2. Speed Factor: If mouse is slow, reduce alpha but KEEP VISIBLE (min 0.2)
                    const speedFactor = Math.min(1.0, (input.speed || 0) * 3.0 + 0.2);

                    // BUG FIX: Use brush.baseAlpha, NOT hardcoded 0.02
                    const alpha = brush.baseAlpha * visible * speedFactor;

                    this.colors[idx * 3] = tempColor.r * alpha;
                    this.colors[idx * 3 + 1] = tempColor.g * alpha;
                    this.colors[idx * 3 + 2] = tempColor.b * alpha;

                    idx++;
                }
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    setColor(hex) {
        this.currentColor.set(hex);
    }

    updateSymmetry(count) {
        this.symmetry = Math.max(0, count);
        this.rebuildGeometry();
    }

    setMirror(enabled) {
        this.mirror = enabled;
        this.rebuildGeometry();
    }

    setSpiral(enabled) {
        this.spiral = enabled;
    }

    rebuildGeometry() {
        if (this.geometry) this.geometry.dispose();
        if (this.mesh) this.scene.remove(this.mesh);
        this.initMesh();
    }
}
