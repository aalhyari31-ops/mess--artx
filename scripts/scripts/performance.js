const fs = require('fs');
const path = require('path');
const { compile } = require('tailwindcss');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TEMPLATES = path.join(ROOT, 'src', 'templates');
const JS_DIR = path.join(ROOT, 'src', 'assets', 'js');
const SCRIPT_DIR = path.join(ROOT, 'scripts');

const GOOGLE_FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400&family=Montserrat:wght@200;300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Cairo:wght@400;600;700&family=Tajawal:wght@300;400;700&display=swap';

const FONT_AWESOME =
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';

const HERO =
  'https://images.unsplash.com/photo-1545558014-8692077e9b5c?q=80&w=2070&auto=format&fit=crop';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.lstatSync(full);

    if (stat.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }

  return out;
}

/* =========================================================
   TAILWIND STATIC BUILD
   ========================================================= */

function candidates() {
  const set = new Set();

  const files = [
    ...walk(TEMPLATES),
    ...walk(JS_DIR),
    ...walk(SCRIPT_DIR)
  ].filter(file => /\.(html|js|css)$/i.test(file));

  const classRegex =
    /(?:class|className)\s*=\s*["'`]([^"'`]+)["'`]/g;

  for (const file of files) {
    const text = read(file);
    let match;

    while ((match = classRegex.exec(text))) {
      match[1]
        .split(/\s+/)
        .filter(Boolean)
        .forEach(token => set.add(token));
    }
  }

  [
    'bg-black/90',
    'bg-black/95',
    'bg-black/50',
    'bg-white/5',
    'bg-white/10',
    'bg-white/[0.02]',
    'backdrop-blur-md',
    'backdrop-blur-xl',
    'border-white/5',
    'border-white/10',
    'border-primary/30',
    'text-white/80',
    'text-white/70',
    'text-white/60',
    'text-white/50',
    'text-white/40',
    'hover:bg-primary',
    'hover:text-black',
    'hover:text-primary',
    'hover:border-primary',
    'group-hover:scale-110',
    'focus:border-primary',
    'rtl:left-0',
    'rtl:right-auto',
    'font-heading',
    'font-arabic',
    'font-sans'
  ].forEach(token => set.add(token));

  return [...set];
}

async function buildTailwind() {
  const input = `
@tailwind utilities;

@theme {
  --color-background:#0a0a0a;
  --color-foreground:#f5f5f5;
  --color-primary:#c8a45d;
  --color-secondary:#1f1f1f;
  --font-sans:Montserrat,sans-serif;
  --font-heading:"Playfair Display",serif;
  --font-arabic:Cairo,sans-serif;
}
`;

  const compiler = await compile(input);

  const utilityCss = compiler.build(candidates());

  const preflight = read(
    require.resolve('tailwindcss/preflight.css')
  );

  const theme = read(
    require.resolve('tailwindcss/theme.css')
  );

  const output = path.join(
    DIST,
    'assets',
    'css',
    'tailwind.css'
  );

  fs.mkdirSync(
    path.dirname(output),
    { recursive: true }
  );

  write(
    output,
    `${preflight}

${theme}

${utilityCss}
`
  );
}

/* =========================================================
   SERVICE CARDS → REAL LINKS
   ========================================================= */

function replaceServiceCard(html, slug) {
  const markerRegex = new RegExp(
    `window\\.location\\.href=["']([^"']*\\/${slug}\\/)[\"']`,
    'i'
  );

  const markerMatch = html.match(markerRegex);

  if (!markerMatch) return html;

  const target = markerMatch[1];
  const markerIndex = markerMatch.index;

  const start = html.lastIndexOf(
    '<div',
    markerIndex
  );

  if (start < 0) return html;

  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start;

  let depth = 0;
  let end = -1;
  let match;

  while ((match = tags.exec(html))) {
    if (/^<div\b/i.test(match[0])) {
      depth += 1;
    } else {
      depth -= 1;
    }

    if (depth === 0) {
      end = match.index + match[0].length;
      break;
    }
  }

  if (end < 0) return html;

  let block = html.slice(start, end);

  block = block.replace(
    /^<div/i,
    `<a href="${target}"`
  );

  block = block.replace(
    /<\/div>$/i,
    '</a>'
  );

  return (
    html.slice(0, start) +
    block +
    html.slice(end)
  );
}

/* =========================================================
   HTML OPTIMIZATION
   ========================================================= */

function optimizeHtml(html, relativePath) {

  /* Remove Tailwind CDN */
  html = html.replace(
    /\s*<script[^>]*src=["']https:\/\/cdn\.tailwindcss\.com["'][^>]*><\/script>\s*/gi,
    '\n'
  );

  html = html.replace(
    /\s*<script>\s*tailwind\.config[\s\S]*?<\/script>\s*/gi,
    '\n'
  );

  /* Remove old Google Fonts */
  html = html.replace(
    /\s*<link[^>]*href=["']https:\/\/fonts\.googleapis\.com\/css2\?[^"']+["'][^>]*>\s*/gi,
    '\n'
  );

  html = html.replace(
    /\s*<noscript>\s*<link[^>]*href=["']https:\/\/fonts\.googleapis\.com\/css2\?[^"']+["'][^>]*>\s*<\/noscript>\s*/gi,
    '\n'
  );

  /* Remove old Font Awesome */
  html = html.replace(
    /\s*<link[^>]*href=["']https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/6\.5\.2\/css\/all\.min\.css["'][^>]*>\s*/gi,
    '\n'
  );

  html = html.replace(
    /\s*<noscript>\s*<link[^>]*href=["']https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/6\.5\.2\/css\/all\.min\.css["'][^>]*>\s*<\/noscript>\s*/gi,
    '\n'
  );

  /* Static Tailwind + async fonts/icons */
  html = html.replace(
    /<head[^>]*>/i,
    `$&
<link rel="stylesheet" href="/assets/css/tailwind.css">

<link
  rel="stylesheet"
  href="${GOOGLE_FONTS}"
  media="print"
  onload="this.media='all'"
>

<noscript>
  <link
    rel="stylesheet"
    href="${GOOGLE_FONTS}"
  >
</noscript>

<link
  rel="stylesheet"
  href="${FONT_AWESOME}"
  media="print"
  onload="this.media='all'"
>

<noscript>
  <link
    rel="stylesheet"
    href="${FONT_AWESOME}"
  >
</noscript>`
  );

  /* Three.js */
  html = html.replace(
    /<script([^>]*?)src=["']https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js["']([^>]*)><\/script>/gi,
    '<script$1src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"$2 defer fetchpriority="low"></script>'
  );

  /* OrbitControls */
  html = html.replace(
    /<script([^>]*?)src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/examples\/js\/controls\/OrbitControls\.js["']([^>]*)><\/script>/gi,
    '<script$1src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"$2 defer fetchpriority="low"></script>'
  );

  /* GSAP */
  html = html.replace(
    /<script([^>]*?)src=["']https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/gsap\/3\.12\.5\/gsap\.min\.js["']([^>]*)><\/script>/gi,
    '<script$1src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"$2 defer fetchpriority="low"></script>'
  );

  /* ScrollTrigger */
  html = html.replace(
    /<script([^>]*?)src=["']https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/gsap\/3\.12\.5\/ScrollTrigger\.min\.js["']([^>]*)><\/script>/gi,
    '<script$1src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"$2 defer fetchpriority="low"></script>'
  );

  /* Main JavaScript */
  html = html.replace(
    /<script([^>]*?)src=["']([^"']*\/assets\/js\/main\.js[^"']*)["']([^>]*)><\/script>/gi,
    '<script$1src="$2"$3 defer></script>'
  );

  /* Hero preload */
  if (
    html.includes('hero-bg-image') &&
    !html.includes('fetchpriority="high"')
  ) {
    html = html.replace(
      /<head[^>]*>/i,
      `$&
<link
  rel="preload"
  as="image"
  href="${HERO}"
  fetchpriority="high"
>`
    );
  }

  /* =======================================================
     FAST FIRST PAINT
     ======================================================= */

  const performanceCSS = `
<style id="archex-performance-css">

@keyframes archexIntroSubtitle {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes archexIntroTitle {
  from {
    opacity: 0;
    transform: scale(1.1) translateY(30px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes archexIntroTagline {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes archexIntroButton {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.brand-subtitle {
  animation:
    archexIntroSubtitle
    .9s
    cubic-bezier(.16,1,.3,1)
    .05s
    both;
}

.brand-title {
  animation:
    archexIntroTitle
    1.1s
    cubic-bezier(.16,1,.3,1)
    .12s
    both;
}

.brand-tagline {
  animation:
    archexIntroTagline
    .9s
    cubic-bezier(.16,1,.3,1)
    .3s
    both;
}

.magnetic-btn {
  animation:
    archexIntroButton
    .9s
    ease
    .48s
    both;
}

@media (prefers-reduced-motion: reduce) {
  .brand-subtitle,
  .brand-title,
  .brand-tagline,
  .magnetic-btn {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}

</style>
`;

  if (!html.includes('id="archex-performance-css"')) {
    html = html.replace(
      /<head[^>]*>/i,
      `$&
${performanceCSS}`
    );
  }

  /* =======================================================
     IMPORTANT IMAGE FIX
     
     Do NOT use lazy loading for the cinematic portfolio
     images because some of them are inside animated/hidden
     portfolio sections.
     ======================================================= */

  html = html.replace(
    /(<img\b[^>]*class=["'][^"']*(?:arch-img-main|arch-img-overlay|arch-img-full)[^"']*["'][^>]*?)\s+loading=["']lazy["']/gi,
    '$1'
  );

  html = html.replace(
    /(<img\b[^>]*loading=["']lazy["'][^>]*class=["'][^"']*(?:arch-img-main|arch-img-overlay|arch-img-full)[^"']*["'][^>]*?)\s+loading=["']lazy["']/gi,
    '$1'
  );

  /*
   * If portfolio images have loading="lazy" before class,
   * remove it safely.
   */
  html = html.replace(
    /(<img\b[^>]*class=["'][^"']*(?:arch-img-main|arch-img-overlay|arch-img-full)[^"']*["'][^>]*?)\s+loading=["']lazy["']/gi,
    '$1'
  );

  /* =======================================================
     SERVICE LINKS
     ======================================================= */

  html = replaceServiceCard(
    html,
    'architecture'
  );

  html = replaceServiceCard(
    html,
    'rendering'
  );

  html = replaceServiceCard(
    html,
    'web-development'
  );

  /* =======================================================
     ACCESSIBILITY
     ======================================================= */

  html = html.replace(
    /<button([^>]*id=["']mobile-menu-btn["'][^>]*)>/gi,
    (full, attrs) => {
      if (/aria-label=/i.test(attrs)) {
        return full;
      }

      return `<button${attrs} aria-label="Open mobile menu" aria-controls="mobile-menu" aria-expanded="false">`;
    }
  );

  html = html.replace(
    /<a([^>]*class=["'][^"']*floating-whatsapp[^"']*["'][^>]*)>/gi,
    (full, attrs) => {
      if (/aria-label=/i.test(attrs)) {
        return full;
      }

      return `<a${attrs} aria-label="Contact us on WhatsApp">`;
    }
  );

  return html;
}

/* =========================================================
   PROCESS GENERATED HTML
   ========================================================= */

function processPages() {
  const pages = walk(DIST).filter(
    file => file.endsWith('index.html')
  );

  for (const file of pages) {
    const html = optimizeHtml(
      read(file),
      path.relative(DIST, file)
    );

    write(file, html);
  }
}

/* =========================================================
   REMOVE EMPTY TEMPLATE ROUTES
   ========================================================= */

function removeTemplateRoutes() {
  const templateNames = [
    'base',
    'location-page',
    'service-page'
  ];

  for (const name of templateNames) {

    const dir = path.join(
      DIST,
      name
    );

    if (fs.existsSync(dir)) {
      fs.rmSync(
        dir,
        {
          recursive: true,
          force: true
        }
      );
    }

    for (const lang of [
      'ar',
      'tr',
      'es'
    ]) {

      const localized = path.join(
        DIST,
        lang,
        name
      );

      if (fs.existsSync(localized)) {
        fs.rmSync(
          localized,
          {
            recursive: true,
            force: true
          }
        );
      }
    }
  }
}

/* =========================================================
   MAIN
   ========================================================= */

async function main() {

  await buildTailwind();

  removeTemplateRoutes();

  processPages();

  require(
    './generate-sitemap.js'
  );

  console.log(
    '✅ Performance/SEO post-build optimization complete'
  );
}

main().catch(error => {

  console.error(
    '❌ Performance optimization failed'
  );

  console.error(error);

  process.exit(1);
});