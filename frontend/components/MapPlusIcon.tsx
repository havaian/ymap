import React from 'react';

interface MapPlusIconProps {
  onClick?: () => void;
  className?: string;
}

export const MapPlusIcon: React.FC<MapPlusIconProps> = ({ onClick, className = '' }) => {
  return (
    <img 
        src="/assets/images/icons/icon.svg" 
        alt="Map Icon" 
        className="w-8 h-8"
    />
  );
};