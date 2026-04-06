const fs = require("fs");
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
  const r = Math.round(size * 0.2);
  const fontSize = Math.round(size * 0.35);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#7C3AED"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-weight="bold" font-size="${fontSize}">PKL</text></svg>`;
  fs.writeFileSync(`client/public/icons/icon-${size}x${size}.svg`, svg);
  console.log(`Created icon-${size}x${size}.svg`);
});
