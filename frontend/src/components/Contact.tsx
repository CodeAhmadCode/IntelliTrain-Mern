import React from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';

const Contact: React.FC = () => {
  return (
    <section id="contact" className="py-24 relative">
      <div className="absolute inset-0 grid-pattern opacity-10"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Get In <span className="text-glow">Touch</span></h2>
          <p className="text-white/70 max-w-2xl mx-auto">
            Have a project in mind or questions about IntelliTrain? We'd love to hear from you.
          </p>
        </motion.div>
        
        <div className="max-w-3xl mx-auto">
          <div className="bg-space-gray/30 backdrop-blur-sm p-8 rounded-lg border border-white/5 glow-border mb-8">
            <form>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  viewport={{ once: true, margin: "-100px" }}
                >
                  <label htmlFor="name" className="block text-sm font-medium mb-2">Name</label>
                  <input
                    type="text"
                    id="name"
                    className="w-full bg-space-black/50 border border-white/10 rounded-md py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/50 transition-all duration-300"
                    placeholder="Enter your name"
                  />
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  viewport={{ once: true, margin: "-100px" }}
                >
                  <label htmlFor="email" className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    id="email"
                    className="w-full bg-space-black/50 border border-white/10 rounded-md py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/50 transition-all duration-300"
                    placeholder="Enter your email"
                  />
                </motion.div>
              </div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                viewport={{ once: true, margin: "-100px" }}
                className="mb-6"
              >
                <label htmlFor="subject" className="block text-sm font-medium mb-2">Subject</label>
                <input
                  type="text"
                  id="subject"
                  className="w-full bg-space-black/50 border border-white/10 rounded-md py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/50 transition-all duration-300"
                  placeholder="Enter subject"
                />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                viewport={{ once: true, margin: "-100px" }}
                className="mb-6"
              >
                <label htmlFor="message" className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  id="message"
                  rows={6}
                  className="w-full bg-space-black/50 border border-white/10 rounded-md py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/50 transition-all duration-300"
                  placeholder="Your message"
                ></textarea>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                viewport={{ once: true, margin: "-100px" }}
                className="text-center"
              >
                <button
                  type="submit"
                  className="inline-flex items-center px-6 py-3 rounded bg-white text-space-black hover:bg-opacity-90 transition-all duration-300 text-sm uppercase tracking-wider font-medium"
                >
                  <span className="mr-2">Send Message</span>
                  <Send size={16} />
                </button>
              </motion.div>
            </form>
          </div>
          
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center text-white/50 text-sm"
          >
            {/* <p>Or reach us directly at <a href="mailto:contact@intellitrain.io" className="text-white hover:text-glow transition-all duration-300">contact@intellitrain.io</a></p> */}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Contact;