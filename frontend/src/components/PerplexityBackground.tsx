import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface FloatingOrb {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  speedX: number;
  speedY: number;
}

const PerplexityBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbsRef = useRef<FloatingOrb[]>([]);
  const animationRef = useRef<number | undefined>(undefined);

  const colors = [
    "rgba(99, 102, 241, 0.3)", // Indigo
    "rgba(139, 92, 246, 0.3)", // Purple
    "rgba(59, 130, 246, 0.3)", // Blue
    "rgba(16, 185, 129, 0.3)", // Emerald
    "rgba(245, 101, 101, 0.3)", // Red
    "rgba(251, 191, 36, 0.3)", // Amber
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createOrbs = () => {
      const orbCount = Math.floor(
        (window.innerWidth * window.innerHeight) / 15000
      );
      orbsRef.current = [];

      for (let i = 0; i < orbCount; i++) {
        orbsRef.current.push({
          id: i,
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 100 + 20,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: Math.random() * 0.5 + 0.1,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      orbsRef.current.forEach((orb) => {
        // Update position
        orb.x += orb.speedX;
        orb.y += orb.speedY;

        // Bounce off edges
        if (orb.x < -orb.size || orb.x > canvas.width + orb.size) {
          orb.speedX *= -1;
        }
        if (orb.y < -orb.size || orb.y > canvas.height + orb.size) {
          orb.speedY *= -1;
        }

        // Keep orbs within bounds
        orb.x = Math.max(-orb.size, Math.min(canvas.width + orb.size, orb.x));
        orb.y = Math.max(-orb.size, Math.min(canvas.height + orb.size, orb.y));

        // Create gradient
        const gradient = ctx.createRadialGradient(
          orb.x,
          orb.y,
          0,
          orb.x,
          orb.y,
          orb.size
        );
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

        // Draw orb
        ctx.globalAlpha = orb.opacity;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    resizeCanvas();
    createOrbs();
    animate();

    const handleResize = () => {
      resizeCanvas();
      createOrbs();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 perplexity-bg opacity-60" />

      {/* Canvas for floating orbs */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 opacity-40"
        style={{ filter: "blur(1px)" }}
      />

      {/* Additional animated elements */}
      <div className="absolute inset-0">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-gradient-to-r from-blue-400/20 to-purple-600/20"
            style={{
              width: `${Math.random() * 300 + 100}px`,
              height: `${Math.random() * 300 + 100}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              x: [0, Math.random() * 100 - 50],
              y: [0, Math.random() * 100 - 50],
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/20" />
    </div>
  );
};

export default PerplexityBackground;
