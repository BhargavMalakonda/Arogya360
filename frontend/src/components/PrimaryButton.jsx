import React from 'react';

const PrimaryButton = ({ children, onClick, type = 'button', disabled = false, className = '' }) => {
  return (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={`
        bg-gradient-to-r from-brand-indigo to-brand-purple
        text-white
        text-base
        font-semibold
        py-3.5 px-6
        rounded-xl
        shadow-lg
        hover:shadow-xl hover:opacity-95
        active:scale-[0.98]
        focus:outline-none focus:ring-2 focus:ring-brand-indigo focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-[150ms] ease-out
        ${className}
      `}
    >
      {children}
    </button>
  );
};

export default PrimaryButton;
