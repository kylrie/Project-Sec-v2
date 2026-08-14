import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { VoiceState } from '../types/friday';

interface HolographicCoreProps {
  state: VoiceState;
  frequencies: number[];
  audioLevel: number;
  wakeWord: string;
  latencyMs: number | null;
  onCoreClick: () => void;
  onInterrupt: () => void;
}

// Generate procedural plasma textures & particle textures
function createPlasmaTextures() {
  // 1. Wispy Plasma Cloud Corona Texture
  const coronaCanvas = document.createElement('canvas');
  coronaCanvas.width = 512;
  coronaCanvas.height = 512;
  const cCtx = coronaCanvas.getContext('2d')!;
  const cx = 256;
  const cy = 256;

  // Base circular gradient
  const cGrad = cCtx.createRadialGradient(cx, cy, 0, cx, cy, 250);
  cGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  cGrad.addColorStop(0.35, 'rgba(125, 211, 252, 0.95)');
  cGrad.addColorStop(0.65, 'rgba(2, 132, 199, 0.8)');
  cGrad.addColorStop(0.88, 'rgba(3, 105, 161, 0.35)');
  cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  cCtx.fillStyle = cGrad;
  cCtx.fillRect(0, 0, 512, 512);

  // Add smoky turbulent wisps around the edge
  for (let i = 0; i < 70; i++) {
    const angle = (i / 70) * Math.PI * 2 + Math.random() * 0.1;
    const r = 160 + Math.random() * 75;
    const wx = cx + Math.cos(angle) * r;
    const wy = cy + Math.sin(angle) * r;
    const wSize = 25 + Math.random() * 45;

    const wGrad = cCtx.createRadialGradient(wx, wy, 0, wx, wy, wSize);
    wGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    wGrad.addColorStop(0.5, 'rgba(2, 132, 199, 0.25)');
    wGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    cCtx.fillStyle = wGrad;
    cCtx.beginPath();
    cCtx.arc(wx, wy, wSize, 0, Math.PI * 2);
    cCtx.fill();
  }

  const coronaTex = new THREE.CanvasTexture(coronaCanvas);
  coronaTex.needsUpdate = true;

  // 2. Electric Spark Mote Texture
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.width = 128;
  sparkCanvas.height = 128;
  const sCtx = sparkCanvas.getContext('2d')!;
  const sGrad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 60);
  sGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  sGrad.addColorStop(0.2, 'rgba(186, 230, 253, 0.95)');
  sGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.45)');
  sGrad.addColorStop(0.8, 'rgba(2, 132, 199, 0.1)');
  sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 128, 128);

  // Diamond flare
  sCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  sCtx.lineWidth = 2;
  sCtx.beginPath();
  sCtx.moveTo(64, 16);
  sCtx.lineTo(64, 112);
  sCtx.moveTo(16, 64);
  sCtx.lineTo(112, 64);
  sCtx.stroke();

  const sparkTex = new THREE.CanvasTexture(sparkCanvas);
  sparkTex.needsUpdate = true;

  return { coronaTex, sparkTex };
}

export const HolographicCore: React.FC<HolographicCoreProps> = ({
  state,
  frequencies,
  audioLevel,
  wakeWord,
  onCoreClick,
  onInterrupt
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  const isProcessing = state === 'processing';

  const activeLevel = Math.max(0.06, audioLevel);
  const freqAvg = frequencies.length > 0
    ? frequencies.slice(0, 16).reduce((a, b) => a + b, 0) / 16
    : 0.08;

  // Scene references
  const sceneRef = useRef<{
    orbMasterGroup: THREE.Group;
    innerCoreSphere: THREE.Mesh;
    fresnelGlowSphere: THREE.Mesh;
    coronaPlaneMesh: THREE.Mesh;
    coronaPlaneMesh2: THREE.Mesh;
    corePointLight: THREE.PointLight;
    rimPointLight: THREE.PointLight;
    // Lightning system
    lightningLineSegments: THREE.LineSegments;
    lightningGeo: THREE.BufferGeometry;
    rimLightningSegments: THREE.LineSegments;
    rimLightningGeo: THREE.BufferGeometry;
    // Particle system
    particles: THREE.Points;
    particlePositions: Float32Array;
    particleVelocities: Float32Array;
    particleAngles: Float32Array;
    // Shaders/Materials
    innerCoreMat: THREE.ShaderMaterial;
    fresnelMat: THREE.ShaderMaterial;
    coronaMat: THREE.MeshBasicMaterial;
    coronaMat2: THREE.MeshBasicMaterial;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
  } | null>(null);

  const stateRef = useRef({ state, isSpeaking, isListening, isProcessing, activeLevel, freqAvg });
  stateRef.current = { state, isSpeaking, isListening, isProcessing, activeLevel, freqAvg };

  // 3D Inertial Orbit & Drag Rotation
  const mouseRef = useRef({
    targetRotX: 0.05,
    targetRotY: -0.1,
    currentRotX: 0.05,
    currentRotY: -0.1,
    isDragging: false,
    prevX: 0,
    prevY: 0
  });

  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 380;
    const height = container.clientHeight || 380;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.8);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0x0284c7, 2.0);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0x38bdf8, 4.5);
    mainKeyLight.position.set(4, 5, 6);
    scene.add(mainKeyLight);

    const rimLight = new THREE.DirectionalLight(0x0284c7, 3.5);
    rimLight.position.set(-5, -4, 4);
    scene.add(rimLight);

    // 3. Central Master 3D Plasma Group
    const orbMasterGroup = new THREE.Group();
    scene.add(orbMasterGroup);

    const { coronaTex, sparkTex } = createPlasmaTextures();

    // =========================================================================
    // 4. INNER TURBULENT 3D PLASMA CORE (Custom GLSL Shader)
    // =========================================================================
    // Simulates the smooth white core grading into turbulent cyan/cobalt blue plasma
    const plasmaVertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const plasmaFragmentShader = `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColorCore;
      uniform vec3 uColorMid;
      uniform vec3 uColorDeep;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;

      // Simplex noise helpers
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec2 p2 = a1.xy;
        vec3 p23 = vec3(p2,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p23,p23), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p23 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p23,x2), dot(p3,x3) ) );
      }

      void main() {
        // Multi-octave swirling turbulence
        vec3 p = vPosition * 2.2;
        float n1 = snoise(p + vec3(0.0, 0.0, uTime * 0.8));
        float n2 = snoise(p * 2.0 - vec3(uTime * 0.5, 0.0, uTime * 0.6));
        float n3 = snoise(p * 4.0 + vec3(0.0, uTime * 1.2, 0.0));
        float turbulence = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);

        // Center-to-rim brightness: Center is incandescent white, edge is deep blue
        float viewDot = max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
        float centerGlow = pow(viewDot, 1.3);

        // Plasma color mixing
        vec3 col = mix(uColorDeep, uColorMid, clamp(turbulence * 0.6 + 0.5, 0.0, 1.0));
        col = mix(col, uColorCore, centerGlow * 0.95);

        // Add incandescent core highlight
        col += uColorCore * pow(centerGlow, 3.0) * 0.6 * uIntensity;

        gl_FragColor = vec4(col, 0.96);
      }
    `;

    const innerCoreMat = new THREE.ShaderMaterial({
      vertexShader: plasmaVertexShader,
      fragmentShader: plasmaFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1.0 },
        uColorCore: { value: new THREE.Color(0xffffff) },
        uColorMid: { value: new THREE.Color(0x38bdf8) },
        uColorDeep: { value: new THREE.Color(0x0284c7) },
      },
    });

    const coreGeo = new THREE.SphereGeometry(1.68, 64, 64);
    const innerCoreSphere = new THREE.Mesh(coreGeo, innerCoreMat);
    orbMasterGroup.add(innerCoreSphere);

    // =========================================================================
    // 5. TRANSLUCENT FRESNEL PLASMA CORONA SHELL
    // =========================================================================
    const fresnelVertexShader = `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fresnelFragmentShader = `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = 1.0 - max(0.0, dot(normal, viewDir));
        fresnel = pow(fresnel, uPower);
        gl_FragColor = vec4(uColor * uIntensity, fresnel * 0.9);
      }
    `;

    const fresnelMat = new THREE.ShaderMaterial({
      vertexShader: fresnelVertexShader,
      fragmentShader: fresnelFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(0x7dd3fc) },
        uPower: { value: 2.2 },
        uIntensity: { value: 1.5 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
    });

    const fresnelGeo = new THREE.SphereGeometry(1.82, 64, 64);
    const fresnelGlowSphere = new THREE.Mesh(fresnelGeo, fresnelMat);
    orbMasterGroup.add(fresnelGlowSphere);

    // =========================================================================
    // 6. OUTER WISPY PLASMA CORONA FLAME RIM (Billboard Layers matching image)
    // =========================================================================
    const coronaGeo = new THREE.PlaneGeometry(4.6, 4.6);
    const coronaMat = new THREE.MeshBasicMaterial({
      map: coronaTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const coronaPlaneMesh = new THREE.Mesh(coronaGeo, coronaMat);
    coronaPlaneMesh.position.z = -0.05;
    orbMasterGroup.add(coronaPlaneMesh);

    // Counter-rotating secondary corona layer for depth
    const coronaMat2 = new THREE.MeshBasicMaterial({
      map: coronaTex,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const coronaPlaneMesh2 = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.8), coronaMat2);
    coronaPlaneMesh2.position.z = -0.1;
    coronaPlaneMesh2.rotation.z = Math.PI / 4;
    orbMasterGroup.add(coronaPlaneMesh2);

    // =========================================================================
    // 7. SURFACE CRACKLING LIGHTNING ARCS (Procedural Electric Bolts)
    // =========================================================================
    // Multiple lightning bolts arcing across the spherical surface & circumference
    const lightningBoltsCount = 14;
    const segmentsPerBolt = 12;
    const totalLinePoints = lightningBoltsCount * segmentsPerBolt * 2;

    const lightningGeo = new THREE.BufferGeometry();
    const lightningPositions = new Float32Array(totalLinePoints * 3);
    lightningGeo.setAttribute('position', new THREE.BufferAttribute(lightningPositions, 3));

    const lightningMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      linewidth: 2,
    });

    const lightningLineSegments = new THREE.LineSegments(lightningGeo, lightningMat);
    orbMasterGroup.add(lightningLineSegments);

    // Rim Lightning Halo (Circumferential crackles matching the reference image)
    const rimBoltsCount = 18;
    const rimPoints = rimBoltsCount * 8 * 2;
    const rimLightningGeo = new THREE.BufferGeometry();
    const rimLightningPos = new Float32Array(rimPoints * 3);
    rimLightningGeo.setAttribute('position', new THREE.BufferAttribute(rimLightningPos, 3));

    const rimLightningMat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      linewidth: 2,
    });

    const rimLightningSegments = new THREE.LineSegments(rimLightningGeo, rimLightningMat);
    orbMasterGroup.add(rimLightningSegments);

    // =========================================================================
    // 8. 3D GLOWING PLASMA PARTICLES & EMBER MOTES (320+ particles)
    // =========================================================================
    const particleCount = 340;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount * 3);
    const particleAngles = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const cWhite = new THREE.Color(0xffffff);
    const cSky = new THREE.Color(0x38bdf8);
    const cCyan = new THREE.Color(0x7dd3fc);
    const cBlue = new THREE.Color(0x0284c7);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rad = 1.7 + Math.random() * 0.9;

      const x = rad * Math.sin(phi) * Math.cos(theta);
      const y = rad * Math.sin(phi) * Math.sin(theta);
      const z = rad * Math.cos(phi);

      const idx = i * 3;
      particlePositions[idx] = x;
      particlePositions[idx + 1] = y;
      particlePositions[idx + 2] = z;

      particleVelocities[idx] = (Math.random() - 0.5) * 0.015;
      particleVelocities[idx + 1] = (Math.random() - 0.5) * 0.015;
      particleVelocities[idx + 2] = (Math.random() - 0.5) * 0.015;

      particleAngles[idx] = theta;
      particleAngles[idx + 1] = rad;
      particleAngles[idx + 2] = 0.5 + Math.random() * 1.5; // Orbit speed

      const choice = Math.random();
      const col = choice > 0.65 ? cWhite : choice > 0.3 ? cCyan : choice > 0.15 ? cSky : cBlue;
      particleColors[idx] = col.r;
      particleColors[idx + 1] = col.g;
      particleColors[idx + 2] = col.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.16,
      map: sparkTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    orbMasterGroup.add(particles);

    // Dynamic Internal Point Light
    const corePointLight = new THREE.PointLight(0x38bdf8, 6.0, 16);
    corePointLight.position.set(0, 0, 0.4);
    orbMasterGroup.add(corePointLight);

    const rimPointLight = new THREE.PointLight(0x0284c7, 3.5, 12);
    rimPointLight.position.set(0, 0, -1.2);
    orbMasterGroup.add(rimPointLight);

    // Save scene reference
    sceneRef.current = {
      orbMasterGroup,
      innerCoreSphere,
      fresnelGlowSphere,
      coronaPlaneMesh,
      coronaPlaneMesh2,
      corePointLight,
      rimPointLight,
      lightningLineSegments,
      lightningGeo,
      rimLightningSegments,
      rimLightningGeo,
      particles,
      particlePositions,
      particleVelocities,
      particleAngles,
      innerCoreMat,
      fresnelMat,
      coronaMat,
      coronaMat2,
      renderer,
      camera,
      scene,
    };

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    // 9. Main 60FPS Render & Physics Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const { state: curState, isSpeaking: curSpeaking, isListening: curListening, isProcessing: curProcessing, activeLevel: curLevel } = stateRef.current;

      // 1. Smooth 3D Inertial Rotation Physics
      const m = mouseRef.current;
      m.currentRotX += (m.targetRotX - m.currentRotX) * 0.08;
      m.currentRotY += (m.targetRotY - m.currentRotY) * 0.08;

      // Organic anti-gravity floating bob & harmonic tilt
      const floatY = Math.sin(elapsed * 1.6) * 0.08;
      const floatZ = Math.cos(elapsed * 1.2) * 0.05;

      orbMasterGroup.position.y = floatY;
      orbMasterGroup.position.z = floatZ;
      orbMasterGroup.rotation.x = m.currentRotX + Math.sin(elapsed * 1.4) * 0.025;
      orbMasterGroup.rotation.y = m.currentRotY + Math.cos(elapsed * 1.1) * 0.025;

      // 2. Swirling 3D Plasma Shader Uniforms
      innerCoreMat.uniforms.uTime.value = elapsed * (curSpeaking ? 2.5 : curListening ? 1.6 : 0.9);
      const intensityFactor = curSpeaking ? 1.0 + curLevel * 2.5 : 1.0;
      innerCoreMat.uniforms.uIntensity.value = intensityFactor;

      // Corona billboard rotation
      coronaPlaneMesh.rotation.z += 0.003 * (curSpeaking ? 3.0 : 1.0);
      coronaPlaneMesh2.rotation.z -= 0.004 * (curSpeaking ? 3.0 : 1.0);

      // 3. Dynamic Procedural Lightning Arcs Generation
      const pos = lightningGeo.attributes.position.array as Float32Array;
      let pIdx = 0;
      const activeBolts = curSpeaking ? 14 : curListening ? 9 : 5;

      for (let b = 0; b < activeBolts; b++) {
        // Random spherical start/end points
        const t1 = elapsed * 1.8 + b * 1.2;
        const p1 = Math.sin(elapsed * 0.9 + b) * 0.8;
        const t2 = t1 + (Math.PI * 0.45);
        const p2 = p1 + ((Math.random() - 0.5) * 0.6);

        const r = 1.72;
        let startX = r * Math.cos(t1) * Math.cos(p1);
        let startY = r * Math.sin(t1) * Math.cos(p1);
        let startZ = r * Math.sin(p1);

        const endX = r * Math.cos(t2) * Math.cos(p2);
        const endY = r * Math.sin(t2) * Math.cos(p2);
        const endZ = r * Math.sin(p2);

        // Generate jagged electric segments
        for (let s = 0; s < segmentsPerBolt; s++) {
          const frac = (s + 1) / segmentsPerBolt;
          const prevFrac = s / segmentsPerBolt;

          const px1 = startX + (endX - startX) * prevFrac;
          const py1 = startY + (endY - startY) * prevFrac;
          const pz1 = startZ + (endZ - startZ) * prevFrac;

          // Jitter for lightning jaggedness
          const jitter = s === 0 || s === segmentsPerBolt - 1 ? 0 : 0.12 * (1 + curLevel * 1.5);
          const px2 = startX + (endX - startX) * frac + (Math.random() - 0.5) * jitter;
          const py2 = startY + (endY - startY) * frac + (Math.random() - 0.5) * jitter;
          const pz2 = startZ + (endZ - startZ) * frac + (Math.random() - 0.5) * jitter;

          pos[pIdx++] = px1;
          pos[pIdx++] = py1;
          pos[pIdx++] = pz1;
          pos[pIdx++] = px2;
          pos[pIdx++] = py2;
          pos[pIdx++] = pz2;
        }
      }
      while (pIdx < totalLinePoints * 3) {
        pos[pIdx++] = 0;
      }
      lightningGeo.attributes.position.needsUpdate = true;

      // 4. Circumference Rim Lightning Flares
      const rimPos = rimLightningGeo.attributes.position.array as Float32Array;
      let rIdx = 0;
      const numRimBolts = curSpeaking ? 18 : curListening ? 10 : 6;

      for (let rb = 0; rb < numRimBolts; rb++) {
        const baseAng = (rb / numRimBolts) * Math.PI * 2 + elapsed * 1.2;
        const boltR = 1.78 + Math.sin(elapsed * 8 + rb) * 0.08;

        for (let seg = 0; seg < 6; seg++) {
          const a1 = baseAng + seg * 0.05;
          const a2 = a1 + 0.05;
          const jR = (Math.random() - 0.5) * 0.09 * (1 + curLevel * 1.2);

          const rx1 = Math.cos(a1) * boltR;
          const ry1 = Math.sin(a1) * boltR;
          const rx2 = Math.cos(a2) * (boltR + jR);
          const ry2 = Math.sin(a2) * (boltR + jR);

          rimPos[rIdx++] = rx1;
          rimPos[rIdx++] = ry1;
          rimPos[rIdx++] = 0.05;
          rimPos[rIdx++] = rx2;
          rimPos[rIdx++] = ry2;
          rimPos[rIdx++] = 0.05;
        }
      }
      while (rIdx < rimPoints * 3) {
        rimPos[rIdx++] = 0;
      }
      rimLightningGeo.attributes.position.needsUpdate = true;

      // 5. Plasma Ember Particle Swirl Physics
      const pArr = particleGeo.attributes.position.array as Float32Array;
      const particleSpeed = curSpeaking ? 3.0 : curListening ? 1.8 : 0.9;
      const expansion = curSpeaking ? 1.0 + curLevel * 1.5 : 1.0;

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        const theta = particleAngles[idx] + elapsed * 0.4 * particleAngles[idx + 2] * particleSpeed;
        const baseR = particleAngles[idx + 1] * expansion;
        const rOsc = Math.sin(elapsed * 2.5 + i) * 0.15;
        const curR = baseR + rOsc;

        pArr[idx] = Math.cos(theta) * curR;
        pArr[idx + 1] = Math.sin(theta) * curR;
        pArr[idx + 2] += particleVelocities[idx + 2];

        if (Math.abs(pArr[idx + 2]) > 1.8) {
          pArr[idx + 2] = (Math.random() - 0.5) * 1.2;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // 6. Dynamic Vocal Illumination ("When it talks, the middle lights up")
      if (curSpeaking) {
        // Blinding incandescent plasma flare pulsing with speech frequencies
        const voicePulse = 1.0 + curLevel * 3.5 + Math.sin(elapsed * 25) * 0.35;
        corePointLight.intensity = 11.0 * voicePulse;
        corePointLight.color.setHex(0x38bdf8);

        fresnelMat.uniforms.uIntensity.value = 2.4 + curLevel * 2.0;
        fresnelGlowSphere.scale.setScalar(1.0 + curLevel * 0.2 + Math.sin(elapsed * 16) * 0.03);

        coronaMat.opacity = Math.min(1, 0.95 + curLevel * 0.4);
        coronaPlaneMesh.scale.setScalar(1.0 + curLevel * 0.35 + Math.sin(elapsed * 12) * 0.05);

        coronaMat2.opacity = Math.min(1, 0.85 + curLevel * 0.4);
        coronaPlaneMesh2.scale.setScalar(1.0 + curLevel * 0.4);

        particleMat.size = 0.22 + curLevel * 0.12;
        lightningMat.opacity = 1.0;
        rimLightningMat.opacity = 1.0;
      } else if (curListening) {
        // Vibrant electric listening pulse
        corePointLight.intensity = 6.0 + Math.sin(elapsed * 6) * 2.0;
        corePointLight.color.setHex(0x22d3ee);

        fresnelMat.uniforms.uIntensity.value = 1.6 + Math.sin(elapsed * 5) * 0.4;
        fresnelGlowSphere.scale.setScalar(0.98 + Math.sin(elapsed * 4) * 0.02);

        coronaMat.opacity = 0.85;
        coronaPlaneMesh.scale.setScalar(0.96 + Math.sin(elapsed * 4) * 0.04);

        coronaMat2.opacity = 0.7;
        coronaPlaneMesh2.scale.setScalar(0.98);

        particleMat.size = 0.17;
        lightningMat.opacity = 0.85;
        rimLightningMat.opacity = 0.85;
      } else if (curProcessing) {
        // High-energy cognitive calculation flare
        corePointLight.intensity = 8.0 + Math.sin(elapsed * 14) * 2.8;
        corePointLight.color.setHex(0x818cf8);

        fresnelMat.uniforms.uIntensity.value = 2.0;
        coronaMat.opacity = 0.9;
        coronaPlaneMesh.scale.setScalar(1.02);

        particleMat.size = 0.19;
        lightningMat.opacity = 0.95;
      } else {
        // Idle standby mode: Gentle breathing cyan plasma glow
        const standbyPulse = 0.85 + Math.sin(elapsed * 1.8) * 0.2;
        corePointLight.intensity = 4.0 * standbyPulse;
        corePointLight.color.setHex(0x0284c7);

        fresnelMat.uniforms.uIntensity.value = 1.3 * standbyPulse;
        fresnelGlowSphere.scale.setScalar(0.95 + standbyPulse * 0.05);

        coronaMat.opacity = 0.7 + standbyPulse * 0.15;
        coronaPlaneMesh.scale.setScalar(0.92);

        coronaMat2.opacity = 0.55;
        coronaPlaneMesh2.scale.setScalar(0.94);

        particleMat.size = 0.14;
        lightningMat.opacity = 0.65;
        rimLightningMat.opacity = 0.65;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Pointer & Drag Handlers for full 3D Orbiting
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    mouseRef.current.isDragging = true;
    mouseRef.current.prevX = e.clientX;
    mouseRef.current.prevY = e.clientY;
    setIsInteracting(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;

    if (mouseRef.current.isDragging) {
      const deltaX = e.clientX - mouseRef.current.prevX;
      const deltaY = e.clientY - mouseRef.current.prevY;
      mouseRef.current.prevX = e.clientX;
      mouseRef.current.prevY = e.clientY;

      mouseRef.current.targetRotY += deltaX * 0.012;
      mouseRef.current.targetRotX += deltaY * 0.012;
      mouseRef.current.targetRotX = Math.max(-0.95, Math.min(0.95, mouseRef.current.targetRotX));
    } else {
      // Natural 3D mouse parallax tracking
      mouseRef.current.targetRotY = -0.1 + relX * 0.65;
      mouseRef.current.targetRotX = 0.05 - relY * 0.5;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    mouseRef.current.isDragging = false;
    setIsInteracting(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (!mouseRef.current.isDragging) {
      mouseRef.current.targetRotX = 0.05;
      mouseRef.current.targetRotY = -0.1;
    }
  }, []);

  const statusTheme = {
    speaking: {
      label: 'PLASMA CORE TRANSMITTING',
      badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.35)]',
      dot: 'bg-cyan-400 animate-ping',
    },
    listening: {
      label: 'ENERGY SENSOR LISTENING',
      badge: 'bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-[0_0_20px_rgba(56,189,248,0.3)]',
      dot: 'bg-sky-400 animate-pulse',
    },
    processing: {
      label: 'PLASMA SYNTHESIS ACTIVE',
      badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.3)]',
      dot: 'bg-indigo-400 animate-spin',
    },
    interrupted: {
      label: 'ENERGY SHIFT BARGE-IN',
      badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_20px_rgba(234,179,8,0.3)]',
      dot: 'bg-amber-400',
    },
    standby: {
      label: `PLASMA ORB • Drag in 3D • Say "${wakeWord}"`,
      badge: 'bg-zinc-900/90 text-zinc-300 border-zinc-800/80',
      dot: 'bg-cyan-400',
    },
  }[state];

  return (
    <div id="friday-plasma-lightning-orb-container" className="relative flex flex-col items-center justify-center select-none py-1">
      {/* 3D WebGL Canvas Viewport Stage */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onClick={onCoreClick}
        className="relative w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        title="Plasma Lightning Orb • Drag in 3D to inspect • Click to talk"
      >
        {/* Real-time 3D Three.js Plasma Lightning Canvas */}
        <canvas ref={canvasRef} className="w-full h-full drop-shadow-[0_25px_60px_rgba(6,182,212,0.5)]" />

        {/* Dynamic Horizontal Cyan Anamorphic Flare when Speaking */}
        {isSpeaking && (
          <div
            className="absolute pointer-events-none h-[4px] bg-gradient-to-r from-transparent via-cyan-200 to-transparent blur-[1px] transition-all duration-75"
            style={{
              width: `${290 + activeLevel * 170}px`,
              opacity: Math.min(1, 0.85 + activeLevel * 0.6),
            }}
          />
        )}
      </div>

      {/* Telemetry Status Capsule */}
      <div className="flex items-center space-x-2 z-20 -mt-2">
        <div className={`inline-flex items-center space-x-2 px-4 py-1 rounded-full border text-xs font-mono backdrop-blur-md transition-all duration-300 ${statusTheme.badge}`}>
          <span className={`w-2 h-2 rounded-full ${statusTheme.dot}`} />
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            {statusTheme.label}
          </span>
          {isSpeaking && (
            <button
              onClick={(e) => { e.stopPropagation(); onInterrupt(); }}
              className="ml-1 pl-2 border-l border-cyan-400/40 text-amber-300 hover:text-amber-200 text-[10px] underline cursor-pointer"
            >
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
