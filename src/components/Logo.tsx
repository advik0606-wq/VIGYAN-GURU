import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Sparkles, BookOpen } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 'md' }) => {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-24 h-24',
    xl: 'w-28 h-28'
  };

  const ringSizes = {
    sm: ['w-10 h-10', 'w-7 h-7'],
    md: ['w-14 h-14', 'w-10 h-10'],
    lg: ['w-24 h-24', 'w-18 h-18'],
    xl: ['w-28 h-28', 'w-22 h-22']
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14'
  };

  return (
    <div className={`relative flex items-center justify-center ${sizes[size]} ${className}`}>
      {/* Knowledge Aura */}
      <motion.div 
        animate={{ 
          scale: [1, 1.25, 1],
          opacity: [0.15, 0.4, 0.15]
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-gradient-to-tr from-violet-600 to-sky-400 rounded-full blur-2xl"
      />

      {/* Orbiting Insight Rings */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className={`absolute ${ringSizes[size][0]} border border-dashed border-white/20 rounded-full`}
      />

      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className={`absolute ${ringSizes[size][1]} border border-violet-500/20 rounded-full flex items-start justify-center p-0.5`}
      >
        <div className="w-1 h-1 bg-amber-400 rounded-full shadow-[0_0_8px_#fbbf24]" />
      </motion.div>

      {/* The Core: Scholar's Pillar */}
      <motion.div 
        whileHover={{ scale: 1.1, rotate: 10 }}
        className="relative z-10 flex items-center justify-center"
      >
        {/* Diamond Geometric Shield */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-900 rounded-xl rotate-45 shadow-2xl shadow-violet-900/40 border border-white/10" />
        
        {/* Core Icon: Graduation Cap */}
        <div className="relative z-20 p-2">
          <motion.div
            animate={{ 
              y: [0, -4, 0],
              filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <GraduationCap className={`${iconSizes[size]} text-white drop-shadow-lg`} />
          </motion.div>
        </div>

        {/* Small Glowing "Pages" or "Sparkles" around the core */}
        <motion.div
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-2 -right-2 text-sky-300"
        >
          <Sparkles className="w-4 h-4" />
        </motion.div>
      </motion.div>

      {/* Rising "Ideas" Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: 20, x: 0, opacity: 0 }}
            animate={{
              y: [-10, -50],
              x: [(i - 1.5) * 15, (i - 1.5) * 25],
              opacity: [0, 0.8, 0],
              scale: [0.2, 0.8, 0]
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              delay: i * 0.7,
              ease: "easeOut"
            }}
            className="absolute bottom-1/2 left-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_6px_white]"
          />
        ))}
      </div>
    </div>
  );
};
