import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTextToSpeech } from '../hooks/useTextToSpeech';

const MCQOptionButton = ({ children, onClick, active = false, className = '' }) => {
  const { userProfile } = useAuth();
  const { speak, stop, isSpeaking, isSupported } = useTextToSpeech(
    userProfile?.language_pref ?? 'en',
  );

  // Derive the plain text label from children (string or React node)
  const textLabel = typeof children === 'string' ? children : '';

  const handleSpeakerClick = (e) => {
    // Critical: prevent click from bubbling up to the parent button and
    // selecting this MCQ option just because the user wanted to hear it read aloud.
    e.stopPropagation();
    if (isSpeaking) {
      stop();
    } else {
      speak(textLabel);
    }
  };

  return (
    <button
      onClick={onClick}
      style={{
        // Default: Level 1 glass surface
        background: active
          ? 'rgba(88,86,214,0.08)'
          : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        border: active
          ? '1.5px solid rgba(88,86,214,0.55)'
          : '1px solid rgba(255,255,255,0.85)',
        borderRadius: '14px',
        boxShadow: active
          ? '0 0 0 3px rgba(88,86,214,0.12), 0 4px 16px rgba(88,86,214,0.10)'
          : '0 2px 8px rgba(30,31,59,0.04)',
        transition: 'all 0.18s ease-out',
        minHeight: '52px',           // ≥44px touch target
      }}
      className={[
        'w-full text-left',
        'px-4 py-3.5',
        'flex items-center justify-between gap-3',
        // Hover: lift + glow (CSS class handles translateY; inline style handles background)
        !active && 'hover:shadow-[0_4px_18px_rgba(88,86,214,0.14)] hover:-translate-y-px',
        // Active press
        'active:scale-[0.99]',
        // Focus ring
        'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 focus:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-all duration-[180ms] ease-out',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* Radio indicator + label */}
      <span className="flex items-center gap-3 flex-1 min-w-0">
        {/* Radio circle */}
        <span
          className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200"
          style={{
            border: active ? '5px solid #5856D6' : '2px solid rgba(88,86,214,0.35)',
            background: active ? 'white' : 'transparent',
          }}
          aria-hidden="true"
        />
        <span className={[
          'text-[14px] font-body leading-snug',
          active ? 'font-semibold text-brand-indigo' : 'text-on-surface',
        ].join(' ')}>
          {children}
        </span>
      </span>

      {/* TTS speaker button — handleSpeakerClick with e.stopPropagation() UNCHANGED */}
      {isSupported && textLabel && (
        <span
          role="button"
          tabIndex={0}
          onClick={handleSpeakerClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSpeakerClick(e); }}
          aria-label={isSpeaking ? 'Stop reading option' : 'Read option aloud'}
          title={isSpeaking ? 'Stop' : 'Read aloud'}
          className={[
            'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-indigo-400',
            isSpeaking
              ? 'bg-brand-indigo text-white animate-pulse shadow-[0_2px_8px_rgba(88,86,214,0.45)]'
              : 'text-brand-indigo/60 hover:text-brand-indigo border border-brand-indigo/20 hover:border-brand-indigo/50 bg-white/60',
          ].join(' ')}
        >
          {isSpeaking ? (
            /* Pause/stop icon while speaking */
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3" aria-hidden="true">
              <path d="M4 4h2v8H4V4zm6 0h2v8h-2V4z" />
            </svg>
          ) : (
            /* Speaker icon at rest */
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3" aria-hidden="true">
              <path d="M8.5 1.5a.5.5 0 0 0-.8-.4L4.5 4H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.5l3.2 2.9a.5.5 0 0 0 .8-.4V1.5zM11.3 4.7a.5.5 0 0 1 .7.7 5 5 0 0 1 0 5.2.5.5 0 1 1-.9-.5 4 4 0 0 0 0-4.2.5.5 0 0 1 .2-.7v-.5z" />
            </svg>
          )}
        </span>
      )}
    </button>
  );
};

export default MCQOptionButton;
