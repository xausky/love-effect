import * as THREE from 'three';
import gsap from 'gsap';

export class PhotoGallery {
    constructor(scene, count = 300) {
        this.scene = scene;
        this.count = count; // Default count, might update after loading photos
        this.group = new THREE.Group();
        this.photos = []; 
        this.targets = {
            sphere: [],
            helix: [],
            heart: [],
            grid: [],
            tunnel: []
        };
        
        // Load index.json and initialize
        this.loadAssets();
    }

    async loadAssets() {
        try {
            // Start with placeholder init so scene is not empty
            this.init();
            this.calculateLayouts();

            const response = await fetch('/photos/index.json');
            if (!response.ok) throw new Error('No photo index found');
            const fileList = await response.json();
            
            if (fileList && fileList.length > 0) {
                console.log(`Loaded ${fileList.length} photos from index.`);
                this.updateTextures(fileList);
            }
        } catch (err) {
            console.warn('Could not load photo index, using placeholders.', err);
            // Already initialized with placeholders, so nothing else to do
        }
    }

    updateTextures(fileList) {
        const textureLoader = new THREE.TextureLoader();
        
        // Loop through existing meshes and update their material maps
        // We cycle through fileList to fill all meshes
        
        this.photos.forEach((photo, i) => {
            const fileIndex = i % fileList.length;
            const fileName = fileList[fileIndex];
            const filePath = `/photos/${fileName}`;
            
            textureLoader.load(
                filePath,
                (texture) => {
                    // On Load
                    if (photo.mesh.material) {
                        const oldMap = photo.mesh.material.map;
                        
                        // Set color space to SRGB for correct color rendering
                        texture.colorSpace = THREE.SRGBColorSpace;
                        
                        photo.mesh.material.map = texture;
                        photo.mesh.material.needsUpdate = true;
                        
                        // Dispose old canvas texture if it was a placeholder
                        if (oldMap) oldMap.dispose();
                    }
                },
                undefined,
                (err) => {
                    console.warn(`Failed to load texture: ${filePath}`, err);
                    // Keep placeholder if load fails
                }
            );
        });
    }

    // Generate a placeholder texture with text
    createTexture(index) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');

        // Background Gradient
        const gradient = context.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, `hsl(${index * 13 % 360}, 60%, 60%)`);
        gradient.addColorStop(1, `hsl(${(index * 13 + 60) % 360}, 60%, 40%)`);
        context.fillStyle = gradient;
        context.fillRect(0, 0, 512, 512);

        // Border Glow Effect
        context.shadowColor = "white";
        context.shadowBlur = 20;
        context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        context.lineWidth = 15;
        context.strokeRect(20, 20, 472, 472);
        context.shadowBlur = 0;

        // Text
        context.fillStyle = '#ffffff';
        context.font = 'bold 80px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('MEMORY', 256, 200);
        context.font = 'bold 120px Arial';
        context.fillText(`#${index + 1}`, 256, 312);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    init() {
        // Use a larger size for the tunnel effect (was 1.2, 0.9)
        const photoGeometry = new THREE.PlaneGeometry(3, 2.25); 
        
        for (let i = 0; i < this.count; i++) {
            const texture = this.createTexture(i);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 1.0 // Restore to full opacity for vivid colors
            });

            const mesh = new THREE.Mesh(photoGeometry, material);
            
            // Add a glow/border backplate
            const borderGeo = new THREE.PlaneGeometry(3.1, 2.35);
            const borderMat = new THREE.MeshBasicMaterial({ 
                color: 0xffffff, 
                transparent: true, 
                opacity: 0.3,
                side: THREE.BackSide 
            });
            const border = new THREE.Mesh(borderGeo, borderMat);
            border.position.z = -0.01;
            mesh.add(border);

            this.group.add(mesh);
            this.photos.push({ mesh });
        }
        
        // Initial scatter
        this.photos.forEach(p => {
            p.mesh.position.x = (Math.random() - 0.5) * 50;
            p.mesh.position.y = (Math.random() - 0.5) * 50;
            p.mesh.position.z = (Math.random() - 0.5) * 50;
            p.mesh.rotation.x = Math.random() * Math.PI;
            p.mesh.rotation.y = Math.random() * Math.PI;
        });

        this.scene.add(this.group);
    }

    calculateLayouts() {
        // 1. Helix Layout
        const helixRadius = 8;
        const helixHeight = 30;
        const helixTurns = 4;
        
        for (let i = 0; i < this.count; i++) {
            const progress = i / this.count;
            const angle = progress * helixTurns * Math.PI * 2;
            const y = (progress - 0.5) * helixHeight;
            const x = Math.cos(angle) * helixRadius;
            const z = Math.sin(angle) * helixRadius;
            
            const dummy = new THREE.Object3D();
            dummy.position.set(x, y, z);
            dummy.lookAt(0, y, 0); // Look at axis
            this.targets.helix.push({
                position: dummy.position.clone(),
                rotation: dummy.rotation.clone()
            });
        }

        // 2. Sphere Layout
        const sphereRadius = 12;
        
        for (let i = 0; i < this.count; i++) {
            const phi = Math.acos(-1 + (2 * i) / this.count);
            const theta = Math.sqrt(this.count * Math.PI) * phi;
            
            const x = sphereRadius * Math.cos(theta) * Math.sin(phi);
            const y = sphereRadius * Math.sin(theta) * Math.sin(phi);
            const z = sphereRadius * Math.cos(phi);
            
            const dummy = new THREE.Object3D();
            dummy.position.set(x, y, z);
            dummy.lookAt(0, 0, 0);
            this.targets.sphere.push({
                position: dummy.position.clone(),
                rotation: dummy.rotation.clone()
            });
        }

        // 3. Heart Layout (3D Point Cloud)
        // Formula: (x^2 + 9/4y^2 + z^2 - 1)^3 - x^2z^3 - 9/80y^2z^3 = 0
        // We use rejection sampling to find points inside/on surface
        let heartPoints = [];
        let attempts = 0;
        
        while (heartPoints.length < this.count && attempts < 50000) {
            attempts++;
            // Random point in box [-1.5, 1.5]
            const x = (Math.random() - 0.5) * 3;
            const y = (Math.random() - 0.5) * 3;
            const z = (Math.random() - 0.5) * 3;
            
            // Apply scale to make it bigger
            const scale = 10;
            
            // Check formula
            const a = x * x + (9/4) * y * y + z * z - 1;
            const val = a * a * a - x * x * z * z * z - (9/80) * y * y * z * z * z;
            
            // If val is close to 0 (surface) or < 0 (inside), we keep it
            // Let's target the "volume" to fill it up
            if (val <= 0) {
                const dummy = new THREE.Object3D();
                // Swap Y and Z to make it stand upright, and rotate 180 Y
                // Formula usually gives a heart lying down or differently oriented depending on axes
                // Let's adjust manual: x is width, y is depth, z is height in standard math Z-up
                // ThreeJS is Y-up. 
                // Let's try mapping: Math x -> Three x, Math z -> Three y, Math y -> Three z
                // Also stretch it a bit
                dummy.position.set(x * scale, z * scale, y * scale * 0.5); 
                
                dummy.lookAt(0, 0, 0); // Look at center
                heartPoints.push({
                    position: dummy.position.clone(),
                    rotation: dummy.rotation.clone()
                });
            }
        }
        
        // If we didn't get enough points (fallback), reuse sphere
        if (heartPoints.length < this.count) {
            console.warn("Heart generation failed, using sphere");
            this.targets.heart = this.targets.sphere;
        } else {
            this.targets.heart = heartPoints;
        }

        // 4. Tunnel Layout
        const tunnelRadius = 6; 
        const tunnelLength = 120; // Fixed length for 8-spiral
        this.tunnelLength = tunnelLength;
        
        // 8 Spiral Strands Layout
        const strands = 8;
        const photosPerStrand = Math.ceil(this.count / strands);
        
        // Helix parameters
        const zStep = tunnelLength / photosPerStrand; 
        const twistRate = 0.5; // How much angle changes per unit Z
        
        // If we want total strands to twist N times over length:
        // Angle = base + (z / length) * turns * 2PI
        const totalTwists = 2; 
        
        for (let i = 0; i < this.count; i++) {
            const strandIndex = i % strands;
            const strandPos = Math.floor(i / strands);
            
            // Base angle for the strand
            const baseAngle = (strandIndex / strands) * Math.PI * 2;
            
            // Z position (negative)
            // We stagger starting Z slightly if needed, or just linear
            // But strict grid is requested effectively.
            // Let's make it continuous: z decreases with strandPos
            // z = 0 -> -120
            
            // Normalize pos: 0 to 1
            const progress = strandPos / photosPerStrand;
            
            const z = - progress * tunnelLength;
            
            // Twist angle
            const twistAngle = progress * totalTwists * Math.PI * 2;
            const angle = baseAngle + twistAngle;
            
            const x = Math.cos(angle) * tunnelRadius;
            const y = Math.sin(angle) * tunnelRadius;
            
            const dummy = new THREE.Object3D();
            dummy.position.set(x, y, z);
            dummy.lookAt(0, 0, z); // Look at center axis
            
            // Adjust rotation to align nicely with spiral flow?
            // Default lookAt(0,0,z) aligns Z-axis of plane to point to center.
            // Plane is flat XY. So it faces center. Correct.
            // We might want to tilt it to match spiral slope, but facing center is good for viewing.
            
            this.targets.tunnel.push({
                position: dummy.position.clone(),
                rotation: dummy.rotation.clone(),
                tunnelAngle: angle,
                tunnelRadius: tunnelRadius,
                tunnelZ: z 
            });
        }
    }

    setTunnelMode(enabled, speed = 10.0) {
        // If we are already enabled and just changing speed, don't reset positions!
        if (this.tunnelMode === enabled && enabled) {
            this.tunnelSpeed = speed;
            return;
        }
        
        this.tunnelMode = enabled;
        this.tunnelSpeed = speed;
        // this.tunnelLength is now set in calculateLayouts dynamic logic
        
        // Reset local Z tracking if enabling
        if (enabled) {
             // We assume photos are already morphed to tunnel positions
             // We can initialize their dynamic Z offset
             this.photos.forEach((p, i) => {
                 p.dynamicZ = this.targets.tunnel[i].tunnelZ;
             });
        }
    }

    morphTo(shape, duration = 2.0) {
        if (!this.targets[shape]) return;
        
        this.currentShape = shape; // Track current shape
        const targetLayout = this.targets[shape];
        
        this.photos.forEach((photo, i) => {
            const target = targetLayout[i];
            
            // Animate Position
            gsap.to(photo.mesh.position, {
                x: target.position.x,
                y: target.position.y,
                z: target.position.z,
                duration: duration + Math.random() * 0.5, 
                ease: "power2.inOut",
                onComplete: () => {
                    // Sync dynamicZ after morph if switching to tunnel
                    if (shape === 'tunnel') {
                        photo.dynamicZ = target.position.z;
                    }
                }
            });
            
            // Animate Rotation
            gsap.to(photo.mesh.rotation, {
                x: target.rotation.x,
                y: target.rotation.y,
                z: target.rotation.z,
                duration: duration + Math.random() * 0.5,
                ease: "power2.inOut"
            });
        });
    }

    update(elapsedTime, deltaTime) {
        if (this.tunnelMode && this.currentShape === 'tunnel') {
            const speed = this.tunnelSpeed * deltaTime;
            
            this.photos.forEach((photo, i) => {
                // Move towards camera (+Z)
                photo.dynamicZ += speed;
                
                // Camera is roughly at Z=5. 
                // Tunnel starts around Z=0 and goes to -120.
                // If photo passes Z=25 (well behind camera), warp it to back
                
                if (photo.dynamicZ > 25) {
                    photo.dynamicZ -= this.tunnelLength;
                }
                
                photo.mesh.position.z = photo.dynamicZ;
                
                // Recalculate rotation because looking at center line depends on Z?
                // Actually in a straight tunnel, lookAt(0,0,z) orientation doesn't change if Z changes 
                // IF the object is just moving parallel to axis and not spiraling.
                // Our objects are at (x,y,z) looking at (0,0,z). 
                // Since x,y are constant for a given photo index, the look direction (in local space) is constant?
                // Let's verify. 
                // Pos: (R, 0, Z). LookAt: (0, 0, Z). Direction: (-1, 0, 0).
                // Pos: (R, 0, Z+d). LookAt: (0, 0, Z+d). Direction: (-1, 0, 0).
                // So rotation does not need update.
            });
            
            // Optional: Rotate tunnel itself for dizziness
            this.group.rotation.z = elapsedTime * 0.1;
            
        } else {
            // Default rotation for other modes
            this.group.rotation.y = elapsedTime * 0.1;
        }
    }

    addTo(parent) {
        parent.add(this.group);
    }
}
