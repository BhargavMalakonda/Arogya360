/**
 * useTextToSpeech.js
 *
 * React hook wrapping window.speechSynthesis (browser-native TTS, zero cost).
 *
 * Language mapping reuses LANG_MAP from useVoiceInput.js — same source of truth:
 *   'en' → 'en-IN'
 *   'hi' → 'hi-IN'
 *   'te' → 'te-IN'
 *
 * Returns:
 *   {
 *     speak(text):  () => void  — cancel any current speech, then speak text
 *     stop():       () => void  — cancel current speech immediately
 *     isSpeaking:   boolean     — true while the utterance is playing
 *     isSupported:  boolean     — false if window.speechSynthesis absent
 *   }
 *
 * Edge cases handled:
 *   - Overlapping speech: cancel() called before every new utterance, with a
 *     setTimeout(0) between cancel() and speak() to work around a Chrome bug
 *     where calling speak() synchronously after cancel() silently drops non-English
 *     utterances (the synthesis queue is in a bad state for ~1 event loop tick).
 *   - Voice async load: onvoiceschanged used for Chrome's deferred voice list;
 *     voicesReady state is included in speak()'s dependency array so the callback
 *     is recreated once voices load, ensuring pickVoice() sees the full list.
 *   - lang format: Chrome sometimes reports voice.lang with underscores ('te_IN')
 *     rather than hyphens ('te-IN'). pickVoice() normalises both sides before
 *     comparing so the exact te-IN voice is found regardless of separator.
 *   - Missing language voice: falls back to browser default rather than silently failing
 *   - Unsupported browser: isSupported=false, calling component hides the button
 *   - Unmount cleanup: cancel() called to stop any lingering utterance
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LANG_MAP } from './useVoiceInput';

const isSSAvailable = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Normalise a BCP-47 lang code so both 'te-IN' and 'te_IN' compare equal.
 * Chrome occasionally uses underscores; the spec uses hyphens.
 */
const normLang = (code) => (code ?? '').toLowerCase().replace('_', '-');

/**
 * Returns the best available SpeechSynthesisVoice for the given BCP-47 lang code.
 * Preference order:
 *   1. Exact normalised lang match  (e.g. 'te-IN' === 'te-IN', or 'te_IN' normalised)
 *   2. Language-prefix match        (e.g. any voice whose lang starts with 'te')
 *   3. null → caller omits .voice and browser uses its default
 *
 * Always called at speak-time (not at hook init) so it sees the current voice list.
 *
 * @param {string} langCode — BCP-47 code such as 'te-IN'
 * @returns {SpeechSynthesisVoice|null}
 */
function pickVoice(langCode) {
  if (!isSSAvailable()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const target = normLang(langCode);

  // 1. Exact match after normalisation (handles 'te-IN' vs 'te_IN')
  const exact = voices.find((v) => normLang(v.lang) === target);
  if (exact) return exact;

  // 2. Language-prefix match (e.g. 'te' matches 'te-IN', 'te_IN', 'te-TZ', etc.)
  const prefix = target.split('-')[0];
  const partial = voices.find((v) => normLang(v.lang).startsWith(prefix));
  if (partial) return partial;

  // 3. No match — return null so browser default is used
  return null;
}

/**
 * @param {string} languagePref — value from userProfile.language_pref ('en'|'hi'|'te')
 */
export function useTextToSpeech(languagePref = 'en') {
  const [isSupported] = useState(() => isSSAvailable());
  const [isSpeaking, setIsSpeaking] = useState(false);
  // voicesReady is included in speak()'s dependency array (see below).
  // This forces speak() to be recreated once Chrome's async voice list resolves,
  // so pickVoice() inside the callback sees the populated list instead of [].
  const [voicesReady, setVoicesReady] = useState(() => {
    if (!isSSAvailable()) return false;
    return window.speechSynthesis.getVoices().length > 0;
  });
  const utteranceRef = useRef(null);
  // Tracks pending speak setTimeout so we can clear it on stop() or unmount
  const speakTimerRef = useRef(null);

  const langCode = LANG_MAP[languagePref] ?? 'en-IN';

  // Chrome loads voices asynchronously — listen for onvoiceschanged so we know
  // when the list is populated and voicesReady flips, triggering speak() recreation.
  useEffect(() => {
    if (!isSSAvailable()) return;

    const handleVoicesChanged = () => {
      if (window.speechSynthesis.getVoices().length > 0) {
        setVoicesReady(true);
      }
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    // Trigger immediately in case voices are already loaded (Firefox / Safari)
    if (window.speechSynthesis.getVoices().length > 0) {
      setVoicesReady(true);
    }

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
    };
  }, []);

  // Cancel any lingering utterance when the component using this hook unmounts
  useEffect(() => {
    return () => {
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      if (isSSAvailable()) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    if (!isSSAvailable()) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text) => {
      if (!isSSAvailable() || !text) return;

      // Clear any pending deferred speak
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);

      // Cancel current speech first
      window.speechSynthesis.cancel();
      setIsSpeaking(false);

      // ── Chrome cancel() / speak() timing bug ─────────────────────────────
      // On Chrome, calling speak() synchronously after cancel() silently drops
      // the utterance for non-English voices (the synthesis queue needs one event
      // loop tick to settle). Hindi may be less affected because its voice is
      // loaded more eagerly; Telugu's voice takes longer to initialise after
      // cancel() and gets silently discarded without this defer.
      speakTimerRef.current = setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;

        // pickVoice() called here at speak-time — always sees current voice list.
        const voice = pickVoice(langCode);
        if (voice) {
          utterance.voice = voice;
        }

        // Diagnostic log — visible in browser DevTools console
        console.debug(
          '[TTS] speak called' +
          ` | language=${languagePref}` +
          ` | mapped_lang=${langCode}` +
          ` | voice_name=${voice?.name ?? '<browser default>'}` +
          ` | voice_lang=${voice?.lang ?? 'n/a'}` +
          ` | utterance_lang=${utterance.lang}` +
          ` | text="${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
        );

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
          console.warn('[TTS] utterance error:', e.error);
          setIsSpeaking(false);
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }, 0);
    },
    // voicesReady is intentionally in the dep array: when Chrome's async voice
    // list resolves and voicesReady flips true, speak() is recreated so the
    // next call to pickVoice() finds the populated list.
    [langCode, languagePref, voicesReady], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { speak, stop, isSpeaking, isSupported };
}
