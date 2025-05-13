class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.outputSampleRate = 16000;
    this.inputSampleRate = sampleRate; // from AudioContext
    this.ratio = this.inputSampleRate / this.outputSampleRate;
  }

  process(inputs) {
    const input = inputs[0][0];
    if (!input) return true;

    // Downsample
    for (let i = 0; i < input.length; i += this.ratio) {
      const index = Math.floor(i);
      const sample = Math.max(-1, Math.min(1, input[index]));
      const int16 = sample * 32767;
      this.buffer.push(int16);
    }

    // Send 320ms of audio (~5120 samples at 16kHz) as chunk
    if (this.buffer.length >= 5120) {
      const chunk = new Int16Array(this.buffer.splice(0, 5120));
      this.port.postMessage(chunk.buffer);
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
