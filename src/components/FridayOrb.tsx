import React from 'react';
import { motion } from 'motion/react';
import { VoiceStatus } from '../hooks/useVoice';

interface FridayOrbProps {
  status: VoiceStatus;
  onClick: () => void;
}

export function FridayOrb({ status, onClick }: FridayOrbProps) {
  // Orb states based on FRIDAY's status
  const orbVariants = {
    idle: {
      scale: 1,
      boxShadow: '0px 0px 20px 0px rgba(14, 165, 233, 0.2)',
      borderColor: 'rgba(14, 165, 233, 0.3)',
      transition: { duration: 2, repeat: Infinity, repeatType: 'reverse' as const }
    },
    listening: {
      scale: 1.1,
      boxShadow: '0px 0px 40px 10px rgba(14, 165, 233, 0.6)',
      borderColor: 'rgba(14, 165, 233, 0.8)',
      transition: { duration: 0.5, repeat: Infinity, repeatType: 'reverse' as const }
    },
    processing: {
      scale: [1, 1.05, 1],
      rotate: [0, 180, 360],
      boxShadow: '0px 0px 30px 5px rgba(168, 85, 247, 0.5)',
      borderColor: 'rgba(168, 85, 247, 0.8)',
      transition: { duration: 1.5, repeat: Infinity, ease: 'linear' }
    },
    speaking: {
      scale: [1, 1.15, 1.05, 1.2, 1],
      boxShadow: [
        '0px 0px 20px 0px rgba(14, 165, 233, 0.4)',
        '0px 0px 60px 15px rgba(14, 165, 233, 0.8)',
        '0px 0px 30px 5px rgba(14, 165, 233, 0.5)',
        '0px 0px 70px 20px rgba(14, 165, 233, 0.9)',
        '0px 0px 20px 0px rgba(14, 165, 233, 0.4)'
      ],
      borderColor: 'rgba(14, 165, 233, 1)',
      transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8">
      <motion.button
        onClick={onClick}
        className="relative flex items-center justify-center rounded-full bg-zinc-950 border-4 cursor-pointer outline-none"
        style={{ width: '160px', height: '160px' }}
        variants={orbVariants}
        animate={status}
        whileHover={{ scale: status === 'idle' ? 1.05 : undefined }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Inner Core */}
        <motion.div 
          className="absolute rounded-full bg-gradient-to-tr from-sky-600 to-sky-300 opacity-80 mix-blend-screen"
          style={{ width: '120px', height: '120px' }}
          animate={{
            scale: status === 'speaking' ? [1, 1.1, 0.9, 1] : 1,
            rotate: status === 'processing' ? [0, -180, -360] : 0,
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        
        {/* Core highlight */}
        <div className="absolute w-16 h-16 rounded-full bg-white opacity-20 blur-xl top-4 left-4" />
      </motion.button>

      <div className="text-sky-400 font-mono text-sm tracking-[0.2em] uppercase opacity-70">
        {status === 'idle' && 'System Standby'}
        {status === 'listening' && 'Awaiting Input...'}
        {status === 'processing' && 'Processing...'}
        {status === 'speaking' && 'Transmitting'}
      </div>
    </div>
  );
}
