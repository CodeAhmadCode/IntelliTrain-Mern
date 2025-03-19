import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar'; // Import Navbar
import Home from './pages/Home';
import Result from './components/Result';
import ImageProject from './pages/ImageProject';
import AudioProject from './pages/AudioProject';
import PoseProject from './pages/PoseProject';

const App = () => {
  return (
    <Router>
      <div>
        <Navbar /> {/* Navbar added here */}
       
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/result" element={<Result />} />
          <Route path="/image-project" element={<ImageProject />} />
          <Route path="/audio-project" element={<AudioProject />} />
          <Route path="/pose-project" element={<PoseProject />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
