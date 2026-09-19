import React from 'react';

const CardContainer = ({ children, className = '' }) => {
  return (
    <div className={`bg-white/80 border border-gray-200 shadow-md rounded-2xl p-6 transition-all duration-200 ease-out hover:shadow-lg hover:-translate-y-px ${className}`}>
      {children}
    </div>
  );
};

export default CardContainer;
