import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Table for CRC-32 calculation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const body = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, body, crcBuf]);
}

function createPng(width, height, getRgbaPixel) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Scanlines with filter byte 0
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = getRgbaPixel(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Generate the RefStudio Logo Pixel Generator
function drawRefStudioIcon(x, y, width, height, isMaskable = false) {
  const cx = width / 2;
  const cy = height / 2;
  const scale = width / 512;

  // Background
  let r = 8;
  let g = 9;
  let b = 12;
  let a = 255;

  // If not maskable, we can give nice rounded corners for standalone views
  if (!isMaskable) {
    const cornerRadius = 90 * scale;
    const dx = Math.max(0, Math.abs(x - cx) - (cx - cornerRadius));
    const dy = Math.max(0, Math.abs(y - cy) - (cy - cornerRadius));
    if (Math.hypot(dx, dy) > cornerRadius) {
      return [0, 0, 0, 0]; // Transparent outside rounded squircle
    }
  }

  // Radial subtle glow around center
  const distFromCenter = Math.hypot(x - cx, y - cy);
  if (distFromCenter < 220 * scale) {
    const glow = Math.max(0, 1 - distFromCenter / (220 * scale));
    // Soft neon lime glow in background
    r = Math.min(255, Math.round(r + 15 * glow));
    g = Math.min(255, Math.round(g + 35 * glow));
    b = Math.min(255, Math.round(b + 10 * glow));
  }

  // Neon rounded badge in center
  const badgeHalf = (isMaskable ? 105 : 120) * scale;
  const bx = Math.max(0, Math.abs(x - cx) - (badgeHalf - 38 * scale));
  const by = Math.max(0, Math.abs(y - (cy + 5 * scale)) - (badgeHalf - 38 * scale));
  const isInsideBadge = Math.hypot(bx, by) <= 38 * scale;

  if (isInsideBadge) {
    const borderDist = Math.hypot(bx, by);
    const isBorder = borderDist >= 38 * scale - 10 * scale;

    if (isBorder) {
      // Vibrant Neon Yellow border #CCFF00
      return [204, 255, 0, 255];
    } else {
      // Inner badge background: Dark graphite #11141D
      r = 17;
      g = 20;
      b = 29;

      // Referee Whistle
      const sphereX = cx - 25 * scale;
      const sphereY = cy + 16 * scale;
      const distSphere = Math.hypot(x - sphereX, y - sphereY);

      const barrelLeft = cx - 25 * scale;
      const barrelRight = cx + 46 * scale;
      const barrelTop = cy - 2 * scale;
      const barrelBottom = cy + 26 * scale;
      const isInsideBarrel = (x >= barrelLeft && x <= barrelRight && y >= barrelTop && y <= barrelBottom);

      const tipLeft = cx + 46 * scale;
      const tipRight = cx + 58 * scale;
      const tipTop = cy - 8 * scale;
      const tipBottom = cy + 32 * scale;
      const isInsideTip = (x >= tipLeft && x <= tipRight && y >= tipTop && y <= tipBottom);

      const slitLeft = cx - 8 * scale;
      const slitRight = cx + 2 * scale;
      const slitTop = cy - 14 * scale;
      const slitBottom = cy + 6 * scale;
      const isInsideSlit = (x >= slitLeft && x <= slitRight && y >= slitTop && y <= slitBottom);

      const ringDist = Math.hypot(x - (sphereX - 22 * scale), y - sphereY);
      const isRing = ringDist <= 15 * scale && ringDist >= 8 * scale;

      const isSoundHole = Math.hypot(x - (sphereX + 15 * scale), y - (cy + 4 * scale)) <= 7 * scale;

      if (isSoundHole) {
        return [8, 9, 12, 255];
      }

      if (distSphere <= 32 * scale || isInsideBarrel || isInsideTip || isInsideSlit || isRing) {
        return [204, 255, 0, 255];
      }

      // Red card
      const rcX = cx + 18 * scale;
      const rcY = cy - 48 * scale;
      const rcW = 18 * scale;
      const rcH = 26 * scale;
      if (x >= rcX && x <= rcX + rcW && y >= rcY && y <= rcY + rcH) {
        return [239, 68, 68, 255];
      }

      // Yellow card
      const ycX = cx - 12 * scale;
      const ycY = cy - 54 * scale;
      const ycW = 18 * scale;
      const ycH = 26 * scale;
      if (x >= ycX && x <= ycX + ycW && y >= ycY && y <= ycY + ycH) {
        return [204, 255, 0, 255];
      }
    }
  }

  return [r, g, b, a];
}

const iconsDir = path.resolve('public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icon
const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#CCFF00" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#08090C" stop-opacity="0"/>
    </radialGradient>
    <filter id="neonShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#CCFF00" flood-opacity="0.5"/>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="512" height="512" rx="110" fill="#08090C"/>
  <circle cx="256" cy="256" r="220" fill="url(#glow)"/>
  
  <!-- Outer Neon Badge -->
  <rect x="136" y="136" width="240" height="240" rx="44" fill="#11141D" stroke="#CCFF00" stroke-width="12" filter="url(#neonShadow)"/>
  
  <!-- Referee Cards -->
  <rect x="226" y="174" width="30" height="42" rx="4" fill="#CCFF00" transform="rotate(-12 226 174)"/>
  <rect x="264" y="178" width="30" height="42" rx="4" fill="#EF4444" transform="rotate(10 264 178)"/>
  
  <!-- Whistle -->
  <g fill="#CCFF00" filter="url(#neonShadow)">
    <circle cx="216" cy="286" r="42"/>
    <rect x="216" y="260" width="85" height="34" rx="6"/>
    <rect x="295" y="252" width="16" height="50" rx="4"/>
    <rect x="240" y="242" width="14" height="24" rx="3"/>
    <path d="M 182 286 A 18 18 0 1 1 182 287" fill="none" stroke="#CCFF00" stroke-width="8"/>
    <!-- Sound hole cutout -->
    <circle cx="242" cy="272" r="9" fill="#11141D"/>
  </g>
  
  <!-- App Label -->
  <text x="256" y="440" text-anchor="middle" fill="#CCFF00" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="34" letter-spacing="4">REFSTUDIO</text>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent, 'utf-8');
console.log('✓ Created public/icons/icon.svg');

// Generate PNG icons
const sizes = [
  { name: 'icon-192x192.png', size: 192, maskable: false },
  { name: 'icon-192x192-maskable.png', size: 192, maskable: true },
  { name: 'icon-512x512.png', size: 512, maskable: false },
  { name: 'icon-512x512-maskable.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
];

for (const { name, size, maskable } of sizes) {
  const buf = createPng(size, size, (x, y, w, h) => drawRefStudioIcon(x, y, w, h, maskable));
  fs.writeFileSync(path.join(iconsDir, name), buf);
  console.log(`✓ Created public/icons/${name} (${size}x${size}, maskable: ${maskable})`);
}

// Copy apple-touch-icon and icon-192 to public root for standard fallbacks
fs.copyFileSync(path.join(iconsDir, 'apple-touch-icon.png'), path.resolve('public', 'apple-touch-icon.png'));
fs.copyFileSync(path.join(iconsDir, 'icon-192x192.png'), path.resolve('public', 'icon-192x192.png'));
fs.copyFileSync(path.join(iconsDir, 'icon-512x512.png'), path.resolve('public', 'icon-512x512.png'));
fs.copyFileSync(path.join(iconsDir, 'icon.svg'), path.resolve('public', 'favicon.svg'));

console.log('✓ All PWA icons generated successfully!');
