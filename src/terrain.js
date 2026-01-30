import * as THREE from 'three';

export const createTerrain = () => {
    const group = new THREE.Group();

    // --- Parameters ---
    const width = 60;
    const depth = 60;
    const widthSegments = 128;
    const depthSegments = 128;
    const waterLevel = 0.5; // Water height
    const sandLevel = 1.2;
    const grassLevel = 2.5;
    const rockLevel = 4.0;
    
    // --- Geometry ---
    const geometry = new THREE.PlaneGeometry(width, depth, widthSegments, depthSegments);
    geometry.rotateX(-Math.PI / 2); // Rotate to be flat on XZ plane

    const count = geometry.attributes.position.count;
    const positions = geometry.attributes.position;
    const colors = new Float32Array(count * 3);

    // --- Height Generation (Simple Noise) ---
    // A simple sum of sine waves to simulate terrain without external library
    const getNoise = (x, z) => {
        let y = 0;
        // Low frequency (Big mountains)
        y += Math.sin(x * 0.1) * Math.sin(z * 0.1) * 2.0;
        // Medium frequency (Hills)
        y += Math.sin(x * 0.3 + 2.5) * Math.sin(z * 0.25 + 1.2) * 1.0;
        // High frequency (Detail)
        y += Math.sin(x * 0.8 + 5.1) * Math.sin(z * 0.7 + 0.3) * 0.3;
        
        // Add a "valley" in the center for the landing spot
        // Distance from center
        const dist = Math.sqrt(x*x + z*z);
        // Flatten center: multiply height by a factor that is 0 at center and 1 at edges
        const flatRadius = 5;
        const blendRadius = 10;
        let centerFactor = Math.min(Math.max((dist - flatRadius) / (blendRadius - flatRadius), 0), 1);
        centerFactor = Math.pow(centerFactor, 2); // Smooth transition
        
        return y * centerFactor;
    };

    for (let i = 0; i < count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        
        let y = getNoise(x, z);
        
        // Apply height
        positions.setY(i, y);

        // --- Vertex Colors based on Height ---
        const color = new THREE.Color();

        if (y <= waterLevel + 0.1) {
             // Sand/Beach near water
             color.set('#d2d68d');
        } else if (y < grassLevel) {
            // Grass
            color.set('#588141');
        } else if (y < rockLevel) {
            // Rock
            color.set('#6b6b6b');
        } else {
            // Snow
            color.set('#ffffff');
        }
        
        // Add some noise to color to make it less uniform
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); // Important for lighting

    // --- Material ---
    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide
    });

    const terrain = new THREE.Mesh(geometry, material);
    group.add(terrain);

    // --- Water ---
    const waterGeometry = new THREE.PlaneGeometry(width, depth);
    waterGeometry.rotateX(-Math.PI / 2);
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: '#2888ff',
        transparent: true,
        opacity: 0.6,
        roughness: 0.3,
        metalness: 0.8
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.position.y = waterLevel;
    group.add(water);

    return group;
};
