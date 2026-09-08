import React from 'react';

interface CloudProps {
  top: string;
  left: string;
  opacity: number;
  speed: number;
  scale: number;
  delay: number;
  theme: string;
}

export const Cloud: React.FC<CloudProps> = ({ top, left, opacity, speed, scale, delay, theme }) => {
  const fillColor =
    theme === 'dark'
      ? 'rgba(200, 200, 255, 0.2)'
      : theme === 'accion'
        ? 'rgba(37, 158, 207, 0.25)'
        : 'rgba(255, 255, 255, 0.7)';
  
  return (
    <div 
      className="absolute pointer-events-none"
      style={{
        top,
        left,
        opacity,
        transform: `scale(${scale})`,
        animation: `float ${speed}s ease-in-out infinite alternate`,
        animationDelay: `${delay}s`,
      }}
    >
      <svg 
        width="120" 
        height="60" 
        viewBox="0 0 120 60" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M15 40C6.71573 40 0 33.2843 0 25C0 16.7157 6.71573 10 15 10C16.1046 10 17 10.8954 17 12C17 13.1046 16.1046 14 15 14C8.92487 14 4 18.9249 4 25C4 31.0751 8.92487 36 15 36H30.5C31.6046 36 32.5 36.8954 32.5 38C32.5 39.1046 31.6046 40 30.5 40H15Z" 
          fill={fillColor}
        />
        <path 
          d="M90 30C83.9249 30 79 25.0751 79 19C79 12.9249 83.9249 8 90 8C96.0751 8 101 12.9249 101 19C101 20.1046 101.895 21 103 21C104.105 21 105 20.1046 105 19C105 8.50659 96.4934 0 86 0C75.5066 0 67 8.50659 67 19C67 29.4934 75.5066 38 86 38H90Z" 
          fill={fillColor}
        />
        <path 
          d="M40 50C33.9249 50 29 45.0751 29 39C29 32.9249 33.9249 28 40 28C46.0751 28 51 32.9249 51 39C51 40.1046 51.8954 41 53 41C54.1046 41 55 40.1046 55 39C55 29.0589 49.9411 21 40 21C30.0589 21 25 29.0589 25 39C25 48.9411 30.0589 55 40 55H80C90.9411 55 95 48.9411 95 39C95 29.0589 89.9411 21 80 21C79.4477 21 79 20.5523 79 20C79 19.4477 79.4477 19 80 19C91.0457 19 100 27.9543 100 39C100 50.0457 91.0457 59 80 59H40C28.9543 59 20 50.0457 20 39C20 27.9543 28.9543 19 40 19C40.5523 19 41 19.4477 41 20C41 20.5523 40.5523 21 40 21C30.0589 21 25 29.0589 25 39C25 48.9411 30.0589 55 40 55Z" 
          fill={fillColor}
        />
      </svg>
      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateX(0) scale(${scale});
          }
          100% {
            transform: translateX(20px) scale(${scale});
          }
        }
      `}</style>
    </div>
  );
};

export const Clouds: React.FC<{ theme: string }> = ({ theme }) => {
  const clouds = [
    { top: '10%', left: '5%', opacity: 0.4, speed: 30, scale: 0.8, delay: 0 },
    { top: '20%', left: '70%', opacity: 0.3, speed: 40, scale: 0.6, delay: 5 },
    { top: '60%', left: '20%', opacity: 0.5, speed: 35, scale: 1, delay: 10 },
    { top: '40%', left: '60%', opacity: 0.3, speed: 50, scale: 0.7, delay: 15 },
    { top: '75%', left: '80%', opacity: 0.4, speed: 45, scale: 0.9, delay: 20 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {clouds.map((cloud, index) => (
        <Cloud key={index} theme={theme} {...cloud} />
      ))}
    </div>
  );
};
