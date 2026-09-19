import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTextToSpeech } from '../hooks/useTextToSpeech';

const ClinicalHintBox = ({ clinicalHint, educatorMode = false, className = '' }) => {
  const { userProfile } = useAuth();
  const { speak, stop, isSpeaking, isSupported } = useTextToSpeech(
    userProfile?.language_pref ?? 'en',
  );

  // Conditional render logic — UNCHANGED
  if (!educatorMode || !clinicalHint) {
    return null;
  }

  const handleSpeakerClick = (e) => {
    e.stopPropagation();
    if (isSpeaking) {
      stop();
    } else {
      speak(clinicalHint);
    }
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 rounded-[14px] ${className}`}
      style={{
        background: 'rgba(88,86,214,0.06)',
        border: '1px solid rgba(88,86,214,0.14)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Lightbulb / clinical icon */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-brand-indigo mt-0.5"
        style={{ background: 'rgba(88,86,214,0.10)', border: '1px solid rgba(88,86,214,0.18)' }}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M10 2a6 6 0 00-3.819 10.602c.414.388.819.81.819 1.324V15a1 1 0 001 1h4a1 1 0 001-1v-1.074c0-.514.405-.936.819-1.324A6 6 0 0010 2zM8 16.5v.5a2 2 0 104 0v-.5H8z" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-brand-indigo/70 mb-0.5 font-display">
          Clinical hint
        </p>
        <span className="text-[13px] text-on-surface font-body leading-relaxed">
          {clinicalHint}
        </span>
      </div>

      {/* TTS speaker button — handleSpeakerClick with e.stopPropagation() UNCHANGED */}
      {isSupported && (
        <button
          type="button"
          onClick={handleSpeakerClick}
          aria-label={isSpeaking ? 'Stop reading clinical hint' : 'Read clinical hint aloud'}
          title={isSpeaking ? 'Stop' : 'Read aloud'}
          className={[
            'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
            'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-indigo/40',
            isSpeaking
              ? 'bg-brand-indigo text-white animate-pulse shadow-[0_2px_8px_rgba(88,86,214,0.40)]'
              : 'bg-white/70 border border-brand-indigo/20 text-brand-indigo/60 hover:border-brand-indigo/50 hover:text-brand-indigo',
          ].join(' ')}
        >
          {isSpeaking ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
              <path d="M4 4h2v8H4V4zm6 0h2v8h-2V4z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
              <path d="M8.5 1.5a.5.5 0 0 0-.8-.4L4.5 4H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.5l3.2 2.9a.5.5 0 0 0 .8-.4V1.5zM11.3 4.7a.5.5 0 0 1 .7.7 5 5 0 0 1 0 5.2.5.5 0 1 1-.9-.5 4 4 0 0 0 0-4.2.5.5 0 0 1 .2-.7v-.5z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
};

export default ClinicalHintBox;
