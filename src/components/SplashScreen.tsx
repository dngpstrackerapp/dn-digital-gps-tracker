import React, { useEffect } from 'react';
import { Compass } from 'lucide-react';
import { motion } from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      id="splash-screen" 
      className="absolute inset-0 bg-blue-600 flex flex-col items-center justify-between py-16 px-8 z-50 text-white"
    >
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Animated Brand Logo Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative mb-6"
        >
          {/* Pulsing background glow ring */}
          <div className="absolute inset-0 bg-blue-500/50 rounded-full blur-xl scale-125 animate-pulse"></div>
          
          <div className="relative bg-white text-blue-600 p-6 rounded-[24px] shadow-lg flex items-center justify-center">
            <Compass size={64} className="animate-[spin_10s_linear_infinite]" />
          </div>
        </motion.div>

        {/* Brand Name with clean display typography */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            DN GPS
          </h1>
          <p className="text-blue-100 font-medium tracking-wide text-xs uppercase">
            Real-time Fleet Tracking
          </p>
        </motion.div>
      </div>

      {/* Loader and Trademark Info at bottom */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-[200px] flex flex-col items-center gap-6"
      >
        {/* Modern Material 3 style linear loader */}
        <div className="w-full h-1 bg-blue-700/60 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full w-1/2 animate-[loading_1.5s_infinite_ease-in-out]"></div>
        </div>
        
        <div className="text-center">
          <span className="text-[10px] text-blue-200/80 font-medium tracking-wider uppercase">
            DN Secure Tracking System
          </span>
        </div>
      </motion.div>

      {/* Injection of the custom loading keyframes */}
      <style>{`
        @keyframes loading {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </div>
  );
}
