import React from 'react';

interface MapPlusIconProps {
  onClick?: () => void;
  className?: string;
}

export const MapPlusIcon: React.FC<MapPlusIconProps> = ({ onClick, className }) => {
  return (
    <button 
      onClick={onClick}
      className={`focus:outline-none hover:opacity-80 transition-opacity cursor-pointer ${className || ''}`}
    >
      <img 
        src="/assets/images/icons/icon.svg" 
        alt="Y.Map Logo" 
        className="w-8 h-8"
      />
    </button>
  );
};