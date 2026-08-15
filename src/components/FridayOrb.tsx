import React from 'react';
import { motion } from 'motion/react';
import { VoiceStatus } from '../hooks/useVoice';

interface FridayOrbProps {
  status: VoiceStatus;
  onClick: () => void;
}

export function FridayOrb({ status, onClick }: FridayOrbProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-6 select-none">
      <motion.button
        onClick={onClick}
        className="relative flex items-center justify-center rounded-full bg-transparent border-0 cursor-pointer outline-none shadow-none"
        style={{ width: '220px', height: '220px' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
      >
        {/* Outer Volumetric Ethereal Spirit Aura */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-sky-500/25 via-cyan-400/20 to-transparent blur-2xl"
          animate={{
            scale: status === 'speaking' ? [1, 1.25, 1] : [0.95, 1.05, 0.95],
            opacity: status === 'speaking' ? [0.6, 0.95, 0.6] : [0.35, 0.6, 0.35]
          }}
          transition={{ duration: status === 'speaking' ? 0.8 : 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Outer Swirling Spirit Vortex Ring */}
        <motion.div
          className="absolute inset-2 rounded-full border border-sky-400/30 opacity-70"
          animate={{ rotate: 360 }}
          transition={{ duration: status === 'processing' ? 3 : 18, repeat: Infinity, ease: 'linear' }}
        />

        <motion.div
          className="absolute inset-5 rounded-full border border-cyan-300/25 opacity-60"
          animate={{ rotate: -360 }}
          transition={{ duration: status === 'processing' ? 4 : 24, repeat: Infinity, ease: 'linear' }}
        />

        {/* 3D Ethereal Spirit Fox Orb Core (Borderless Fluid Spirit Plasma) */}
        <motion.div
          className="relative w-36 h-36 rounded-full bg-[radial-gradient(circle_at_35%_35%,#ffffff_0%,#38bdf8_40%,#0284c7_75%,#031422_100%)] shadow-[0_0_50px_rgba(56,189,248,0.6),inset_0_0_30px_rgba(255,255,255,0.4)] overflow-hidden flex items-center justify-center"
          animate={{
            scale: status === 'speaking' ? [1, 1.12, 0.98, 1.08, 1] : [0.98, 1.03, 0.98]
          }}
          transition={{ duration: status === 'speaking' ? 0.9 : 3.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Inner Swirling Spirit Fox Silhouette & Spiral Filaments */}
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.95)_0%,rgba(56,189,248,0.6)_50%,transparent_85%)] mix-blend-overlay"
            animate={{ rotate: status === 'processing' ? 360 : -360 }}
            transition={{ duration: status === 'processing' ? 2 : 12, repeat: Infinity, ease: 'linear' }}
          />

          {/* Incandescent Fox Soul Center */}
          <motion.div
            className="w-10 h-10 rounded-full bg-white shadow-[0_0_25px_#38bdf8,0_0_50px_#7dd3fc]"
            animate={{
              scale: status === 'speaking' ? [0.9, 1.3, 0.9] : [0.85, 1.1, 0.85],
              opacity: [0.8, 1, 0.8]
            }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </motion.button>

      {/* Floating Ethereal Shorthand Status Label (No Borders) */}
      <div className="text-cyan-300 font-mono text-xs tracking-[0.25em] uppercase opacity-85 drop-shadow-[0_0_10px_rgba(56,189,248,0.4)] flex items-center space-x-2">
        <span className={`w-1.5 h-1.5 rounded-full ${status === 'speaking' ? 'bg-cyan-300 animate-ping' : status === 'listening' ? 'bg-sky-400 animate-pulse' : 'bg-cyan-400'}`} />
        <span>
          {status === 'idle' && 'SPIRIT CORE STANDBY'}
          {status === 'listening' && 'CELESTIAL INPUT...'}
          {status === 'processing' && 'SYNAPSE PROCESSING...'}
          {status === 'speaking' && 'TRANSMITTING'}
        </span>
      </div>
    </div>
  );
}
