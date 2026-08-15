const fs = require('fs');
const path = require('path');

const soundsDir = path.join(__dirname, '..', 'public', 'sounds');
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

// Generate a subtle, clean 44.1kHz 16-bit PCM WAV chime (crystal dual-tone: 880Hz + 1320Hz + 1760Hz bell decay)
const sampleRate = 44100;
const durationSeconds = 0.45;
const totalSamples = Math.floor(sampleRate * durationSeconds);
const numChannels = 2;
const bytesPerSample = 2;
const blockAlign = numChannels * bytesPerSample;
const byteRate = sampleRate * blockAlign;
const dataSize = totalSamples * blockAlign;

const buffer = Buffer.alloc(44 + dataSize);

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);

// fmt chunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
buffer.writeUInt16LE(1, 20);  // audioFormat (1 for PCM)
buffer.writeUInt16LE(numChannels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(byteRate, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(16, 34); // bitsPerSample

// data chunk
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

let offset = 44;
for (let i = 0; i < totalSamples; i++) {
  const t = i / sampleRate;
  
  // Quick exponential decay envelope
  const env = Math.exp(-t * 8.5);
  
  // Dual high-frequency crystal bell chime harmonic (880Hz + 1318.5Hz + 1760Hz)
  const val1 = Math.sin(2 * Math.PI * 880 * t) * 0.45;
  const val2 = Math.sin(2 * Math.PI * 1318.51 * t) * 0.35;
  const val3 = Math.sin(2 * Math.PI * 1760 * t) * 0.20;
  
  const sampleFloat = (val1 + val2 + val3) * env * 0.75;
  const sampleInt = Math.max(-32768, Math.min(32767, Math.floor(sampleFloat * 32767)));
  
  // Left channel
  buffer.writeInt16LE(sampleInt, offset);
  // Right channel
  buffer.writeInt16LE(sampleInt, offset + 2);
  offset += 4;
}

// Write as wake-chime.mp3 and wake-chime.wav
fs.writeFileSync(path.join(soundsDir, 'wake-chime.mp3'), buffer);
fs.writeFileSync(path.join(soundsDir, 'wake-chime.wav'), buffer);

console.log('Successfully generated public/sounds/wake-chime.mp3');
