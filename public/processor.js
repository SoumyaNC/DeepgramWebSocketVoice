class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.inputRate = sampleRate;
    this.targetRate = 16000;
    this.ratio = this.inputRate / this.targetRate;
  }

  process(inputs) {
    const input = inputs[0][0];
    if (!input) return true;

    // Calculate simple volume (RMS) for visualization
    const rms = Math.sqrt(input.reduce((sum, s) => sum + s * s, 0) / input.length);
    this.port.postMessage({ volume: rms });

    // Resample from 48kHz to 16kHz and store in buffer
    for (let i = 0; i < input.length; i += this.ratio) {
      const idx = Math.floor(i);
      const sample = Math.max(-1, Math.min(1, input[idx]));
      this.buffer.push(sample * 32767);
    }

    // Send 320ms (5120 samples at 16kHz) of audio
    if (this.buffer.length >= 5120) {
      const int16 = new Int16Array(this.buffer.splice(0, 5120));
      this.port.postMessage({ audio: int16.buffer });
    }

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
