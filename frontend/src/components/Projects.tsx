import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { Camera, Mic, PersonStanding } from "lucide-react";
import ImageClassificationImage from "../assets/image classification.png";
import AudioClassificationImage from "../assets/audio detection.jpeg";
import PoseEstimationImage from "../assets/pose estimation.png";
import { Link } from 'react-router-dom';

interface Project {
  title: string;
  description: string;
  tags: string[];
  image: string;
  link: string;
  icon: JSX.Element;
}

const Projects: React.FC = () => {
  const [ ,setActiveProject] = useState<number | null>(null);
  
  const projects: Project[] = [
    {
      icon: <Camera size={24} />,
      title: "Image Models",
      description: "Create image classification & object detection models using transfer learning with MobileNetV2 architecture. Supports web-ready TensorFlow.js format.",
      image: ImageClassificationImage,
      link: "/projects/image-model",
      tags: ["Computer Vision", "Classification", "Detection"]
    },
    {
      icon: <Mic size={24} />,
      title: "Audio Models",
      description: "Build sound classification models using spectrogram analysis. Processes audio directly in browser with Web Audio API.",
      image: AudioClassificationImage,
      link: '/projects/audio-model',
      tags: ["Audio", "Speech", "Sound Recognition"]
    },
    {
      icon: <PersonStanding size={24} />,
      title: "Pose Detection",
      description: "Real-time body pose estimation models using MoveNet architecture. Captures 17 key body points at 30+ FPS.",
      image: PoseEstimationImage,
      link: "/projects/pose-model",
      tags: ["Motion", "Tracking", "Gesture"]
    }
  ];

  return (
    <section id="projects" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-space-black bg-opacity-70"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Featured <span className="text-glow">Projects</span></h2>
          <p className="text-white/70 max-w-2xl mx-auto">
            Explore our innovative solutions that push the boundaries of technology and design.
          </p>
        </motion.div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              viewport={{ once: true, margin: "-100px" }}
              className="relative group overflow-hidden rounded-lg shadow-xl"
              onMouseEnter={() => setActiveProject(index)}
              onMouseLeave={() => setActiveProject(null)}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-space-black via-transparent to-transparent z-10 pointer-events-none"></div>
              {/* Image Section */}
              <div className="h-48 w-full overflow-hidden">
                <img 
                  src={project.image} 
                  alt={project.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
               {/* Text Content Box */}
              <div className="bg-space-black p-6 space-y-4 min-h-[250px]">
                <div className="flex items-center gap-3 mb-2">
                  {project.icon}
                  <h3 className="text-xl font-bold">{project.title}</h3>
                </div>
              
              
               <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag, tagIndex) => (
                    <span 
                      key={tagIndex}
                      className="text-xs px-3 py-1 bg-white/10 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <p className="text-white/70 text-sm">
                  {project.description}
                </p>

                <Link
                  to={project.link}
                  className="inline-flex items-center text-sm font-medium hover:text-white/90 mt-4 group"
                >
                  <span className="mr-2">View Project</span>
                  <ExternalLink size={16} className="transform transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Projects;