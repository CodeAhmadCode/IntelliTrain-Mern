import React from 'react';
import { motion } from 'framer-motion';

const About: React.FC = () => {
  return (
    <section id="about" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-space-black bg-opacity-70"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">About <span className="text-glow">IntelliTrain</span></h2>
            <p className="text-white/70 mb-6 leading-relaxed">
              Founded in 2024, IntelliTrain democratizes AI by putting the power of machine learning in everyone's hands. Our platform enables anyone to create custom computer vision and audio models without writing a single line of code.

            </p>
            <p className="text-white/70 mb-6 leading-relaxed">
              We believe AI should be accessible, not intimidating. Our intuitive interface lets you teach machines through demonstration, turning your examples into powerful recognition models that work in real-time across any device.
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 p-4 rounded">
                <div className="text-3xl font-bold mb-1">Real Time </div>
                <div className="text-sm text-white/70">Processing</div>
              </div>
              <div className="bg-white/5 p-4 rounded">
                <div className="text-3xl font-bold mb-1">Browser</div>
                <div className="text-sm text-white/70">No Cloud Required</div>
              </div>
              <div className="bg-white/5 p-4 rounded">
                <div className="text-3xl font-bold mb-1">Export</div>
                <div className="text-sm text-white/70">Cross Platform Models</div>
              </div>
              <div className="bg-white/5 p-4 rounded">
                <div className="text-3xl font-bold mb-1">Privacy</div>
                <div className="text-sm text-white/70">Data Stays Local</div>
              </div>
            </div>
            
            <a 
              href="#models" 
              className="inline-block px-6 py-3 rounded border border-white hover:bg-white hover:text-space-black transition-all duration-300 text-sm uppercase tracking-wider font-medium"
            >
              Get Started
            </a>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true, margin: "-100px" }}
            className="relative"
          >
            <div className="aspect-square relative bg-space-gray/30 backdrop-blur-sm rounded-lg overflow-hidden grid-pattern">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 h-3/4 relative">
                  <div className="absolute inset-0 bg-white/10 rounded-full animate-pulse duration-1000"></div>
                  <div className="absolute inset-8 bg-white/10 rounded-full animate-pulse duration-1500 delay-500"></div>
                  <div className="absolute inset-16 bg-white/10 rounded-full animate-pulse duration-2000 delay-1000"></div>
                  <div className="absolute inset-24 bg-white/20 rounded-full"></div>
                </div>
              </div>
            </div>
            
            <div className="absolute -bottom-6 -right-6 bg-white text-space-black p-4 rounded-lg w-36 h-36 flex flex-col items-center justify-center text-center shadow-lg">
              <div className="font-bold text-xl">Zero Code</div>
              <div className="text-sm">Just show & train</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;