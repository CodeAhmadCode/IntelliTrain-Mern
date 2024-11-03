import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../Home.css'; // Ensure this path is correct

const Home = () => {
    const navigate = useNavigate(); // Use useNavigate instead of useHistory

    const handleProjectClick = (projectType) => {
        navigate(`/${projectType}`); // Use navigate instead of history.push
    };

    return (
        <div className="home-container">
            <h2>Choose a Project Type</h2>
            <div className="project-blocks">
                <div className="project-block" onClick={() => handleProjectClick('image-project')}>
                    <h3>Image Project</h3>
                </div>
                <div className="project-block" onClick={() => handleProjectClick('audio-project')}>
                    <h3>Audio Project</h3>
                </div>
                <div className="project-block" onClick={() => handleProjectClick('pose-project')}>
                    <h3>Pose Project</h3>
                </div>
            </div>
        </div>
    );
};

export default Home;
