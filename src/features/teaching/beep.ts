// צליל סיום לטיימר – נוצר בקוד (בלי קובץ קול), עובד גם בלי אינטרנט.
export function playEndTone(): void {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const beep = (at: number, freq: number) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      osc.connect(gain).connect(ac.destination);
      osc.start(at);
      osc.stop(at + 0.4);
    };
    const t0 = ac.currentTime + 0.05;
    beep(t0, 880);
    beep(t0 + 0.45, 880);
    beep(t0 + 0.9, 1175);
    setTimeout(() => void ac.close(), 2000);
  } catch {
    // אין קול במכשיר – מסתפקים בהבהוב
  }
}
