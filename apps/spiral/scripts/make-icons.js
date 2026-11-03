// Renders the app icon and splash from the same golden-angle rule the game uses.
// Run: node scripts/make-icons.js  (needs Playwright + Chromium, used only at design time)
const { chromium } = require('playwright');
const path = require('path');

const G = 137.50776405;
const palette = ['#FFD166', '#FF7AB6', '#5CE1E6', '#FFD166'];

function bloom(size, count, { bg, arm }) {
  const c = size / 2, R = size * 0.36;
  let dots = '';
  for (let n = 1; n <= count; n++) {
    const a = (n * G * Math.PI) / 180, r = R * Math.sqrt(n / count);
    const d = size * (0.012 + 0.012 * Math.sqrt(n / count));
    dots += `<circle cx="${c + r * Math.sin(a)}" cy="${c - r * Math.cos(a)}" r="${d}" fill="${palette[n % 4 === 0 ? 3 : n % 3]}"/>`;
  }
  const t = (G * Math.PI) / 180;
  const armLine = arm
    ? `<line x1="${c}" y1="${c}" x2="${c + R * 1.12 * Math.sin(t)}" y2="${c - R * 1.12 * Math.cos(t)}" stroke="#F4EFE6" stroke-width="${size * 0.008}"/><circle cx="${c}" cy="${c}" r="${size * 0.012}" fill="#F4EFE6"/>`
    : '';
  let sky = '';
  if (bg) {
    let a = 2026;
    const r = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 40; i++) sky += `<circle cx="${r() * size}" cy="${r() * size}" r="${size * (0.002 + r() * 0.003)}" fill="#F4EFE6" opacity="${0.15 + r() * 0.35}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}${sky}${dots}${armLine}</svg>`;
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  const out = (f) => path.join(__dirname, '..', 'assets', f);
  const shots = [
    ['icon.png', 1024, bloom(1024, 89, { bg: '#0D1130', arm: true }), false],
    ['splash-icon.png', 1024, bloom(1024, 89, { arm: true }), true],
    ['android-icon-foreground.png', 512, bloom(512, 55, { arm: true }), true],
    ['android-icon-monochrome.png', 512, bloom(512, 55, { arm: true }).replace(/fill="#[0-9A-F]{6}"/g, 'fill="#000000"'), true],
    ['android-icon-background.png', 512, `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="#0D1130"/></svg>`, false],
    ['favicon.png', 48, bloom(48, 34, { bg: '#0D1130' }), false],
  ];
  for (const [file, size, svg, transparent] of shots) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.screenshot({ path: out(file), omitBackground: transparent });
  }
  await b.close();
})();
