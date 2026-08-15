// Minimal grayscale PNG encoder — no dependencies beyond Node's built-in
// zlib, since this environment can't `npm install` an image library for
// the Unreal-side tooling. Supports 8-bit and 16-bit grayscale, which is
// exactly what's needed for a biome-mask PNG and a heightmap PNG.

const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// `getPixel(x, y)` must return an integer in [0, 2^bitDepth - 1].
function encodeGrayscalePNG(width, height, bitDepth, getPixel) {
  if (bitDepth !== 8 && bitDepth !== 16) throw new Error('bitDepth must be 8 or 16');
  const bytesPerPixel = bitDepth / 8;
  const stride = width * bytesPerPixel;
  const raw = Buffer.alloc((stride + 1) * height); // +1 per row for the filter-type byte

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const v = getPixel(x, y);
      const off = rowStart + 1 + x * bytesPerPixel;
      if (bitDepth === 8) {
        raw[off] = v & 0xff;
      } else {
        raw.writeUInt16BE(v & 0xffff, off);
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { encodeGrayscalePNG, crc32 };
