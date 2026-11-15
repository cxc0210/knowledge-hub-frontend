const INITIAL_BUFFER_SECONDS = 0.12;

export class StreamingPcmPlayer {
  private context: AudioContext | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private sampleRate = 24_000;
  private nextStartTime = 0;
  private pendingByte: number | null = null;

  constructor(private readonly onIdle: () => void) {}

  async unlock() {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: "interactive" });
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  configure(sampleRate: number) {
    if (sampleRate <= 0 || sampleRate === this.sampleRate) {
      return;
    }

    this.stop();
    this.sampleRate = sampleRate;
  }

  enqueuePcm(data: ArrayBuffer) {
    const context = this.context;
    if (!context) {
      return;
    }

    const bytes = this.withPendingByte(new Uint8Array(data));
    const completeLength = bytes.byteLength - (bytes.byteLength % 2);
    if (completeLength === 0) {
      return;
    }

    if (completeLength < bytes.byteLength) {
      this.pendingByte = bytes[bytes.byteLength - 1];
    }

    const sampleCount = completeLength / 2;
    const samples = new Float32Array(sampleCount);
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      completeLength,
    );

    for (let index = 0; index < sampleCount; index += 1) {
      samples[index] = view.getInt16(index * 2, true) / 32_768;
    }

    const audioBuffer = context.createBuffer(1, sampleCount, this.sampleRate);
    audioBuffer.copyToChannel(samples, 0);

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.onended = () => {
      source.disconnect();
      this.sources.delete(source);
      if (this.sources.size === 0) {
        this.nextStartTime = 0;
        this.onIdle();
      }
    };

    const startTime = Math.max(
      this.nextStartTime,
      context.currentTime + INITIAL_BUFFER_SECONDS,
    );
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;
    this.sources.add(source);
  }

  get isIdle() {
    return this.sources.size === 0;
  }

  stop() {
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already have ended between checking and stopping it.
      }
      source.disconnect();
    }

    this.sources.clear();
    this.nextStartTime = 0;
    this.pendingByte = null;
  }

  async close() {
    this.stop();
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      await context.close();
    }
  }

  private withPendingByte(bytes: Uint8Array) {
    if (this.pendingByte === null) {
      return bytes;
    }

    const combined = new Uint8Array(bytes.byteLength + 1);
    combined[0] = this.pendingByte;
    combined.set(bytes, 1);
    this.pendingByte = null;
    return combined;
  }
}
