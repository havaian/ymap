import React from 'react';

interface MapPlusIconProps {
  onClick?: () => void;
  className?: string;
}

export const MapPlusIcon: React.FC<MapPlusIconProps> = ({ onClick, className = '' }) => {
  return (
    <div 
      className={`bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2 rounded-xl shadow-md cursor-pointer ${className}`}
      onClick={onClick}
    >
      <img 
        src="/favicon.svg" 
        alt="Map Icon" 
        className="w-5 h-5"
      />
    </div>
  );
};