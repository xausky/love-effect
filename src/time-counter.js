import * as THREE from 'three';
import MainVert from "./number-effect.vert?raw";
import MainFrag from "./main.frag?raw";

export default class TimeCounter {
    constructor(scene) {
        this.scene = scene;
        this.digits = []; 
        this.colons = []; // Track colons
        
        this.targetDate = new Date('2023-01-01T00:00:00'); 
        
        this.commonGeometry = null;
        this.commonBuffer = null;
        
        this.visible = true;
    }

    setVisible(visible) {
        this.visible = visible;
        this.digits.forEach(d => { if(d.mesh) d.mesh.visible = visible; });
        this.colons.forEach(c => { if(c.mesh) c.mesh.visible = visible; });
    }
    
    async load(x, y, scale = 0.05) {
        this.baseX = x;
        this.baseY = y;
        this.scale = scale;

        // Fetch data once
        const response = await fetch('/numbers.bin');
        this.commonBuffer = await response.arrayBuffer();
        
        // Layout: Two Rows
        // Row 1: Days (DDDD)
        // Row 2: HH : MM : SS
        
        // Increased spacing further as requested
        const digitWidth = 35 * scale; 
        const digitHeight = 80 * scale; 
        const spacing = 15 * scale; 
        const groupGap = 45 * scale; // Large gap around colons
        const colonOffset = 10 * scale; // Manual adjustment to shift colon right

        // Positions relative to center (baseX, baseY)
        const yRow1 = this.baseY + digitHeight * 0.5;
        const yRow2 = this.baseY - digitHeight * 0.5;

        // Helper to calculate X positions for Row 2 (centered)
        
        // Center pair (Minutes)
        const m1x = -0.5 * digitWidth - 0.5 * spacing;
        const m2x = 0.5 * digitWidth + 0.5 * spacing;
        
        // Colons (Shifted right slightly as requested)
        const colon1x = m1x - groupGap + colonOffset; 
        const colon2x = m2x + groupGap + colonOffset;
        
        // Hours (Left of Colon1)
        // We want H2 to be sufficiently left of Colon1. 
        // Let's base H2 position on M1 position minus 2*groupGap to keep symmetry of digits, 
        // or base it on Colon1 position?
        // Let's stick to symmetrical structure relative to M1/M2 but put Colon in between.
        
        // Gap structure:  H2 --(groupGap)-- Colon --(groupGap)-- M1
        // Since we shifted Colon right, the gap H2->Colon is larger, Colon->M1 is smaller?
        // No, let's define positions strictly.
        
        const h2x = m1x - 2 * groupGap; 
        const h1x = h2x - digitWidth - spacing;
        
        const s1x = m2x + 2 * groupGap;
        const s2x = s1x + digitWidth + spacing;
        
        // Recalculate colon positions to be exactly between H2/M1 and M2/S1, then apply offset
        const colon1Real = (h2x + m1x) / 2 + colonOffset;
        const colon2Real = (m2x + s1x) / 2 + colonOffset;

        const digitsConfig = [
            // Row 1: Days (4 digits) centered
            { x: -1.5 * digitWidth - 1.5 * spacing, y: yRow1, type: 'digit' }, // D1
            { x: -0.5 * digitWidth - 0.5 * spacing, y: yRow1, type: 'digit' }, // D2
            { x: 0.5 * digitWidth + 0.5 * spacing, y: yRow1, type: 'digit' },  // D3
            { x: 1.5 * digitWidth + 1.5 * spacing, y: yRow1, type: 'digit' },  // D4

            // Row 2: HH : MM : SS
            { x: h1x, y: yRow2, type: 'digit' }, // H1
            { x: h2x, y: yRow2, type: 'digit' }, // H2
            
            { x: m1x, y: yRow2, type: 'digit' }, // M1
            { x: m2x, y: yRow2, type: 'digit' }, // M2
            
            { x: s1x, y: yRow2, type: 'digit' }, // S1
            { x: s2x, y: yRow2, type: 'digit' }, // S2
            
            // Colons
            { x: colon1Real, y: yRow2, type: 'colon' },
            { x: colon2Real, y: yRow2, type: 'colon' }
        ];

        for (let i = 0; i < digitsConfig.length; i++) {
            const cfg = digitsConfig[i];
            const digit = new EffectDigit(this.scene, this.commonBuffer);
            await digit.init(this.baseX + cfg.x, cfg.y, this.scale);
            
            if (cfg.type === 'colon') {
                // Set to index 10 (Colon) and keep static
                digit.setStatic(10);
                this.scene.add(digit.mesh); // Add to scene but don't track in this.digits for updates if we handle separately
                // Actually, we can just push to a separate list or ignore in update
                this.colons.push(digit);
            } else {
                this.digits.push(digit);
            }
        }
    }
    
    setTargetDate(dateString) {
        this.targetDate = new Date(dateString);
    }
    
    update(elapsedTime, viewportHeight, isMobile = false) {
        if (!this.visible) return;
        
        // Define uSize based on mobile/desktop
        // Mobile needs larger points (e.g. 0.05), Desktop smaller (0.02)
        const uSize = isMobile ? 0.05 : 0.02;

        // Update colons
        this.colons.forEach(colon => {
            colon.updateTarget(10, elapsedTime); 
            colon.render(viewportHeight, uSize);
        });

        const now = new Date();
        const diff = now - this.targetDate;
        
        if (diff < 0) return; 

        // Time components
        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / (3600 * 24));
        const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        // Break into digits
        const values = [
            Math.floor(days / 1000) % 10,
            Math.floor(days / 100) % 10,
            Math.floor(days / 10) % 10,
            days % 10,
            Math.floor(hours / 10), hours % 10,
            Math.floor(minutes / 10), minutes % 10,
            Math.floor(seconds / 10), seconds % 10
        ];

        this.digits.forEach((digit, i) => {
            let val = values[i];
            digit.updateTarget(val, elapsedTime);
            digit.render(viewportHeight, uSize);
        });
    }
}

class EffectDigit {
    constructor(scene, buffer) {
        this.scene = scene;
        this.buffer = buffer;
        this.mesh = null;
        
        this.currentValue = 0;
        this.nextValue = 0;
        this.transitionStartTime = -1;
        this.duration = 1.0; // Morph duration
    }

    async init(x, y, scale) {
        const array = new Float32Array(this.buffer);
        const bufferGeometry = new THREE.BufferGeometry();
        
        // Setup attributes (same as before)
        for (let i = 0; i < 12; i++) {
            const attribute = new THREE.BufferAttribute(array.subarray(i * 1000 * 3, (i + 1) * 1000 * 3), 3);
            if (i === 11) bufferGeometry.setAttribute('position', attribute);
            bufferGeometry.setAttribute('p' + i, attribute);
        }

        const shaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { type: 'f', value: 0.0 },
                process: { type: 'f', value: 0.0 },
                current: { type: 'i', value: 0 },
                next: { type: 'i', value: 0 },
                viewportHeight: { type: 'f', value: 100.0 },
                uSize: { type: 'f', value: 0.02 } // Default
            },
            vertexShader: MainVert,
            fragmentShader: MainFrag,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true
        });

        this.mesh = new THREE.Points(bufferGeometry, shaderMaterial);
        this.mesh.scale.set(scale, scale, scale);
        this.mesh.position.set(x, y, 0);
        this.scene.add(this.mesh);
    }

    updateTarget(targetVal, currentTime) {
        if (this.currentValue !== targetVal && this.transitionStartTime < 0) {
            // Start transition
            this.nextValue = targetVal;
            this.transitionStartTime = currentTime;
        }
        
        // Update Time uniform
        this.mesh.material.uniforms.time.value = currentTime;

        // Handle Transition
        if (this.transitionStartTime > 0) {
            const elapsed = currentTime - this.transitionStartTime;
            let process = elapsed / this.duration;
            
            if (process >= 1.0) {
                process = 0.0;
                this.currentValue = this.nextValue;
                this.transitionStartTime = -1;
            }
            
            this.mesh.material.uniforms.process.value = process;
            this.mesh.material.uniforms.current.value = this.currentValue;
            this.mesh.material.uniforms.next.value = this.nextValue;
        } else {
            // Static
            this.mesh.material.uniforms.process.value = 0.0;
            this.mesh.material.uniforms.current.value = this.currentValue;
            this.mesh.material.uniforms.next.value = this.nextValue;
        }
    }

    setStatic(val) {
        this.currentValue = val;
        this.nextValue = val;
        this.mesh.material.uniforms.current.value = val;
        this.mesh.material.uniforms.next.value = val;
        this.mesh.material.uniforms.process.value = 0.0;
    }

    render(viewportHeight, uSize = 0.02) {
        if (this.mesh) {
            this.mesh.material.uniforms.viewportHeight.value = viewportHeight;
            this.mesh.material.uniforms.uSize.value = uSize;
        }
    }
}
