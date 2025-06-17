import React, { useRef, useEffect } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  direction: number;
}

const StarField: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stars = useRef<Star[]>([]);
  const animationFrameId = useRef<number>(0);

  const initStars = (width: number, height: number) => {
    stars.current = [];
    const starCount = Math.floor((width * height) / 1500); // Responsive star density
    
    for (let i = 0; i < starCount; i++) {
      stars.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.2 + 0.2,
        opacity: Math.random() * 0.5 + 0.3,
        speed: Math.random() * 0.4 + 0.1,
        direction: Math.random() > 0.5 ? 1 : -1,
      });
    }
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    stars.current.forEach(star => {
      ctx.beginPath();
      const grd = ctx.createRadialGradient(
        star.x, star.y, 0, 
        star.x, star.y, star.size * 2
      );
      grd.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`);
      grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = grd;
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
      
      // Make stars pulse and move slightly
      star.opacity += 0.01 * star.direction;
      if (star.opacity >= 0.8 || star.opacity <= 0.2) {
        star.direction *= -1;
      }
      
      star.y += star.speed;
      
      // Loop stars from bottom to top
      if (star.y > canvas.height) {
        star.y = 0;
        star.x = Math.random() * canvas.width;
      }
    });
    
    animationFrameId.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars(canvas.width, canvas.height);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    animate();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
};

export default StarField;