import { useEffect, useState } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import StarField from './components/StarField';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Models from './components/Models';
import Projects from './components/Projects';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';
import ImageClassificationModel from './pages/ImageClassificationModel';
import PoseClassificationModel from './pages/PoseEstimationModel';
import AudioClassificationModel from './pages/AudioClassificationModel';
import LoginSignup from './components/Login';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { verifyToken } from './utils/auth';

function App() {
  const { pathname } = useLocation();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [cursorVisible, setCursorVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status on initial load
    const checkAuth = async () => {
      const isAuthenticated = await verifyToken();
      setIsAuthenticated(isAuthenticated);
    };
    checkAuth();

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      setCursorVisible(true);
    };
    const handleMouseLeave = () => setCursorVisible(false);

    window.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="relative min-h-screen font-sans bg-space-black text-space-white overflow-x-hidden noise-filter">
      {/* Custom Cursor */}
      <div 
        className={`fixed w-6 h-6 rounded-full border border-white pointer-events-none mix-blend-difference z-50 ${
          cursorVisible ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-300`}
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`,
          transform: 'translate(-50%, -50%)'
        }}
      />

      {/* Star Field Background */}
      <StarField />

      {/* Main Content */}
      <div className="relative z-10">
        <Navbar isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated} />

        <Routes>
          <Route path="/" element={
            <>
              <Hero />
              <Models />
              <Projects />
              <About />
              <Contact />
            </>
          }/>

          <Route path="/login" element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginSignup setIsAuthenticated={setIsAuthenticated} />
            )
          } />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Dashboard />
              </ProtectedRoute>
            } 
          />

          <Route path="/projects/image-model" element={<ImageClassificationModel />} />
          <Route path="/projects/pose-model" element={<PoseClassificationModel />} />
          <Route path="/projects/audio-model" element={<AudioClassificationModel />} />
        </Routes>

        {pathname === '/' && <Footer />}
      </div>
    </div>
  );
}

export default App;