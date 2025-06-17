import React from 'react';
import { motion } from 'framer-motion';
import { Github, Twitter, Linkedin, Instagram } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="py-12 bg-space-black border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            <div className="flex items-center mb-4">
              <div className="h-6 w-6 rounded-full bg-space-white flex items-center justify-center mr-2">
                <div className="h-1.5 w-1.5 bg-space-black rounded-full"></div>
              </div>
              <span className="text-lg font-bold tracking-tight">INTELLITRAIN</span>
            </div>
            <p className="text-white/60 text-sm mb-4 max-w-md">
              Making AI accessible to everyone through intuitive training interfaces that transform your examples into powerful computer vision and audio models.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-white/70 hover:text-white transition-colors duration-300">
                <Github size={18} />
              </a>
              <a href="#" className="text-white/70 hover:text-white transition-colors duration-300">
                <Twitter size={18} />
              </a>
              <a href="#" className="text-white/70 hover:text-white transition-colors duration-300">
                <Linkedin size={18} />
              </a>
              <a href="#" className="text-white/70 hover:text-white transition-colors duration-300">
                <Instagram size={18} />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><a href="#home" className="text-white/70 hover:text-white text-sm transition-colors duration-300">Home</a></li>
              <li><a href="#features" className="text-white/70 hover:text-white text-sm transition-colors duration-300">Features</a></li>
              <li><a href="#projects" className="text-white/70 hover:text-white text-sm transition-colors duration-300">Projects</a></li>
              <li><a href="#about" className="text-white/70 hover:text-white text-sm transition-colors duration-300">About</a></li>
              <li><a href="#contact" className="text-white/70 hover:text-white text-sm transition-colors duration-300">Contact</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4">Resources</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-white/70 hover:text-white text-sm transition-colors duration-300">Documentation</a></li>
              <li><a href="#" className="text-white/70 hover:text-white text-sm transition-colors duration-300">API Reference</a></li>
              <li><a href="#" className="text-white/70 hover:text-white text-sm transition-colors duration-300">Tutorials</a></li>
              <li><a href="#" className="text-white/70 hover:text-white text-sm transition-colors duration-300">Blog</a></li>
              <li><a href="#" className="text-white/70 hover:text-white text-sm transition-colors duration-300">Newsletter</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-white/50 text-xs mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Intellitrain. All rights reserved.
          </p>
          <div className="flex space-x-4 text-xs text-white/50">
            <a href="#" className="hover:text-white transition-colors duration-300">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors duration-300">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors duration-300">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;