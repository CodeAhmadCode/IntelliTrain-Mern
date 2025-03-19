import React from "react";
import { FaCamera, FaMicrophone, FaRunning } from "react-icons/fa";
import Logo from "../assets/logo.png";
import ImageRecognition from "../assets/image.jpeg";
import PoseDetection from "../assets/pose.jpeg";
import AudioRecognition from "../assets/audio.jpeg";
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <div style={{ backgroundColor: "#065c5c", color: "white", minHeight: "100vh", margin: 0, padding: 0 }}>
      {/* Hero Section */}
      <div style={{ textAlign: "center", marginBottom: "4rem" }}>
        <img
          src={Logo}
          alt="IntelliTrain Logo"
          style={{
            width: "8rem",
            height: "8rem",
            margin: "0 auto",
          }}
        />
        <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
          IntelliTrain
        </h1>
        <p
          style={{
            fontSize: "1.25rem",
            marginBottom: "2rem",
            color: "#D3D3D3",
          }}
        >
          Train custom machine learning models right in your browser
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
          <button
            style={{
              backgroundColor: "#FFD700",
              color: "#000",
              padding: "0.75rem 2rem",
              borderRadius: "0.5rem",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
            }}
          >
            Get Started
          </button>
          <button
            style={{
              border: "2px solid #FFD700",
              color: "#FFD700",
              padding: "0.75rem 2rem",
              borderRadius: "0.5rem",
              fontWeight: "bold",
              cursor: "pointer",
              background: "none",
            }}
          >
            View Examples
          </button>
        </div>
      </div>

      {/* Features Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "4rem",
        }}
      >
        {/* Image Model */}
        <div
          style={{
            backgroundColor: "#333",
            borderRadius: "0.5rem",
            padding: "2rem",
            flex: 1,
            textAlign: "center",
            transition: "transform 0.3s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5rem" }}>
            <div
              style={{
                backgroundColor: "#FFD700",
                padding: "1rem",
                borderRadius: "0.5rem",
              }}
            >
              <FaCamera style={{ fontSize: "2rem", color: "#000" }} />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginLeft: "1rem" }}>
              Image Model
            </h2>
          </div>
          <p style={{ color: "#D3D3D3", marginBottom: "1.5rem" }}>
            Teach a model to classify images using files or your webcam.
          </p>
          <img
            src={ImageRecognition}
            alt="Image Recognition Demo"
            style={{
              width: "100%",
              height: "12rem",
              objectFit: "cover",
              borderRadius: "0.5rem",
              marginBottom: "1rem",
            }}
          />
          <button
            style={{
              backgroundColor: "#FFD700",
              color: "#000",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => handleNavigation('/image-project')}
          >
            Try Image Model
          </button>
        </div>

        {/* Pose Model */}
        <div
          style={{
            backgroundColor: "#333",
            borderRadius: "0.5rem",
            padding: "2rem",
            flex: 1,
            textAlign: "center",
            transition: "transform 0.3s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5rem" }}>
            <div
              style={{
                backgroundColor: "#FFD700",
                padding: "1rem",
                borderRadius: "0.5rem",
              }}
            >
              <FaRunning style={{ fontSize: "2rem", color: "#000" }} />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginLeft: "1rem" }}>
              Pose Model
            </h2>
          </div>
          <p style={{ color: "#D3D3D3", marginBottom: "1.5rem" }}>
            Teach a model to classify body positions using files or striking poses in
            your webcam.
          </p>
          <img
            src={PoseDetection}
            alt="Pose Detection Demo"
            style={{
              width: "100%",
              height: "12rem",
              objectFit: "cover",
              borderRadius: "0.5rem",
              marginBottom: "1rem",
            }}
          />
          <button
            style={{
              backgroundColor: "#FFD700",
              color: "#000",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => handleNavigation('/pose-project')}
          >
            Try Pose Model
          </button>
        </div>

        {/* Audio Model */}
        <div
          style={{
            backgroundColor: "#333",
            borderRadius: "0.5rem",
            padding: "2rem",
            flex: 1,
            textAlign: "center",
            transition: "transform 0.3s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5rem" }}>
            <div
              style={{
                backgroundColor: "#FFD700",
                padding: "1rem",
                borderRadius: "0.5rem",
              }}
            >
              <FaMicrophone style={{ fontSize: "2rem", color: "#000" }} />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginLeft: "1rem" }}>
              Audio Model
            </h2>
          </div>
          <p style={{ color: "#D3D3D3", marginBottom: "1.5rem" }}>
            Teach a model to classify audio by recording short sound samples.
          </p>
          <img
            src={AudioRecognition}
            alt="Audio Recognition Demo"
            style={{
              width: "100%",
              height: "12rem",
              objectFit: "cover",
              borderRadius: "0.5rem",
              marginBottom: "1rem",
            }}
          />
          <button
            style={{
              backgroundColor: "#FFD700",
              color: "#000",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => handleNavigation('/audio-project')}
          >
            Try Audio Model
          </button>
        </div>
      </div>

      {/* How It Works Section */}
      <div style={{ backgroundColor: "#044a4a", borderRadius: "1rem", padding: "2rem", marginBottom: "4rem" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1rem", textAlign: "center" }}>How It Works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ backgroundColor: "#056f6f", width: "4rem", height: "4rem", borderRadius: "50%", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>1</span>
            </div>
            <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Gather Samples</h3>
            <p style={{ color: "#D3D3D3" }}>Collect images, poses, or sounds for each class</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ backgroundColor: "#056f6f", width: "4rem", height: "4rem", borderRadius: "50%", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>2</span>
            </div>
            <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Train Model</h3>
            <p style={{ color: "#D3D3D3" }}>Train your model with one click</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ backgroundColor: "#056f6f", width: "4rem", height: "4rem", borderRadius: "50%", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>3</span>
            </div>
            <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Test</h3>
            <p style={{ color: "#D3D3D3" }}>Try out your model in real-time</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ backgroundColor: "#056f6f", width: "4rem", height: "4rem", borderRadius: "50%", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>4</span>
            </div>
            <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Deploy</h3>
            <p style={{ color: "#D3D3D3" }}>Deploy your trained model for wider use</p>
          </div>
        </div>
      </div>
       {/* Contact Section */}
       <div style={{ textAlign: "center", padding: "2rem", backgroundColor: "#032b2b", borderRadius: "1rem" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1rem" }}>Contact Us</h2>
        <p style={{ color: "#D3D3D3", marginBottom: "1rem" }}>Have any questions? Get in touch with us!</p>
        <button
          style={{
            backgroundColor: "#FFD700",
            color: "#000",
            padding: "0.75rem 2rem",
            borderRadius: "0.5rem",
            fontWeight: "bold",
            border: "none",
            cursor: "pointer",
          }}
        >
          Get in Touch
        </button>
      </div>
    </div>
    
  );
}

export default Home;
