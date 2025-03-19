import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../assets/logo.png';
import './Navbar.css'; // Import the CSS file for styles

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-content">
          <Link to="/" className="navbar-brand">
            <div className="logo-container">
              <img 
                src={Logo} 
                alt="IntelliTrain Logo" 
                className="logo" 
              />
              <h1 className="brand-name">IntelliTrain</h1>
            </div>
          </Link>
          <div className="navbar-links">
            <Link to="/image-model" className="nav-link">
              Image Model
            </Link>
            <Link to="/pose-model" className="nav-link">
              Pose Model
            </Link>
            <Link to="/audio-model" className="nav-link">
              Audio Model
            </Link>
            <Link to="/datasets" className="nav-link">
              Datasets
            </Link>
            <Link to="/faq" className="nav-link">
              FAQ
            </Link>
            <Link to="/auth" className="login-button">
              <span>Login</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
