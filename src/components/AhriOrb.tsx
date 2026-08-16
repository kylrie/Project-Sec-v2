import React from 'react';
import { motion } from 'motion/react';
import { VoiceStatus } from '../hooks/useVoice';

interface AhriOrbProps {
  status: VoiceStatus;
  onClick: () => void;
}

export function AhriOrb({ status, onClick }: AhriOrbProps) {
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

        {/* 3D Ethereal Spirit Fox Orb Core */}
        <motion.div
          className="relative w-36 h-36 rounded-full bg-[radial-gradient(circle_at_35%_35%,#ffffff_0%,#38bdf8_40%,#0284c7_75%,#031422_100%)] shadow-[0_0_50px_rgba(56,189,248,0.6),inset_0_0_30px_rgba(255,255,255,0.4)] overflow-hidden flex items-center justify-center"
          animate={{
            scale: status === 'speaking' ? [1, 1.12, 0.98, 1.08, 1] : [0.98, 1.03, 0.98]
          }}
          transition={{ duration: status === 'speaking' ? 0.9 : 3.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Internal Swirling Spirit Energy Flows */}
          <motion.div
            className="absolute -inset-4 bg-gradient-to-r from-cyan-400/40 via-sky-300/60 to-indigo-500/40 rounded-full blur-md"
            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />

          {/* Shimmering Core Specular Flare */}
          <div className="absolute top-4 left-6 w-8 h-4 rounded-full bg-white/75 blur-[2px] transform -rotate-45 pointer-events-none" />
        </motion.div>
      </motion.button>
    </div>
  );
}

export { AhriOrb as FridayOrb };
