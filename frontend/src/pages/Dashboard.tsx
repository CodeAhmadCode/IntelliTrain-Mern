import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BarChart2, Settings, FileText, User, Zap, Database, LogOut } from 'lucide-react';

const Dashboard: React.FC = () => {
  const stats = [
    { title: "Active Models", value: "12", change: "+3 this week", icon: <Zap className="w-6 h-6" /> },
    { title: "Projects", value: "7", change: "+1 this week", icon: <FileText className="w-6 h-6" /> },
    { title: "Data Sources", value: "24", change: "No change", icon: <Database className="w-6 h-6" /> },
    { title: "API Calls", value: "1.2K", change: "+210 today", icon: <BarChart2 className="w-6 h-6" /> },
  ];

  const recentActivities = [
    { action: "Trained new image model", time: "2 hours ago", project: "Object Detection" },
    { action: "Deployed pose estimation API", time: "1 day ago", project: "Fitness Tracker" },
    { action: "Added new dataset", time: "2 days ago", project: "Sentiment Analysis" },
    { action: "Updated project settings", time: "3 days ago", project: "Speech Recognition" },
  ];

  return (
    <section className="min-h-screen bg-space-black text-white p-6 relative pt-24">
      <div className="absolute inset-0 grid-pattern opacity-20"></div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex justify-between items-center mb-10"
        >
          <div>
            <h1 className="text-3xl font-bold mb-2 text-glow">Dashboard</h1>
            <p className="text-space-white/70">Welcome back to your AI workspace</p>
          </div>
          <div className="flex space-x-4">
            <Link 
              to="/" 
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-300 flex items-center"
            >
              <Settings className="w-5 h-5 mr-2" />
              Settings
            </Link>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10"
        >
          {stats.map((stat, index) => (
            <div 
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-cyan-400/30 transition-all duration-500"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-space-white/70 mb-1">{stat.title}</p>
                  <h3 className="text-2xl font-bold mb-2">{stat.value}</h3>
                  <p className={`text-xs ${
                    stat.change.includes('+') ? 'text-green-400' : 
                    stat.change === 'No change' ? 'text-yellow-400' : 'text-white/70'
                  }`}>
                    {stat.change}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activities */}
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Recent Activities</h2>
              <Link to="/projects" className="text-sm text-cyan-400 hover:text-cyan-300">View All</Link>
            </div>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start pb-4 border-b border-white/10 last:border-0">
                  <div className="p-2 mr-4 rounded-full bg-cyan-500/10">
                    <User className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-space-white/70">{activity.project}</p>
                  </div>
                  <div className="text-sm text-space-white/50">{activity.time}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-bold mb-6">Quick Actions</h2>
            <div className="space-y-3">
              <Link 
                to="/projects/image-model" 
                className="flex items-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-300 group"
              >
                <div className="p-2 mr-4 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-all">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium">New Image Model</h3>
                  <p className="text-sm text-space-white/70">Computer vision projects</p>
                </div>
              </Link>
              <Link 
                to="/projects/audio-model" 
                className="flex items-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-300 group"
              >
                <div className="p-2 mr-4 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-all">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium">New Audio Model</h3>
                  <p className="text-sm text-space-white/70">Speech processing</p>
                </div>
              </Link>
              <Link 
                to="/projects/pose-model" 
                className="flex items-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-300 group"
              >
                <div className="p-2 mr-4 rounded-lg bg-green-500/10 text-green-400 group-hover:bg-green-500/20 transition-all">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium">New Pose Model</h3>
                  <p className="text-sm text-space-white/70">Motion detection</p>
                </div>
              </Link>
              <button className="w-full flex items-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-300 group text-left">
                <div className="p-2 mr-4 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500/20 transition-all">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium">Logout</h3>
                  <p className="text-sm text-space-white/70">End your session</p>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;