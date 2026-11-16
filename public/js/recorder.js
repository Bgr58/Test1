// Canvas + ses akışını MediaRecorder ile videoya kaydeder (mümkünse MP4, değilse WebM).
const CANDIDATES = [
  'video/mp4;codecs="avc1.640028,mp4a.40.2"',
  'video/mp4;codecs="avc1.4D401F,mp4a.40.2"',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4',
  'video/webm;codecs="vp9,opus"',
  'video/webm;codecs="vp8,opus"',
  'video/webm',
];

export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

export class Recorder {
  constructor(canvas, audioStream, fps = 60) {
    const tracks = [...canvas.captureStream(fps).getVideoTracks()];
    if (audioStream) tracks.push(...audioStream.getAudioTracks());
    this.stream = new MediaStream(tracks);
    this.mime = pickMime();
    const opts = { videoBitsPerSecond: 12_000_000, audioBitsPerSecond: 192_000 };
    if (this.mime) opts.mimeType = this.mime;
    this.rec = new MediaRecorder(this.stream, opts);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
  }

  get ext() {
    return (this.rec.mimeType || this.mime || '').includes('mp4') ? 'mp4' : 'webm';
  }

  start() {
    this.rec.start(250);
  }

  stop() {
    return new Promise((resolve) => {
      this.rec.onstop = () => {
        const type = (this.rec.mimeType || this.mime || 'video/webm').split(';')[0];
        resolve(new Blob(this.chunks, { type }));
        this.stream.getVideoTracks().forEach((t) => t.stop());
      };
      this.rec.stop();
    });
  }
}
