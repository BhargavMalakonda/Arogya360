/**
 * useVoiceInput.js
 *
 * React hook wrapping the Web Speech API (SpeechRecognition).
 * Only used for the initial free-text symptom input on /triage.
 * Never used during the MCQ phase.
 *
 * Language mapping from userProfile.language_pref:
 *   'en' → 'en-IN'   (Indian English)
 *   'hi' → 'hi-IN'   (Hindi)
 *   'te' → 'te-IN'   (Telugu)
 *
 * Returns:
 *   {
 *     isSupported:    boolean  — false if API absent, mic denied, or network error
 *     isListening:    boolean  — true while recognition is actively running
 *     transcript:     string   — accumulated result text
 *     startListening: () => void
 *     stopListening:  () => void
 *   }
 *
 * On any of these conditions: isSupported becomes false and the calling component
 * must display "Voice unavailable — type your question instead." and hide the mic
 * button entirely.
 *   - SpeechRecognition not present in window
 *   - Microphone permission denied (error.error === 'not-allowed')
 *   - Network error (error.error === 'network')
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Language preference → BCP-47 locale used by SpeechRecognition and SpeechSynthesis.
// Exported so useTextToSpeech.js can reuse the same mapping without duplication.
export const LANG_MAP = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
};

const getRecognitionClass = () =>
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

/**
 * @param {string} languagePref — value from userProfile.language_pref ('en'|'hi'|'te')
 */
export function useVoiceInput(languagePref = 'en') {
  const [isSupported, setIsSupported] = useState(() => !!getRecognitionClass());
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const recognitionRef = useRef(null);
  // Tracks whether the stop was user-initiated (vs. browser ending naturally)
  const manualStopRef = useRef(false);

  const lang = LANG_MAP[languagePref] ?? 'en-IN';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        manualStopRef.current = true;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(() => {
    const RecognitionClass = getRecognitionClass();
    if (!RecognitionClass) {
      setIsSupported(false);
      return;
    }

    // Abort any existing session
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new RecognitionClass();
    recognition.lang = lang;
    recognition.interimResults = true;   // show partial results as the user speaks
    recognition.maxAlternatives = 1;
    recognition.continuous = false;      // auto-stop after a natural pause

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      // Concatenate all result segments (handles both interim and final)
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      setTranscript(fullTranscript);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      // Errors that mean voice is permanently unavailable for this session
      if (event.error === 'not-allowed' || event.error === 'network') {
        setIsSupported(false);
      }
      // 'aborted' fires when we call .abort() ourselves — not a real error
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      manualStopRef.current = false;
    };

    recognitionRef.current = recognition;
    manualStopRef.current = false;

    try {
      recognition.start();
    } catch {
      // start() throws if called on an already-running instance
      setIsListening(false);
    }
  }, [lang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      manualStopRef.current = true;
      recognitionRef.current.stop(); // graceful stop — fires onresult with final results
    }
    setIsListening(false);
  }, []);

  return { isSupported, isListening, transcript, startListening, stopListening };
}
