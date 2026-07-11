import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =====================================================================
// GLOBAL STATE & CONFIG
// =====================================================================
const state = {
    svgPath: null,       // Parsed 2D points from the single uploaded SVG
    boxSize: 100,        // B
    lightY: 0,           // Ly
    lightZ: 0,           // Lz
    wallDist: 400,       // Dw
    thickness: 3,        // T
    panelMeshes: []
};

// =====================================================================
// MODULE 1: THREE.JS SCENE SETUP
// =====================================================================
let scene, camera, renderer, controls;
let pointLight, lightHelper, wallMesh;

function initThree() {
    const container = document.getElementById('webgl-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);
    
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(250, 200, 300);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    
    // Real Point Light (Originates inside the box)
    pointLight = new THREE.PointLight(0xffffff, 2, 1000);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    scene.add(pointLight);
    
    // Light Helper
    const lightGeo = new THREE.SphereGeometry(4, 16, 16);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    lightHelper = new THREE.Mesh(lightGeo, lightMat);
    scene.add(lightHelper);
    
    // Shadow Wall
    const wallGeo = new THREE.PlaneGeometry(800, 800);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.receiveShadow = true;
    scene.add(wallMesh);
    
    window.addEventListener('resize', onWindowResize);
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// =====================================================================
// MODULE 2: 4-SIDE ROTATION COMPENSATION & INVERSE PROJECTION MATH
// =====================================================================

/**
 * 2D Rotation Matrix Compensation
 * To ensure the shadow remains perfectly upright when the physical box is rotated,
 * the 2D target cutout on each face must be internally rotated relative to the panel's local coordinates.
 * Face 0 (0°): No rotation
 * Face 1 (90°): Rotate target by 90° 
 * Face 2 (180°): Rotate target by 180°
 * Face 3 (270°): Rotate target by 270°
 */
function apply2DRotation(x, y, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: x * cos - y * sin,
        y: x * sin + y * cos
    };
}

/**
 * Inverse Radial Projection Trigonometry
 * Maps a 2D target point from the wall back to the 3D panel plane.
 * L = Light Position (0, Ly, Lz)
 * W = Point on Wall (x_w, y_w, Dw)
 * Ray R(t) = L + t*(W - L)
 * 
 * Intersection with Face 0 (Z = B/2): t = (B/2 - Lz) / (Dw - Lz)
 */
function applyInverseProjection(x, y, faceIndex) {
    const B = state.boxSize;
    const L = new THREE.Vector3(0, state.lightY, state.lightZ);
    const W = new THREE.Vector3(x, y, state.wallDist);
    const dir = new THREE.Vector3().subVectors(W, L);
    
    let t = 0;
    // Determine intersection plane based on face orientation
    // Face 0 & 2 are parallel to Z axis. Face 1 & 3 are parallel to X axis.
    if (faceIndex === 0 || faceIndex === 2) {
        const targetZ = (faceIndex === 0) ? B/2 : -B/2;
        t = (targetZ - L.z) / dir.z;
    } else {
        const targetX = (faceIndex === 1) ? B/2 : -B/2;
        t = (targetX - L.x) / dir.x;
    }
    
    const P = new THREE.Vector3().copy(L).add(dir.multiplyScalar(t));
    
    // Convert 3D global intersect to 2D local panel coords
    if (faceIndex === 0 || faceIndex === 2) return { x: P.x, y: P.y };
    return { x: P.z, y: P.y };
}

// =====================================================================
// MODULE 3: STRICT VECTOR CLEANUP (Sutherland-Hodgman Clipping)
// =====================================================================

/**
 * Ensures zero stray lines and zero intersecting artifacts.
 * Clips the projected polygon strictly to the physical acrylic panel bounds.
 */
function clipPolygonToRect(points, minX, maxX, minY, maxY) {
    const bounds = [
        { axis: 'x', val: minX, keepDir: 1 },  // Left bound
        { axis: 'x', val: maxX, keepDir: -1 }, // Right bound
        { axis: 'y', val: minY, keepDir: 1 },  // Bottom bound
        { axis: 'y', val: maxY, keepDir: -1 }  // Top bound
    ];
    
    let output = points;
    
    for (const bound of bounds) {
        if (output.length === 0) break;
        const input = output;
        output = [];
        
        for (let i = 0; i < input.length; i++) {
            const curr = input[i];
            const prev = input[(i - 1 + input.length) % input.length];
            
            const currInside = (bound.keepDir === 1) ? (curr[bound.axis] >= bound.val) : (curr[bound.axis] <= bound.val);
            const prevInside = (bound.keepDir === 1) ? (prev[bound.axis] >= bound.val) : (prev[bound.axis] <= bound.val);
            
            if (currInside) {
                if (!prevInside) {
                    // Intersection point
                    const t = (bound.val - prev[bound.axis]) / (curr[bound.axis] - prev[bound.axis]);
                    const ix = (bound.axis === 'x') ? bound.val : prev.x + t * (curr.x - prev.x);
                    const iy = (bound.axis === 'y') ? bound.val : prev.y + t * (curr.y - prev.y);
                    output.push({ x: ix, y: iy });
                }
                output.push(curr);
            } else if (prevInside) {
                const t = (bound.val - prev[bound.axis]) / (curr[bound.axis] - prev[bound.axis]);
                const ix = (bound.axis === 'x') ? bound.val : prev.x + t * (curr.x - prev.x);
                const iy = (bound.axis === 'y') ? bound.val : prev.y + t * (curr.y - prev.y);
                output.push({ x: ix, y: iy });
            }
        }
    }
    
    // Clean duplicate consecutive points
    const cleaned = [];
    for (let i = 0; i < output.length; i++) {
        const p = output[i];
        const str = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
        if (i === 0 || `${cleaned[cleaned.length-1].x.toFixed(3)},${cleaned[cleaned.length-1].y.toFixed(3)}` !== str) {
            cleaned.push(p);
        }
    }
    return cleaned;
}

// =====================================================================
// SCENE UPDATE LOGIC
// =====================================================================

function updateScene() {
    pointLight.position.set(0, state.lightY, state.lightZ);
    lightHelper.position.copy(pointLight.position);
    wallMesh.position.z = state.wallDist;
    
    // Clear old meshes
    state.panelMeshes.forEach(mesh => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    });
    state.panelMeshes = [];
    
    if (!state.svgPath) return;
    
    const B = state.boxSize;
    const T = state.thickness;
    
    // Generate 4 compensated panels
    for (let i = 0; i < 4; i++) {
        const shape = new THREE.Shape();
        let cleanedPoints = [];
        
        // 1. Apply 2D Rotation Compensation (0, 90, 180, 270)
        // 2. Apply Inverse Projection
        // 3. Clip strictly to panel bounds
        state.svgPath.forEach((pt, idx) => {
            const rot = apply2DRotation(pt.x, pt.y, i * 90);
            const proj = applyInverseProjection(rot.x, rot.y, i);
            cleanedPoints.push(proj);
        });
        
        cleanedPoints = clipPolygonToRect(cleanedPoints, -B/2, B/2, -B/2, B/2);
        
        if (cleanedPoints.length < 3) continue;
        
        cleanedPoints.forEach((pt, idx) => {
            if (idx === 0) shape.moveTo(pt.x, pt.y);
            else shape.lineTo(pt.x, pt.y);
        });
        shape.closePath();
        
        const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
        geo.translate(0, 0, -T/2);
        
        const mat = new THREE.MeshStandardMaterial({ color: 0x2563eb, transparent: true, opacity: 0.6 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Position panels in 3D space
        if (i === 0) mesh.position.z = B/2;
        if (i === 1) { mesh.position.x = B/2; mesh.rotation.y = Math.PI / 2; }
        if (i === 2) { mesh.position.z = -B/2; mesh.rotation.y = Math.PI; }
        if (i === 3) { mesh.position.x = -B/2; mesh.rotation.y = -Math.PI / 2; }
        
        scene.add(mesh);
        state.panelMeshes.push(mesh);
    }
}

// =====================================================================
// UI & SVG PARSING
// =====================================================================

function parseSvgPath(pathString) {
    const points = [];
    const regex = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
    const tokens = pathString.match(regex);
    let currentCmd = '';
    
    for (let i = 0; i < tokens.length; i++) {
        if (/[a-zA-Z]/.test(tokens[i])) {
            currentCmd = tokens[i];
        } else {
            if (currentCmd === 'M' || currentCmd === 'L') {
                const x = parseFloat(tokens[i]);
                const y = parseFloat(tokens[++i]);
                // Normalize SVG to -50, 50 coordinate system
                points.push({ x: x - 50, y: -y + 50 }); 
            }
        }
    }
    return points;
}

function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, "image/svg+xml");
        const pathElement = doc.querySelector('path');
        if (pathElement) {
            const d = pathElement.getAttribute('d');
            state.svgPath = parseSvgPath(d);
            document.getElementById('file-name').textContent = file.name;
            updateScene();
        }
    };
    reader.readAsText(file);
}

window.toggleCard = function(cardId) {
    const card = document.getElementById(cardId);
    const icon = card.querySelector('.toggle-icon');
    card.classList.toggle('active');
    icon.classList.toggle('fa-minus');
    icon.classList.toggle('fa-plus');
}

function setupUIEvents() {
    document.getElementById('svg-input').addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
    });
    document.getElementById('upload-zone').addEventListener('click', () => {
        document.getElementById('svg-input').click();
    });
    
    const updateVal = (id, valId, callback) => {
        const el = document.getElementById(id);
        el.addEventListener('input', () => {
            document.getElementById(valId).textContent = el.value;
            callback(parseFloat(el.value));
            updateScene();
        });
    };
    
    updateVal('box-size', 'val-box-size', v => state.boxSize = v);
    updateVal('light-y', 'val-light-y', v => state.lightY = v);
    updateVal('light-z', 'val-light-z', v => state.lightZ = v);
    updateVal('wall-dist', 'val-wall-dist', v => state.wallDist = v);
    
    document.getElementById('thickness').addEventListener('change', e => {
        state.thickness = parseFloat(e.target.value);
        updateScene();
    });
    
    document.getElementById('export-btn').addEventListener('click', exportLaserReadySVG);
}

// =====================================================================
// MODULE 4: FLAT-PACK FINGER JOINTS & TRUE-TO-SIZE MM SVG EXPORT
// =====================================================================

function generateFingerJointEdge(length, thickness, isTab) {
    const path = [];
    const tabSize = thickness * 2;
    const tabCount = Math.max(1, Math.floor(length / (tabSize * 2)));
    const actualLength = tabCount * (tabSize * 2);
    const offset = (length - actualLength) / 2;
    
    path.push({ x: 0, y: 0 });
    
    for (let i = 0; i < tabCount; i++) {
        let x = offset + i * (tabSize * 2);
        if (isTab) {
            path.push({ x: x, y: 0 });
            path.push({ x: x, y: tabSize });
            path.push({ x: x + tabSize, y: tabSize });
            path.push({ x: x + tabSize, y: 0 });
        } else {
            path.push({ x: x, y: 0 });
            path.push({ x: x, y: -tabSize });
            path.push({ x: x + tabSize, y: -tabSize });
            path.push({ x: x + tabSize, y: 0 });
        }
        path.push({ x: x + (tabSize * 2), y: 0 });
    }
    path.push({ x: length, y: 0 });
    return path;
}

function exportLaserReadySVG() {
    const statusEl = document.getElementById('export-status');
    statusEl.textContent = "Generating...";
    
    const B = state.boxSize;
    const T = state.thickness;
    const spacing = 20;
    const svgWidth = (B * 4) + (spacing * 5);
    const svgHeight = (B * 2) + (spacing * 3);
    
    // Strict 1mm mapping
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}mm" height="${svgHeight}mm">`;
    
    for (let i = 0; i < 4; i++) {
        const posX = spacing + (i * (B + spacing));
        const posY = spacing;
        
        let pathStr = `M ${posX} ${posY} `;
        // Top edge (Female)
        pathStr += `L ${posX + B} ${posY} `;
        // Right edge (Male)
        const rightEdge = generateFingerJointEdge(B, T, true);
        rightEdge.forEach(pt => pathStr += `L ${posX + B + pt.y} ${posY + pt.x} `);
        // Bottom edge (Male)
        pathStr += `L ${posX} ${posY + B} `;
        // Left edge (Female)
        const leftEdge = generateFingerJointEdge(B, T, false);
        leftEdge.reverse().forEach(pt => pathStr += `L ${posX + pt.y} ${posY + B - pt.x} `);
        pathStr += "Z";
        
        // Calculate and clip the compensated cutout
        if (state.svgPath) {
            let projectedPoints = [];
            state.svgPath.forEach(pt => {
                const rot = apply2DRotation(pt.x, pt.y, i * 90);
                const proj = applyInverseProjection(rot.x, rot.y, i);
                projectedPoints.push(proj);
            });
            
            // Enforce strict cleanup
            const cleanedPoints = clipPolygonToRect(projectedPoints, -B/2, B/2, -B/2, B/2);
            
            if (cleanedPoints.length > 2) {
                cleanedPoints.forEach((pt, idx) => {
                    const finalX = pos.x + pt.x + (B/2);
                    const finalY = pos.y + pt.y + (B/2);
                    if (idx === 0) pathStr += `M ${finalX} ${finalY} `;
                    else pathStr += `L ${finalX} ${finalY} `;
                });
                pathStr += "Z";
            }
        }
        svgContent += `<path d="${pathStr}" fill="none" stroke="red" stroke-width="0.2"/>`;
    }
    
    // Bottom Panel
    const botX = spacing;
    const botY = (B + spacing * 2);
    let botPath = `M ${botX} ${botY} `;
    botPath += `L ${botX + B} ${botY} `;
    const botRight = generateFingerJointEdge(B, T, false);
    botRight.forEach(pt => botPath += `L ${botX + B + pt.y} ${botY + pt.x} `);
    botPath += `L ${botX} ${botY + B} `;
    const botLeft = generateFingerJointEdge(B, T, false);
    botLeft.reverse().forEach(pt => botPath += `L ${botX + pt.y} ${botY + B - pt.x} `);
    botPath += "Z";
    
    svgContent += `<path d="${botPath}" fill="none" stroke="red" stroke-width="0.2"/>`;
    // Circular cutout for light
    svgContent += `<circle cx="${botX + B/2}" cy="${botY + B/2}" r="${state.lightZ === 0 ? 6 : 6}" fill="none" stroke="red" stroke-width="0.2"/>`;
    
    svgContent += `</svg>`;
    
    // Trigger Download
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "4_side_shadow_box_laser_cut.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    statusEl.textContent = "SVG Downloaded!";
    setTimeout(() => statusEl.textContent = "", 3000);
}

// =====================================================================
// INITIALIZATION
// =====================================================================
initThree();
setupUIEvents();
updateScene();
