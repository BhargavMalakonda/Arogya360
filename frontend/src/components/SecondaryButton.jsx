import React from 'react';

const SecondaryButton = ({ children, onClick, type = 'button', disabled = false, className = '' }) => {
  return (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={`
        border border-brand-indigo/70
        text-brand-indigo
        text-base
        bg-transparent
        py-3.5 px-6
        rounded-xl
        hover:bg-brand-indigo/10
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

export default SecondaryButton;
