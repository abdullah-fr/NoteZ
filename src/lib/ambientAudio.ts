/**
 * Ambient Audio Synthesis Engine for Focus Timer
 * Pure Web Audio API — works 100% offline, zero network requests, zero dependencies.
 */

export type AmbientTrack = "off" | "lofi" | "rain" | "binaural" | "whitenoise";

export interface TrackOption {
  id: AmbientTrack;
  label: string;
  icon: string;
}

export const AMBIENT_TRACKS: TrackOption[] = [
  { id: "lofi", label: "Lo-fi Beats", icon: "♫" },
  { id: "rain", label: "Gentle Rain", icon: "🌧" },
  { id: "binaural", label: "Alpha Waves (432Hz)", icon: "🧠" },
  { id: "whitenoise", label: "Brown Noise", icon: "🌊" },
  { id: "off", label: "Mute / Off", icon: "🔇" },
];

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private currentTrack: AmbientTrack = "off";
  private volume: number = 0.5;
  private masterGain: GainNode | null = null;
  private nodes: (AudioNode | number)[] = []; // store nodes or interval IDs

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentTrack(): AmbientTrack {
    return this.currentTrack;
  }

  public stop() {
    this.nodes.forEach(node => {
      if (typeof node === "number") {
        clearInterval(node);
      } else {
        try {
          if ("stop" in node && typeof (node as AudioScheduledSourceNode).stop === "function") {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // ignore cleanup disconnect errors
        }
      }
    });
    this.nodes = [];
    this.currentTrack = "off";
  }

  public playTrack(track: AmbientTrack) {
    this.stop();
    if (track === "off") return;

    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    this.currentTrack = track;

    switch (track) {
      case "rain":
        this.startRain();
        break;
      case "binaural":
        this.startBinaural();
        break;
      case "whitenoise":
        this.startBrownNoise();
        break;
      case "lofi":
        this.startLofiAmbience();
        break;
    }
  }

  /* ── Rain Sound Synthesis (High Quality Organic Rainfall & Droplets) ── */
  private startRain() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    // 1. Stereo Pink Noise Base (Soft, relaxing continuous rainfall)
    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Paul Kellet's refined 1/f filter
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        output[i] = pink * 0.11;
      }
    }

    const rainSource = ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    // Gentle acoustic filtering (mellow, soothing drizzle)
    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = "highpass";
    hpFilter.frequency.setValueAtTime(320, ctx.currentTime);

    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = "lowpass";
    lpFilter.frequency.setValueAtTime(2400, ctx.currentTime);

    // Subtle LFO modulation for organic rain swell
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.08, ctx.currentTime); // very slow 12-second wave

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.08, ctx.currentTime);

    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.45, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(rainGain.gain);

    rainSource.connect(hpFilter);
    hpFilter.connect(lpFilter);
    lpFilter.connect(rainGain);
    rainGain.connect(this.masterGain);

    rainSource.start();
    lfo.start();
    this.nodes.push(rainSource, hpFilter, lpFilter, lfo, lfoGain, rainGain);

    // 2. Soft Tactile Raindrop Impulses (gentle window droplets)
    const dropInterval = window.setInterval(() => {
      if (!this.ctx || !this.masterGain || this.currentTrack !== "rain") return;
      if (Math.random() > 0.4) return; // natural variation

      const dropOsc = ctx.createOscillator();
      const dropGain = ctx.createGain();
      const dropFilter = ctx.createBiquadFilter();

      const freq = 1100 + Math.random() * 1100;
      dropOsc.type = "sine";
      dropOsc.frequency.setValueAtTime(freq, ctx.currentTime);
      dropOsc.frequency.exponentialRampToValueAtTime(freq * 0.4, ctx.currentTime + 0.06);

      dropFilter.type = "bandpass";
      dropFilter.frequency.setValueAtTime(freq, ctx.currentTime);
      dropFilter.Q.setValueAtTime(3.5, ctx.currentTime);

      const vol = 0.02 + Math.random() * 0.04;
      dropGain.gain.setValueAtTime(vol, ctx.currentTime);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);

      dropOsc.connect(dropFilter);
      dropFilter.connect(dropGain);
      dropGain.connect(this.masterGain);

      dropOsc.start();
      dropOsc.stop(ctx.currentTime + 0.08);
    }, 140);

    this.nodes.push(dropInterval);
  }

  /* ── Binaural Alpha Wave 432Hz ── */
  private startBinaural() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    const oscL = ctx.createOscillator();
    oscL.type = "sine";
    oscL.frequency.setValueAtTime(432, ctx.currentTime);

    const merger = ctx.createChannelMerger(2);

    const oscR = ctx.createOscillator();
    oscR.type = "sine";
    oscR.frequency.setValueAtTime(442, ctx.currentTime);

    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    gainL.gain.setValueAtTime(0.18, ctx.currentTime);
    gainR.gain.setValueAtTime(0.18, ctx.currentTime);

    oscL.connect(gainL);
    oscR.connect(gainR);

    gainL.connect(merger, 0, 0);
    gainR.connect(merger, 0, 1);

    merger.connect(this.masterGain);

    oscL.start();
    oscR.start();
    this.nodes.push(oscL, oscR, gainL, gainR, merger);
  }

  /* ── Brown Noise ── */
  private startBrownNoise() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.0;
    }

    const brownNoise = ctx.createBufferSource();
    brownNoise.buffer = noiseBuffer;
    brownNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, ctx.currentTime);

    brownNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    brownNoise.start();
    this.nodes.push(brownNoise, filter, gain);
  }

  /* ── Lo-fi Ambient Chords ── */
  private startLofiAmbience() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    const chordFrequencies = [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
    ];

    let chordIdx = 0;
    const playChord = () => {
      if (!this.ctx || !this.masterGain || this.currentTrack !== "lofi") return;
      const freqs = chordFrequencies[chordIdx % chordFrequencies.length];
      chordIdx++;

      freqs.forEach(freq => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(600, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);

        osc.start();
        osc.stop(ctx.currentTime + 4.6);
      });
    };

    playChord();
    const intervalId = window.setInterval(playChord, 4500);
    this.nodes.push(intervalId);
  }
}

export const ambientEngine = new AmbientSoundEngine();
