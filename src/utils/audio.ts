// Web Audio API Synthesizer and Web Speech API Voice Prompt Utilities

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a synthesized beep sound
 */
export function playBeep(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Fade out to avoid clicks
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('Audio Context is not allowed or failed to start:', e);
  }
}

/**
 * Play a soft, pleasant double-beep for standard scan (normal item, not expired)
 */
export function playNormalScanSound(volume: number = 0.3) {
  playBeep(600, 0.08, 'sine', volume);
  setTimeout(() => {
    playBeep(800, 0.08, 'sine', volume);
  }, 100);
}

/**
 * Play an urgent siren-like beep sequence for matched expired item
 */
export function playExpiredAlertSound(volume: number = 0.6) {
  // urgent sound pattern: alternate high-low
  playBeep(880, 0.15, 'sawtooth', volume);
  setTimeout(() => {
    playBeep(440, 0.15, 'sawtooth', volume);
  }, 160);
  setTimeout(() => {
    playBeep(880, 0.15, 'sawtooth', volume);
  }, 320);
}

/**
 * Speak text out loud using the SpeechSynthesis API
 */
export function speakText(text: string, rate: number = 1.0, volume: number = 1.0) {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  try {
    // Cancel any ongoing speaking to avoid delay
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.volume = volume;

    // Try to find a Chinese voice for Chinese text
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('ZH'));
    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('Failed to speak text:', e);
  }
}

// Pre-load voices (some browsers require this callback)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}
