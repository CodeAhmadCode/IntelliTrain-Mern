import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Mic, PersonStanding } from 'lucide-react';

interface ModelProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
}

const Feature: React.FC<ModelProps> = ({ icon, title, description, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 * index }}
      viewport={{ once: true, margin: "-100px" }}
      className="bg-space-gray/50 backdrop-blur-sm p-6 rounded-lg border border-white/5 glow-border group hover:bg-space-gray/70 transition-all duration-300"
    >
      <div className="bg-white/10 rounded-lg p-4 w-12 h-12 flex items-center justify-center mb-4 
          group-hover:bg-white group-hover:text-space-black transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-white/70 text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
};

const Models: React.FC = () => {
  const models = [
    {
      icon: <Camera size={24} />,
      title: "Image Model",
      description: "Transform any image into intelligence. Train model to recognize objects, scenes, or patterns with just a few examples. Export web-ready in seconds.",
    },
    {
      icon: <Mic size={24} />,
      title: "Audio Model",
      description: "Give your AI ears. Create custom sound recognition model that respond to your voice, music, or any audio cue. No coding required.",
    },
    {
      icon: <PersonStanding size={24} />,
      title: "Pose Detection",
      description: "Capture movement in real-time. Build model that respond to gestures and body language for gaming, fitness, or interactive experiences.",
    },
    
  ];

   return (
    <section id="models" className="py-24 relative">
      <div className="absolute inset-0 grid-pattern opacity-10"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Supported <span className="text-glow">ML Models</span></h2>
          <p className="text-white/70 max-w-2xl mx-auto">
            INTELLITRAIN supports three core model types with browser-optimized architectures
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.map((model, index) => (
            <Feature
              key={index}
              icon={model.icon}
              title={model.title}
              description={model.description}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Models;