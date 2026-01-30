import * as THREE from 'three';
import gsap from 'gsap';
import TimeCounter from './time-counter.js';
import { PhotoGallery } from './photo-gallery.js';

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene
const scene = new THREE.Scene();

const bgm = new Audio('/bgm.mp3');
bgm.loop = true;
bgm.volume = 0; // Start silent

/**
 * Galaxy
 */
const parameters = {
    count: 100000,
    size: 0.01,
    radius: 7,
    branches: 5,
    spin: 2,
    randomness: 0.8,
    randomnessPower: 2.2,
    insideColor: '#ff6030',
    outsideColor: '#1b3984'
};

let geometry = null;
let material = null;
let points = null;

const generateGalaxy = () => {
    if (points !== null) {
        geometry.dispose();
        material.dispose();
        scene.remove(points);
    }

    geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(parameters.count * 3);
    const colors = new Float32Array(parameters.count * 3);

    const colorInside = new THREE.Color(parameters.insideColor);
    const colorOutside = new THREE.Color(parameters.outsideColor);

    for (let i = 0; i < parameters.count; i++) {
        const i3 = i * 3;

        // Position
        const radius = Math.random() * parameters.radius;
        const spinAngle = radius * parameters.spin;
        const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2;

        const randomX = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;
        const randomY = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius * 0.5;
        const randomZ = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;

        positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
        positions[i3 + 1] = randomY;
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

        // Color
        const mixedColor = colorInside.clone();
        mixedColor.lerp(colorOutside, radius / parameters.radius);

        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    material = new THREE.PointsMaterial({
        size: parameters.size,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);
};

generateGalaxy();

/**
 * Background Stars
 */
const createStarfield = () => {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 3000;
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        // Random position in a large cube
        starPositions[i3] = (Math.random() - 0.5) * 100;
        starPositions[i3 + 1] = (Math.random() - 0.5) * 100;
        starPositions[i3 + 2] = (Math.random() - 0.5) * 100;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
        size: 0.02,
        color: '#ffffff',
        transparent: true,
        opacity: 0.6,
        depthWrite: false
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
};

createStarfield();

/**
 * Scene 2: The Cube
 */
// Create a group for the second scene
const scene2Group = new THREE.Group();
scene.add(scene2Group);

// Photo Gallery
const photoGallery = new PhotoGallery(scene, 100);
photoGallery.addTo(scene2Group);

// Hide Scene 2 initially or place it far away
scene2Group.visible = false;
scene2Group.position.z = -20; // Start slightly in front

const timeCounter = new TimeCounter(scene);
timeCounter.setTargetDate('2014-04-18T00:00:00'); // 纪念日

// Adjust load parameters based on initial screen width
const initialIsMobile = window.innerWidth < 768;
const loadScale = initialIsMobile ? 0.015 : 0.025; // Smaller scale for mobile
// Keep X centered or slightly offset. -0.75 was for desktop.
// Width of counter at 0.025 is ~9. At 0.015 is ~5.4.
// Center it more for mobile? X=0 is true center. -0.75 was to shift it a bit.
// Let's use 0 for mobile to be safe, or scale the offset.
const loadX = initialIsMobile ? -0.45 : -0.75; 

// Load with X, Y offset and Scale
// Y=4 (Above Galaxy)
timeCounter.load(loadX, 4, loadScale);

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(window.devicePixelRatio);
});

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.x = 0;
camera.position.y = 3; // Look from slightly above
camera.position.z = 8;
scene.add(camera);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(window.devicePixelRatio);

/**
 * Interaction & Animation Logic
 */
let isTransitioning = false;
let currentScene = 1; // 1 = Galaxy, 2 = Cube

const triggerTransition = () => {
    if (isTransitioning || currentScene !== 1) return;
    isTransitioning = true;
    
    // Hide instructions
    document.querySelector('.instructions').style.opacity = '0';

    const tl = gsap.timeline({
        onComplete: () => {
            currentScene = 2;
            isTransitioning = false;
        }
    });

    // 1. "Warp Speed" Effect
    // Pull back FOV to create tunnel vision, then push in
    tl.to(camera, {
        fov: 120,
        duration: 1.5,
        ease: "power2.in",
        onUpdate: () => camera.updateProjectionMatrix()
    }, "start");

    // Rotate Galaxy faster as we speed up
    tl.to(points.rotation, {
        y: points.rotation.y + Math.PI * 2,
        duration: 2,
        ease: "power2.in"
    }, "start");

    // Move Camera into the galaxy center (simulate travel)
    tl.to(camera.position, {
        z: 0,
        y: 0,
        duration: 2,
        ease: "power2.in"
    }, "start");

    // Fade out galaxy
    tl.to(material, {
        opacity: 0,
        duration: 0.5,
        delay: 1.5 // Start fading near the end of the movement
    }, "start");
    
    // Hide Timer when leaving Galaxy
    tl.call(() => {
        timeCounter.setVisible(false);
    }, null, "start+=1.5");

    // --- Switch Scenes ---

    // Prepare Scene 2
    tl.call(() => {
        scene2Group.visible = true;
        scene.remove(points); 
        
        // Place camera INSIDE the tunnel
        // Scene2Group is at z=-20. Tunnel z range: 0 to -120.
        // Camera at z=-25 (world) => relative z=-5. Inside tunnel start.
        
        camera.position.set(0, 0, -25); 
        camera.fov = 100;
        camera.updateProjectionMatrix();
        
        // Start morphing to Tunnel positions
        photoGallery.morphTo('tunnel', 1.5);
        
        // Play BGM
        bgm.play().catch(() => {});
        gsap.to(bgm, { volume: 1, duration: 2 });
    });

    // 2. "Arrival" / Enable Infinite Loop
    
    // Instead of moving camera, we wait for morph to finish then start the tunnel loop
    tl.call(() => {
        photoGallery.setTunnelMode(true, 5.0); // Speed reduced further to 5.0
    }, null, "arrival-=0.5"); // Start shortly before morph ends
    
    // Dummy tween to keep timeline duration correct for easing if needed, 
    // or just let the loop run.
};

const triggerReverseTransition = () => {
    if (isTransitioning || currentScene !== 2) return;
    isTransitioning = true;
    
    // Don't stop tunnel mode immediately, let it fly during transition
    // photoGallery.setTunnelMode(false);
    
    const tl = gsap.timeline({
        onComplete: () => {
            currentScene = 1;
            isTransitioning = false;
            // Stop tunnel mode now
            photoGallery.setTunnelMode(false);
            // Show instructions again
            document.querySelector('.instructions').style.opacity = '1';
        }
    });
    
    // 1. "Depart" Effect (Scene 2 -> Space)
    // Pull back FOV for warp speed effect
    tl.to(camera, {
        fov: 150, // Extreme FOV
        duration: 1.0,
        ease: "power2.in",
        onUpdate: () => camera.updateProjectionMatrix()
    }, "start");
    
    // Fade out BGM
    tl.to(bgm, { 
        volume: 0, 
        duration: 1.0, 
        onComplete: () => bgm.pause() 
    }, "start");
    
    // Move Camera OUT of tunnel (backwards)
    // Current pos z = -25 (inside). Move to z = 10 (outside).
    tl.to(camera.position, {
        z: 10,
        y: 0,
        duration: 1.0,
        ease: "power2.in"
    }, "start");
    
    // --- Switch Scenes ---
    tl.call(() => {
        scene2Group.visible = false;
        scene.add(points); // Add Galaxy back
        
        // Reset Camera for Galaxy approach
        camera.position.set(0, 0, 0); 
        camera.fov = 120;
        camera.updateProjectionMatrix();
        
        material.opacity = 0; // Ensure galaxy starts invisible
        timeCounter.setVisible(true); // Show timer
    }, null, "start+=1.0"); // Align exactly with previous tween end
    
    // 2. "Return to Galaxy" Effect
    // Return FOV to normal
    tl.to(camera, {
        fov: 75,
        duration: 1.5,
        ease: "power2.out",
        onUpdate: () => camera.updateProjectionMatrix()
    }, "arrival");
    
    // Move camera back to initial galaxy view position
    tl.to(camera.position, {
        x: 0,
        y: 3,
        z: 8,
        duration: 1.5,
        ease: "power2.out"
    }, "arrival");
    
    // Fade in Galaxy
    tl.to(material, {
        opacity: 1,
        duration: 1.5,
        ease: "power2.out"
    }, "arrival");
};

// Event Listeners
window.addEventListener('click', () => {
    if (!isTransitioning) {
        if (currentScene === 1) {
            triggerTransition();
        } else if (currentScene === 2) {
            triggerReverseTransition();
        }
    }
});

/**
 * Animate
 */
const clock = new THREE.Clock();

const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    // Calculate delta manually based on elapsed change if needed, or use a separate clock?
    // THREE.Clock has getDelta() but it shouldn't be mixed with getElapsedTime() naively if calls are skipped.
    // But here it's fine to just use a fixed small delta or calculate it.
    // Let's use a simpler way: just pass a fixed sensible delta or diff.
    const delta = 0.016; // Approx 60fps

    // Update Countdown
    // Check if mobile
    const isMobile = sizes.width < 768; // Simple check
    timeCounter.update(elapsedTime, sizes.height, isMobile);

    // Idle animation for Galaxy
    if (currentScene === 1 && !isTransitioning) {
        points.rotation.y = elapsedTime * 0.05;
    }
    
    // Idle animation for Gallery
    if (currentScene === 2) {
        photoGallery.update(elapsedTime, delta);
    }

    renderer.render(scene, camera);
    window.requestAnimationFrame(tick);
};

tick();
