/**
 * Voice controls (W3, W-L8). Both features ride the native Web Speech
 * APIs — zero dependencies, ~2 KB:
 *
 *  - Speech-to-text (mic button): `SpeechRecognition` / the webkit prefix.
 *    Chrome/Edge only today; the button hides itself entirely where the
 *    API is missing (Firefox, most embedded webviews) so unsupported
 *    browsers never see a dead control. Permission/network failures show
 *    a transient "blocked" state instead of an error bubble.
 *
 *  - Read-aloud (speaker toggle): `speechSynthesis`, near-universal.
 *    Markdown is flattened for speech — code fences become "I've shared
 *    a code block", link labels are kept, formatting symbols dropped.
 */

interface SRResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SRErrorEvent {
  error?: string;
}

interface SRInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((ev: SRResultEvent) => void) | null;
  onerror: ((ev: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SRCtor = new () => SRInstance;

export interface SpeechInput {
  /** Disable the mic while a turn is in flight (mirrors the composer). */
  setDisabled(disabled: boolean): void;
}

export function createSpeechInput(opts: {
  button: HTMLButtonElement;
  input: HTMLTextAreaElement;
  /** Fired after every transcript update so the caller can auto-grow + refresh send state. */
  onChanged: () => void;
}): SpeechInput {
  const { button, input, onChanged } = opts;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;

  if (!Ctor) {
    button.style.display = 'none';
    return { setDisabled: () => {} };
  }

  let recog: SRInstance | null = null;
  let listening = false;

  const stop = (): void => {
    listening = false;
    button.classList.remove('is-listening');
    button.setAttribute('aria-label', 'Speak');
    try {
      recog?.stop();
    } catch {
      /* already stopped */
    }
    input.focus();
  };

  const fail = (reason: string | undefined): void => {
    stop();
    button.classList.add('is-blocked');
    button.title = reason === 'not-allowed'
      ? 'Microphone blocked — allow mic access for this site'
      : "Voice input isn't available right now";
    setTimeout(() => {
      button.classList.remove('is-blocked');
      button.title = 'Speak (voice input)';
    }, 2200);
  };

  const start = (): void => {
    try {
      recog = new Ctor();
      recog.lang = document.documentElement.lang || 'en-US';
      recog.interimResults = true;
      recog.continuous = false;
      // Dictation appends to whatever is already typed.
      const base = input.value.trim() === '' ? '' : `${input.value.replace(/\s+$/, '')} `;
      recog.onstart = () => {
        listening = true;
        button.classList.add('is-listening');
        button.setAttribute('aria-label', 'Stop listening');
      };
      recog.onresult = (ev) => {
        let transcript = '';
        for (let i = 0; i < ev.results.length; i++) {
          transcript += ev.results[i][0].transcript;
        }
        input.value = base + transcript;
        onChanged();
      };
      recog.onerror = (ev) => fail(ev.error);
      recog.onend = () => stop();
      recog.start();
    } catch {
      fail('unavailable');
    }
  };

  button.addEventListener('click', () => (listening ? stop() : start()));

  return {
    setDisabled(disabled: boolean): void {
      button.disabled = disabled;
      if (disabled && listening) stop();
    },
  };
}

export interface ReadAloud {
  /** Speak a finalized assistant reply. No-op while the toggle is off. */
  speak(markdown: string): void;
}

export function createReadAloud(button: HTMLButtonElement): ReadAloud {
  const synth = window.speechSynthesis ?? null;

  if (!synth) {
    button.style.display = 'none';
    return { speak: () => {} };
  }

  let on = false;

  button.addEventListener('click', () => {
    on = !on;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.title = `Read answers aloud: ${on ? 'on' : 'off'}`;
    if (!on) {
      try {
        synth.cancel();
      } catch {
        /* nothing in flight */
      }
    }
  });

  return {
    speak(markdown: string): void {
      if (!on) return;
      try {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(plainForSpeech(markdown));
        utterance.rate = 1.03;
        synth.speak(utterance);
      } catch {
        /* synthesis unavailable mid-session — stay silent */
      }
    },
  };
}

/** Flatten markdown into something that reads naturally out loud. */
function plainForSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ". I've shared a code block. ")
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#>~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
