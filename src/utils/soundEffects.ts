// ─────────────────────────────────────────────────────────────────────────────
//  Sound effects utility for the duel game
//  Simple Web Audio API based sound effects
// ─────────────────────────────────────────────────────────────────────────────

const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

let isMuted = false;

export function setMuted(muted: boolean) {
  isMuted = muted;
}

export function isSoundMuted(): boolean {
  return isMuted;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
  if (isMuted || !audioContext) return;

  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
}

// Sound effects
export function playHoverSound() {
  // Subtle high pitch blip
  playTone(800, 0.08, 'sine', 0.1);
}

export function playCardSelectSound() {
  // Pleasant selection sound
  playTone(600, 0.15, 'sine', 0.2);
  setTimeout(() => playTone(800, 0.1, 'sine', 0.15), 50);
}

export function playCardPlaySound() {
  // Whoosh sound for playing card
  playTone(400, 0.3, 'triangle', 0.25);
  setTimeout(() => playTone(300, 0.2, 'sawtooth', 0.15), 100);
}

export function playReadySound() {
  // Success sound
  playTone(523.25, 0.2, 'sine', 0.25); // C5
  setTimeout(() => playTone(659.25, 0.2, 'sine', 0.25), 100); // E5
  setTimeout(() => playTone(783.99, 0.3, 'sine', 0.25), 200); // G5
}

export function playWinRoundSound() {
  // Victory fanfare
  playTone(523.25, 0.15, 'sine', 0.3); // C5
  setTimeout(() => playTone(659.25, 0.15, 'sine', 0.3), 100); // E5
  setTimeout(() => playTone(783.99, 0.15, 'sine', 0.3), 200); // G5
  setTimeout(() => playTone(1046.50, 0.4, 'sine', 0.35), 300); // C6
}

export function playLoseRoundSound() {
  // Sad descending sound
  playTone(440, 0.2, 'sine', 0.25); // A4
  setTimeout(() => playTone(349.23, 0.2, 'sine', 0.2), 150); // F4
  setTimeout(() => playTone(293.66, 0.3, 'sine', 0.15), 300); // D4
}

export function playGameWinSound() {
  // Epic victory
  playTone(523.25, 0.2, 'square', 0.2);
  setTimeout(() => playTone(659.25, 0.2, 'square', 0.2), 100);
  setTimeout(() => playTone(783.99, 0.2, 'square', 0.2), 200);
  setTimeout(() => playTone(1046.50, 0.4, 'square', 0.3), 300);
  setTimeout(() => playTone(1318.51, 0.6, 'square', 0.35), 500);
}

export function playGameLoseSound() {
  // Defeat sound
  playTone(220, 0.3, 'sawtooth', 0.3);
  setTimeout(() => playTone(196, 0.3, 'sawtooth', 0.25), 150);
  setTimeout(() => playTone(174.61, 0.4, 'sawtooth', 0.2), 300);
  setTimeout(() => playTone(146.83, 0.6, 'sawtooth', 0.15), 500);
}

export function playTickSound() {
  // Timer tick
  playTone(1000, 0.05, 'sine', 0.1);
}

export function playErrorSound() {
  // Error buzz
  playTone(150, 0.2, 'sawtooth', 0.2);
}

export function playFuseSound() {
  // Magical fusion sound - ascending sparkles
  playTone(523.25, 0.1, 'sine', 0.2); // C5
  setTimeout(() => playTone(659.25, 0.1, 'sine', 0.25), 80); // E5
  setTimeout(() => playTone(783.99, 0.1, 'sine', 0.3), 160); // G5
  setTimeout(() => playTone(1046.50, 0.2, 'sine', 0.35), 240); // C6
  setTimeout(() => playTone(1318.51, 0.3, 'triangle', 0.4), 400); // E6 magical finish
}

// Initialize audio context on first user interaction
export function initAudio() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
}
