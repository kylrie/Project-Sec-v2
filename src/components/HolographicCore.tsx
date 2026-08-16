import React, { useEffect, useRef, memo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VoiceState } from '../types/friday';

export interface HolographicCoreProps {
  state: VoiceState;
  frequencies: number[];
  audioLevel: number;
  wakeWord: string;
  latencyMs: number | null;
  activePersonas?: string[];
  onCoreClick: () => void;
  onInterrupt: () => void;
}

export const HolographicCore: React.FC<HolographicCoreProps> = memo(({
  state,
  frequencies,
  audioLevel,
  wakeWord,
  activePersonas = [],
  onCoreClick,
  onInterrupt
}) => {

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  const isProcessing = state === 'processing';

  const activeLevel = Math.max(0.08, audioLevel);
  const freqAvg = frequencies.length > 0
    ? frequencies.slice(0, 16).reduce((a, b) => a + b, 0) / 16
    : 0.1;

  const stateRef = useRef({ state, isSpeaking, isListening, isProcessing, activeLevel, freqAvg, activePersonas });
  stateRef.current = { state, isSpeaking, isListening, isProcessing, activeLevel, freqAvg, activePersonas };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 560;

    // =========================================================================
    // 1. THREE.JS SCENE, CAMERA & RENDERER SETUP (NO CLIPPING, RICH CONTRAST)
    // =========================================================================
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // Full 360° OrbitControls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;

    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // =========================================================================
    // 2. DISCRETE MICRO-STARDUST GLITTER TEXTURE
    // =========================================================================
    const createStardustParticleTexture = () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 64, 64);

      // Fine pin-point particle with crisp radiant glow
      const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 28);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.25, 'rgba(224, 242, 254, 0.9)');
      grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.35)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);

      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    };

    const particleTexture = createStardustParticleTexture();

    // =========================================================================
    // 3. 26,000+ UNIFORM VOLUMETRIC STARDUST POINTS (MATCHING REFERENCE IMAGE)
    // =========================================================================
    const particleCount = 26000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    const radii = new Float32Array(particleCount);
    const pointSizes = new Float32Array(particleCount);

    const baseRadius = 1.9;

    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      // Smooth volume distribution matching the spherical density of reference
      const bias = Math.pow(Math.random(), 0.5);
      const r = baseRadius * bias;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;

      phases[i] = Math.random() * Math.PI * 2;
      radii[i] = r;
      pointSizes[i] = 16.0 + Math.random() * 12.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aOriginalPosition', new THREE.BufferAttribute(originalPositions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    geometry.setAttribute('aPointSize', new THREE.BufferAttribute(pointSizes, 1));

    // Custom WebGL Shader: Calibrated discrete stardust with green voice pulsation
    const particleShaderMat = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform float uAudioLevel;
        uniform float uSpeaking;
        uniform float uListening;
        attribute vec3 aOriginalPosition;
        attribute float aPhase;
        attribute float aRadius;
        attribute float aPointSize;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec3 pos = aOriginalPosition;

          // 1. Organic Cosmic Drift
          float drift = sin(uTime * 1.2 + aPhase) * 0.015;
          float cosmicWave = sin(uTime * 1.6 + aRadius * 3.2 + aPhase) * 0.012;

          // 2. High-Energy Pulsating Volumetric Expansion (When FRIDAY is Speaking)
          float fastPulse = sin(uTime * 8.5 + aPhase) * 0.12;
          float bodyBreath = sin(uTime * 4.0) * 0.15;
          float speakingPulse = (fastPulse + bodyBreath) * uSpeaking * (0.8 + uAudioLevel * 2.2);

          // Listening gentle ripple
          float listeningRipple = sin(uTime * 3.5 + aRadius * 4.2) * 0.035 * uListening;

          float totalDisplacement = 1.0 + drift + cosmicWave + speakingPulse + listeningRipple;
          pos *= totalDisplacement;

          // 3. COLOR PALETTES
          // Idle Stardust (Discrete Silver, Ice Blue & Center Core Motes)
          vec3 cDotWhite = vec3(1.0, 1.0, 1.0);
          vec3 cDotSilver = vec3(0.82, 0.90, 0.98);
          vec3 cDotDeepSky = vec3(0.38, 0.68, 0.92);
          
          float normRadius = clamp(aRadius / 1.9, 0.0, 1.0);
          float centerFactor = 1.0 - normRadius;
          
          vec3 cIdle = mix(cDotDeepSky, cDotSilver, centerFactor * 0.75);
          cIdle = mix(cIdle, cDotWhite, pow(centerFactor, 2.8) * 0.9);

          // Pulsating Speaking Palette: Radiant Emerald, Neon Jade & Mint Green
          vec3 cGreenNeon = vec3(0.12, 0.96, 0.42);    // Electric Neon Green
          vec3 cGreenEmerald = vec3(0.04, 0.68, 0.30); // Deep Jade Green
          vec3 cGreenMint = vec3(0.65, 1.0, 0.80);    // Luminous Mint White Core
          
          vec3 cGreen = mix(cGreenEmerald, cGreenNeon, sin(aPhase + uTime * 3.5) * 0.5 + 0.5);
          cGreen = mix(cGreen, cGreenMint, centerFactor * 0.8);

          // Smooth interpolation to GREEN when speaking
          vColor = mix(cIdle, cGreen, uSpeaking);

          // 4. Point Sizes
          float speakingBoost = uSpeaking * (4.0 + uAudioLevel * 10.0);
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (aPointSize + speakingBoost) * (1.0 / -mvPosition.z);

          // Discrete particle twinkle
          float twinkle = 0.65 + 0.35 * sin(aPhase * 3.5 + uTime * 2.0);
          vAlpha = twinkle * (0.85 + uSpeaking * 0.15);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;

          float strength = 1.0 - smoothstep(0.0, 0.5, dist);
          strength = pow(strength, 1.4);

          // Calibrated alpha: clearly visible glittering stardust points with zero blowout
          gl_FragColor = vec4(vColor, strength * 0.48 * vAlpha);
        }
      `,
      uniforms: {
        uTexture: { value: particleTexture },
        uTime: { value: 0.0 },
        uAudioLevel: { value: 0.1 },
        uSpeaking: { value: 0.0 },
        uListening: { value: 0.0 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const pointCloud = new THREE.Points(geometry, particleShaderMat);
    masterGroup.add(pointCloud);

    // =========================================================================
    // 3. COMPANION SPECIALIST SATELLITE ORBS (CHRONO, CIPHER, ECHO)
    // =========================================================================
    const companionSatellites = [
      { id: 'chrono', color: 0x0ea5e9, radius: 2.3, speed: 1.2, phase: 0.0 },
      { id: 'cipher', color: 0x8b5cf6, radius: 2.8, speed: 0.9, phase: 2.1 },
      { id: 'echo', color: 0xf59e0b, radius: 3.3, speed: 1.5, phase: 4.2 }
    ];

    const satelliteMeshes = companionSatellites.map(sat => {
      const group = new THREE.Group();

      // Satellite glowing core
      const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: sat.color,
        transparent: true,
        opacity: 0.95
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      group.add(sphere);

      // Orbital glow halo
      const haloGeo = new THREE.RingGeometry(0.14, 0.22, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: sat.color,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      group.add(halo);

      group.scale.set(0, 0, 0);
      masterGroup.add(group);

      return { ...sat, group, scaleLerp: 0 };
    });

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // =========================================================================
    // 4. 60FPS 3D RENDER LOOP WITH SMOOTH GREEN PULSATING TRANSITION
    // =========================================================================
    let animId: number;
    let lastTime = performance.now();
    const startTime = performance.now();
    let currentSpeakingLerp = 0.0;
    let currentListeningLerp = 0.0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min(0.1, (now - lastTime) * 0.001);
      lastTime = now;
      const elapsed = (now - startTime) * 0.001;
      const { isSpeaking: curSpeaking, isListening: curListening, isProcessing: curProcessing, activeLevel: curAudioLevel, activePersonas: curPersonas } = stateRef.current;

      // Update 360° OrbitControls
      controls.update();

      // State interpolation
      const targetSpeaking = curSpeaking ? 1.0 : 0.0;
      currentSpeakingLerp += (targetSpeaking - currentSpeakingLerp) * Math.min(1.0, delta * 7.5);

      const targetListening = curListening ? 1.0 : 0.0;
      currentListeningLerp += (targetListening - currentListeningLerp) * Math.min(1.0, delta * 6.0);

      // Update Shader Uniforms
      particleShaderMat.uniforms.uTime.value = elapsed;
      particleShaderMat.uniforms.uAudioLevel.value = curAudioLevel;
      particleShaderMat.uniforms.uSpeaking.value = currentSpeakingLerp;
      particleShaderMat.uniforms.uListening.value = currentListeningLerp;

      // Satellite Orbits
      satelliteMeshes.forEach(sat => {
        const isActive = (curPersonas || []).includes(sat.id);
        const targetScale = isActive ? (1.0 + (curSpeaking ? 0.25 * Math.sin(elapsed * 4) : 0)) : 0.0;
        sat.scaleLerp += (targetScale - sat.scaleLerp) * Math.min(1.0, delta * 5.0);
        sat.group.scale.setScalar(sat.scaleLerp);

        if (sat.scaleLerp > 0.01) {
          const speedMult = curProcessing ? 2.2 : 1.0;
          const angle = elapsed * sat.speed * speedMult + sat.phase;
          sat.group.position.x = Math.cos(angle) * sat.radius;
          sat.group.position.z = Math.sin(angle) * sat.radius;
          sat.group.position.y = Math.sin(angle * 1.8) * 0.4;
          sat.group.lookAt(camera.position);
        }
      });

      // Gentle continuous 3D orbital drift
      const rotSpeed = curSpeaking ? 0.65 + curAudioLevel * 0.9 : curProcessing ? 1.1 : 0.3;
      masterGroup.rotation.y += delta * rotSpeed * 0.25;
      masterGroup.rotation.x = Math.sin(elapsed * 0.35) * 0.025;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      particleTexture.dispose();
    };
  }, []);

  const isGreenActive = isSpeaking;

  const statusLabel = {
    speaking: 'TRANSMITTING • PULSATING GREEN',
    listening: 'LISTENING',
    processing: 'THINKING',
    interrupted: 'ENERGY SHIFT',
    standby: `DRAG 360° • SAY "${wakeWord}"`,
  }[state];

  return (
    <div id="friday-spirit-orb-container" className="relative flex flex-col items-center justify-center select-none w-full">
      {/* 3D WebGL Canvas Viewport Stage (Zero borders, unclipped full 3D depth) */}
      <div
        ref={containerRef}
        onClick={onCoreClick}
        className="relative w-full max-w-[560px] h-[360px] sm:h-[440px] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none bg-transparent border-0 outline-none shadow-none"
        title="3D Quantum Stardust Heart • Drag 360° to rotate • Click to speak"
      >
        {/* Real-time 3D Three.js Canvas */}
        <canvas ref={canvasRef} className="w-full h-full bg-transparent block" />
      </div>

      {/* Floating Minimal Status Pill */}
      <div className="flex items-center space-x-2 z-20 -mt-3">
        <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-zinc-900/40 border backdrop-blur-md font-mono text-[11px] tracking-widest uppercase transition-all duration-300 ${
          isGreenActive ? 'border-emerald-500/40 text-emerald-300' : 'border-zinc-800/40 text-sky-300/80'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            isSpeaking ? 'bg-emerald-400 animate-ping' : isListening ? 'bg-sky-400 animate-pulse' : 'bg-emerald-400'
          }`} />
          <span className="font-medium tracking-[0.18em]">
            {statusLabel}
          </span>
          {isSpeaking && (
            <button
              onClick={(e) => { e.stopPropagation(); onInterrupt(); }}
              className="ml-2 px-1 text-emerald-200 hover:text-emerald-100 text-[10px] underline cursor-pointer font-bold"
            >
              [Stop]
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

