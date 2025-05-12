import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const Hero: React.FC = () => {
  const [typedText, setTypedText] = useState('');
  const fullText = 'The AI that watches and listens.';
  
  useEffect(() => {
    if (typedText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.slice(0, typedText.length + 1));
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [typedText]);

  return (
    <section id="home" className="min-h-screen flex items-center justify-center relative overflow-hidden pt-20">
      <div className="absolute inset-0 grid-pattern opacity-20"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 text-center mt-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-6"
        >
          <span className="inline-block px-3 py-1 text-xs tracking-widest uppercase bg-white/10 rounded-full">
            AI that learns your way. No code required.
          </span>
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight mb-6"
        >
          INTELLITRAIN
          <span className="block text-xl md:text-2xl lg:text-3xl text-glow mt-3">CUSTOM MACHINE LEARNING MODELS</span>
        </motion.h1>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="h-16 mb-10"
        >
          <h2 className="text-xl md:text-2xl font-light tracking-wide mt-10">
            {typedText}
            <span className="animate-pulse">|</span>
          </h2>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="flex flex-col sm:flex-row justify-center gap-4 mb-16"
        >
          <a 
            href="#features" 
            className="px-8 py-3 rounded border border-white hover:bg-white hover:text-space-black transition-all duration-300 button-glow text-sm uppercase tracking-wider font-medium mt-5"
          >
            Explore Models
          </a>
          {/* <a 
            href="#projects" 
            className="px-8 py-3 rounded bg-white text-space-black hover:bg-opacity-90 transition-all duration-300 text-sm uppercase tracking-wider font-medium"
          >
            View Projects
          </a> */}
        </motion.div>

        {/* <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.4 }}
          className="absolute bottom-16 left-1/2 transform -translate-x-1/2"
        >
          <div className="flex flex-col items-center">
            
            <div className="w-6 h-10 rounded-full border border-white/30 flex justify-center p-1">
              <motion.div 
                className="w-1 h-2 bg-white rounded-full"
                animate={{ 
                  y: [0, 15, 0],
                }}
                transition={{ 
                  duration: 1.5, 
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
              />
            </div>
          </div>
        </motion.div> */}
      </div>
    </section>
  );
};

export default Hero;