const fs = require('fs');
const path = require('path');
const { createCanvas } = (() => {
  try {
    return require('canvas');
  } catch (e) {
    return { createCanvas: null };
  }
})();

// Create a raw PNG if canvas is not available using pure JS PNG generator or Buffer
function createSimplePng(width, height) {
  // Generate a 256x256 RGBA buffer with a glowing cybernetic Ahri orb design
  const zlib = require('zlib');
  const buffer = Buffer.alloc(width * height * 4);

  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.42;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < r) {
        // Glowing cyan-purple gradient orb
        const factor = 1 - dist / r;
        const glow = Math.sin(factor * Math.PI * 0.5);
        buffer[idx] = Math.min(255, Math.floor(14 + 120 * glow + 100 * Math.sin(dx * 0.05)));     // R (purple-indigo)
        buffer[idx + 1] = Math.min(255, Math.floor(165 + 90 * glow));                             // G (cyan-teal)
        buffer[idx + 2] = Math.min(255, Math.floor(233 + 22 * glow));                             // B (bright cyan)
        buffer[idx + 3] = Math.floor(255 * Math.min(1, factor * 2));                             // Alpha
      } else {
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  // Encode as uncompressed / deflate PNG
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // Filter type None
    buffer.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 72, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit depth
  ihdr[9] = 6; // Color type 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

const table = (() => {
  let c;
  const t = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    t[n] = c;
  }
  return t;
})();

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcVal = crc32(typeAndData);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

const png256 = createSimplePng(256, 256);
const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon-256.png'), png256);
fs.writeFileSync(path.join(publicDir, 'icon.png'), png256);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), png256);

console.log('Successfully generated public/icon-256.png, public/icon.png, and public/favicon.ico');
