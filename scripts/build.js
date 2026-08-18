const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const TEMPLATES_DIR = path.join(ROOT_DIR, "src", "templates");
const ASSETS_DIR = path.join(ROOT_DIR, "src", "assets");
const LOCATIONS_PATH = path.join(ROOT_DIR, "data", "locations.json");
const TRANSLATIONS_PATH = path.join(ROOT_DIR, "data", "translations.json");
const DIST_DIR = path.join(ROOT_DIR, "dist");

const BASE_URL = "https://antoniobishik.com";

const LANGUAGES = ["en", "ar", "tr", "es"];

const LANGUAGE_CONFIG = {
  en: {
    htmlLang: "en",
    dir: "ltr",
    locale: "en_US"
  },
  ar: {
    htmlLang: "ar",
    dir: "rtl",
    locale: "ar_AR"
  },
  tr: {
    htmlLang: "tr",
    dir: "ltr",
    locale: "tr_TR"
  },
  es: {
    htmlLang: "es",
    dir: "ltr",
    locale: "es_ES"
  }
};

const SITE = {
  name: "Antonio Bishik™ ArchEx",
  phone: "+90-531-586-5489",
  email: "archex@antoniobishik.com",
  logo: `${BASE_URL}/assets/photo/logo.png`,
  ogImage: `${BASE_URL}/assets/photo/og-cover.jpg`,
  whatsapp: "https://wa.me/905315865489",
  instagram: "https://instagram.com/antoniobishik"
};

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readFile(file) {
  return fs.readFileSync(file, "utf8");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDist() {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, {
      recursive: true,
      force: true
    });
  }

  ensureDir(DIST_DIR);
}

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;

  ensureDir(to);

  for (const item of fs.readdirSync(from)) {
    const source = path.join(from, item);
    const destination = path.join(to, item);

    const stat = fs.lstatSync(source);

    if (stat.isDirectory()) {
      copyFolderSync(source, destination);
    } else {
      fs.copyFileSync(source, destination);
    }
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function replaceTokens(text, values) {
  let result = text;

  for (const [key, value] of Object.entries(values)) {
    result = result.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, "g"),
      value
    );
  }

  return result;
}

function cleanPath(value = "") {
  return String(value)
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/+/g, "/");
}

function normalizeUrl(pathname) {
  if (!pathname) return `${BASE_URL}/`;

  const clean = `/${cleanPath(pathname)}/`;

  return `${BASE_URL}${clean}`;
}

function localizedPath(lang, pathname) {
  const clean = cleanPath(pathname);

  if (!clean) {
    return lang === "en" ? "/" : `/${lang}/`;
  }

  return lang === "en"
    ? `/${clean}/`
    : `/${lang}/${clean}/`;
}

function localizedUrl(lang, pathname) {
  return `${BASE_URL}${localizedPath(lang, pathname)}`;
}

function replaceOrInsertMeta(html, attribute, value, content) {
  const escaped = escapeHtml(content);

  const regex = new RegExp(
    `<meta\\s+${attribute}\\s*=\\s*["']${value}["'][^>]*>`,
    "i"
  );

  const tag = `<meta ${attribute}="${value}" content="${escaped}">`;

  if (regex.test(html)) {
    return html.replace(regex, tag);
  }

  return html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function replaceMetaName(html, name, content) {
  return replaceOrInsertMeta(
    html,
    "name",
    name,
    content
  );
}

function replaceMetaProperty(html, property, content) {
  return replaceOrInsertMeta(
    html,
    "property",
    property,
    content
  );
}

function replaceCanonical(html, url) {
  const tag = `<link rel="canonical" href="${escapeHtml(url)}" />`;

  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    return html.replace(
      /<link\s+rel=["']canonical["'][^>]*>/i,
      tag
    );
  }

  return html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function replaceTitle(html, title) {
  const tag = `<title>${escapeHtml(title)}</title>`;

  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(
      /<title>[\s\S]*?<\/title>/i,
      tag
    );
  }

  return html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function replaceHtmlLanguage(html, lang) {
  const config = LANGUAGE_CONFIG[lang];

  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(
      /<html\b[^>]*>/i,
      `<html lang="${config.htmlLang}" dir="${config.dir}" class="scroll-smooth">`
    );
  }

  return html;
}

function removeOldHreflang(html) {
  return html.replace(
    /<link\s+rel=["']alternate["']\s+hreflang=["'][^"']+["'][^>]*>\s*/gi,
    ""
  );
}

function createHreflangTags(pathname) {
  let result = "";

  for (const lang of LANGUAGES) {
    result += `<link rel="alternate" hreflang="${LANGUAGE_CONFIG[lang].htmlLang}" href="${escapeHtml(
      localizedUrl(lang, pathname)
    )}" />\n`;
  }

  result += `<link rel="alternate" hreflang="x-default" href="${escapeHtml(
    localizedUrl("en", pathname)
  )}" />`;

  return result;
}

function injectHreflang(html, pathname) {
  const cleaned = removeOldHreflang(html);

  return cleaned.replace(
    /<\/head>/i,
    `${createHreflangTags(pathname)}\n</head>`
  );
}

function replaceOpenGraph(html, data) {
  let result = html;

  result = replaceMetaProperty(result, "og:type", data.type);
  result = replaceMetaProperty(result, "og:url", data.url);
  result = replaceMetaProperty(result, "og:title", data.title);
  result = replaceMetaProperty(result, "og:description", data.description);
  result = replaceMetaProperty(result, "og:image", SITE.ogImage);
  result = replaceMetaProperty(result, "og:locale", data.locale);

  result = replaceMetaName(
    result,
    "twitter:card",
    "summary_large_image"
  );

  result = replaceMetaName(
    result,
    "twitter:title",
    data.title
  );

  result = replaceMetaName(
    result,
    "twitter:description",
    data.description
  );

  result = replaceMetaName(
    result,
    "twitter:image",
    SITE.ogImage
  );

  return result;
}

function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
    name: SITE.name,
    url: BASE_URL,
    logo: SITE.logo,
    email: SITE.email,
    telephone: SITE.phone,
    sameAs: [
      SITE.instagram
    ],
    knowsAbout: [
      "Architecture",
      "Architectural Design",
      "Interior Design",
      "3D Visualization",
      "3D Rendering",
      "Web Development",
      "Smart Home Automation"
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: SITE.phone,
      email: SITE.email,
      contactType: "customer service",
      areaServed: "Worldwide",
      availableLanguage: [
        "English",
        "Arabic",
        "Turkish",
        "Spanish"
      ]
    }
  };
}

// التعديل الذي طلبته تم تطبيقه هنا فقط:
function generateWebSiteSchema() {
  return {
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    url: BASE_URL,
    name: SITE.name,
    publisher: {
      "@id": `${BASE_URL}/#organization`
    }
  };
}

function generateWebPageSchema({
  url,
  title,
  description,
  lang
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    inLanguage: LANGUAGE_CONFIG[lang].htmlLang,
    isPartOf: {
      "@id": `${BASE_URL}/#website`
    },
    about: {
      "@id": `${BASE_URL}/#organization`
    }
  };
}

function generateLocationSchema({
  url,
  city,
  country,
  description
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: `${SITE.name} Services in ${city}`,
    description,
    provider: {
      "@id": `${BASE_URL}/#organization`
    },
    areaServed: {
      "@type": "City",
      name: city,
      containedInPlace: {
        "@type": "Country",
        name: country
      }
    },
    serviceType: [
      "Architectural Design",
      "3D Visualization",
      "Web Development",
      "Smart Home Automation"
    ]
  };
}

function injectSchema(html, schemas) {
  const script = `<script type="application/ld+json">\n${JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": schemas
    },
    null,
    2
  )}\n</script>`;

  html = html.replace(
    /<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>\s*/gi,
    ""
  );

  return html.replace(
    /<\/head>/i,
    `${script}\n</head>`
  );
}

function createLocationContent({
  lang,
  city,
  country,
  description,
  translations
}) {
  const t = translations[lang];

  if (!t) return "";

  const heading = replaceTokens(
    t.location_heading,
    {
      CITY: escapeHtml(city),
      COUNTRY: escapeHtml(country)
    }
  );

  const text = description
    ? escapeHtml(description)
    : replaceTokens(
        t.location_text,
        {
          CITY: escapeHtml(city),
          COUNTRY: escapeHtml(country)
        }
      );

  const servicesHeading = replaceTokens(
    t.services_heading,
    {
      CITY: escapeHtml(city)
    }
  );

  const cta = escapeHtml(t.cta);

  return `
<section
  id="global-location-seo"
  class="py-16 bg-[#111] border-t border-white/5"
  data-location="${escapeHtml(city)}"
>
  <div class="container mx-auto px-6 max-w-6xl">

    <div class="max-w-4xl">
      <p class="text-primary uppercase tracking-[0.25em] text-xs mb-4">
        ${escapeHtml(country)}
      </p>

      <h2 class="font-heading text-3xl md:text-5xl text-white mb-6">
        ${heading}
      </h2>

      <p class="text-white/70 leading-8 text-base md:text-lg">
        ${text}
      </p>
    </div>

    <div class="mt-12">
      <h3 class="font-heading text-2xl md:text-3xl text-white mb-8">
        ${servicesHeading}
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

        <article class="border border-white/10 p-6 bg-white/[0.02]">
          <h4 class="text-white font-semibold mb-3">
            ${lang === "ar" ? "التصميم المعماري" :
              lang === "tr" ? "Mimari Tasarım" :
              lang === "es" ? "Diseño Arquitectónico" :
              "Architectural Design"}
          </h4>
          <p class="text-white/60 text-sm leading-7">
            ${lang === "ar" ? "حلول تصميم معماري متقدمة للمشاريع السكنية والتجارية." :
              lang === "tr" ? "Konut ve ticari projeler için gelişmiş mimari tasarım çözümleri." :
              lang === "es" ? "Soluciones avanzadas de diseño arquitectónico para proyectos residenciales y comerciales." :
              "Advanced architectural design solutions for residential and commercial projects."}
          </p>
        </article>

        <article class="border border-white/10 p-6 bg-white/[0.02]">
          <h4 class="text-white font-semibold mb-3">
            ${lang === "ar" ? "التصوير ثلاثي الأبعاد" :
              lang === "tr" ? "3D Görselleştirme" :
              lang === "es" ? "Visualización 3D" :
              "3D Visualization"}
          </h4>
          <p class="text-white/60 text-sm leading-7">
            ${lang === "ar" ? "صور ورندرات واقعية تساعد على تصور المشروع قبل التنفيذ." :
              lang === "tr" ? "Projenizi inşa edilmeden önce görselleştiren gerçekçi 3D çalışmalar." :
              lang === "es" ? "Visualizaciones 3D realistas para presentar proyectos antes de su construcción." :
              "High-quality 3D visualization and rendering before construction."}
          </p>
        </article>

        <article class="border border-white/10 p-6 bg-white/[0.02]">
          <h4 class="text-white font-semibold mb-3">
            ${lang === "ar" ? "تطوير الويب" :
              lang === "tr" ? "Web Geliştirme" :
              lang === "es" ? "Desarrollo Web" :
              "Web Development"}
          </h4>
          <p class="text-white/60 text-sm leading-7">
            ${lang === "ar" ? "مواقع رقمية احترافية سريعة ومهيأة لمحركات البحث." :
              lang === "tr" ? "Hızlı, modern ve arama motorları için optimize edilmiş web çözümleri." :
              lang === "es" ? "Soluciones web modernas, rápidas y optimizadas para buscadores." :
              "Fast, modern and search-engine-friendly digital solutions."}
          </p>
        </article>

        <article class="border border-white/10 p-6 bg-white/[0.02]">
          <h4 class="text-white font-semibold mb-3">
            ${lang === "ar" ? "المنازل الذكية" :
              lang === "tr" ? "Akıllı Ev" :
              lang === "es" ? "Hogar Inteligente" :
              "Smart Home"}
          </h4>
          <p class="text-white/60 text-sm leading-7">
            ${lang === "ar" ? "تكامل تقنيات الإضاءة والأتمتة والتحكم الذكي للمساحات الحديثة." :
              lang === "tr" ? "Modern yaşam alanları için aydınlatma, otomasyon ve akıllı kontrol entegrasyonu." :
              lang === "es" ? "Integración de iluminación, automatización y control inteligente." :
              "Smart lighting, automation and connected-home integration."}
          </p>
        </article>

      </div>
    </div>

    <div class="mt-12">
      <a
        href="${lang === "en" ? "/contact/" : `/${lang}/contact/`}"
        class="inline-flex px-8 py-4 border border-primary text-primary hover:bg-primary hover:text-black transition-all font-semibold"
      >
        ${cta}
      </a>
    </div>

  </div>
</section>
`;
}

function injectLocationContent(html, content) {
  if (!content) return html;

  if (html.includes("id=\"global-location-seo\"")) {
    return html;
  }

  return html.replace(
    /<\/body>/i,
    `${content}\n</body>`
  );
}

function normalizeInternalLinks(html, lang) {
  const prefix = lang === "en" ? "" : `/${lang}`;

  html = html.replace(
    /href=["'](?:\.\/|\.\.\/|\/)?index\.html["']/gi,
    `href="${prefix || "/" }"`
  );

  const pages = [
    "about",
    "architecture",
    "rendering",
    "web-development",
    "contact",
    "3d-rendering",
    "smart-home-automation",
    "architectural-design"
  ];

  for (const page of pages) {
    const replacement = `${prefix}/${page}/`.replace(
      /\/+/g,
      "/"
    );

    html = html.replace(
      new RegExp(
        `href=["'](?:\\.\\/|\\.\\.\\/|\\/)?${page}\\.html["']`,
        "gi"
      ),
      `href="${replacement}"`
    );
  }

  html = html.replace(
    /window\.location\.href\s*=\s*["'](?:\.\/|\.\.\/|\/)?(about|architecture|rendering|web-development|contact)\.html["']/gi,
    `window.location.href='${prefix}/$1/'`
  );

  return html;
}

function fixAssetPaths(html) {
  return html.replace(
    /(href|src)=["'](?:\.\/|\.\.\/|\/)?assets\/([^"']+)["']/gi,
    `$1="/assets/$2"`
  );
}

function generatePage({
  template,
  lang,
  pathname,
  title,
  description,
  keywords,
  pageType,
  city,
  country,
  locationDescription,
  translations
}) {
  const config = LANGUAGE_CONFIG[lang];

  const url = localizedUrl(lang, pathname);

  let html = template;

  html = replaceHtmlLanguage(html, lang);
  html = fixAssetPaths(html);
  html = normalizeInternalLinks(html, lang);

  html = replaceTitle(html, title);

  html = replaceMetaName(
    html,
    "description",
    description
  );

  html = replaceMetaName(
    html,
    "keywords",
    keywords
  );

  html = replaceMetaName(
    html,
    "robots",
    "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
  );

  html = replaceCanonical(
    html,
    url
  );

  html = injectHreflang(
    html,
    pathname
  );

  html = replaceOpenGraph(
    html,
    {
      type: city ? "website" : "website",
      url,
      title,
      description,
      locale: config.locale
    }
  );

  const schemas = [
    generateOrganizationSchema(),
    generateWebPageSchema({
      url,
      title,
      description,
      lang
    })
  ];

  if (
    pathname === "" ||
    pathname === "/"
  ) {
    schemas.push(
      generateWebSiteSchema()
    );
  }

  if (city && country) {
    schemas.push(
      generateLocationSchema({
        url,
        city,
        country,
        description: locationDescription
      })
    );

    html = injectLocationContent(
      html,
      createLocationContent({
        lang,
        city,
        country,
        description: locationDescription,
        translations
      })
    );
  }

  html = injectSchema(
    html,
    schemas
  );

  return html;
}

const sitemapUrls = new Map();

function addSitemapUrl(url, priority = 0.8) {
  sitemapUrls.set(url, priority);
}

function writeSitemap() {
  const today = new Date()
    .toISOString()
    .split("T")[0];

  const urls = Array.from(
    sitemapUrls.entries()
  ).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  let xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const [url, priority] of urls) {
    xml +=
`  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>
`;
  }

  xml += "</urlset>\n";

  fs.writeFileSync(
    path.join(DIST_DIR, "sitemap.xml"),
    xml,
    "utf8"
  );

  console.log(
    `✅ Sitemap generated: ${urls.length} URLs`
  );
}

function writeRobots() {
  const robots =
`User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;

  fs.writeFileSync(
    path.join(DIST_DIR, "robots.txt"),
    robots,
    "utf8"
  );
}

function build() {
  console.log(
    "🚀 Antonio Bishik™ ArchEx Global SEO Build"
  );

  const locations = readJSON(
    LOCATIONS_PATH
  );

  const translations = readJSON(
    TRANSLATIONS_PATH
  );

  cleanDist();

  copyFolderSync(
    ASSETS_DIR,
    path.join(DIST_DIR, "assets")
  );

  console.log("✅ Assets copied");

  const templates = fs
    .readdirSync(TEMPLATES_DIR)
    .filter(file => file.endsWith(".html"));

  const homeTemplatePath = path.join(
    TEMPLATES_DIR,
    "home.html"
  );

  const homeTemplate = fs.existsSync(
    homeTemplatePath
  )
    ? readFile(homeTemplatePath)
    : null;

  /*
   * ---------------------------------------------------
   * CORE PAGES
   * ---------------------------------------------------
   */

  for (const lang of LANGUAGES) {
    const isEnglish = lang === "en";

    const languageDir = isEnglish
      ? DIST_DIR
      : path.join(DIST_DIR, lang);

    ensureDir(languageDir);

    for (const file of templates) {
      const template = readFile(
        path.join(TEMPLATES_DIR, file)
      );

      const originalName = file;

      const outputName =
        originalName === "home.html"
          ? "index.html"
          : originalName;

      const pageName =
        outputName.replace(
          /\.html$/i,
          ""
        );

      const pathname =
        outputName === "index.html"
          ? ""
          : pageName;

      const defaultTitle =
        originalName === "home.html"
          ? "Antonio Bishik™ ArchEx | Architecture & Technology"
          : `Antonio Bishik™ ArchEx | ${pageName.replace(/-/g, " ")}`;

      const defaultDescription =
        "Antonio Bishik™ ArchEx provides professional architectural design, 3D visualization, web development and smart home solutions for clients worldwide.";

      const html = generatePage({
        template,
        lang,
        pathname,
        title: defaultTitle,
        description: defaultDescription,
        keywords:
          "Antonio Bishik, ArchEx, architecture, architectural design, 3D visualization, 3D rendering, web development, smart home, interior design, worldwide",
        pageType: "Core Page",
        translations
      });

      let targetDir = languageDir;

      if (outputName !== "index.html") {
        targetDir = path.join(
          languageDir,
          pageName
        );

        ensureDir(targetDir);
      }

      fs.writeFileSync(
        path.join(targetDir, "index.html"),
        html,
        "utf8"
      );

      addSitemapUrl(
        localizedUrl(
          lang,
          pathname
        ),
        pathname === "" ? 1.0 : 0.8
      );
    }
  }

  console.log("✅ Core pages generated");

  /*
   * ---------------------------------------------------
   * LOCATION PAGES
   * ---------------------------------------------------
   */

  if (
    homeTemplate &&
    fs.existsSync(LOCATIONS_PATH)
  ) {
    for (const lang of LANGUAGES) {
      for (const [countryKey, countryData] of Object.entries(
        locations
      )) {
        if (
          !countryData ||
          !Array.isArray(countryData.cities)
        ) {
          continue;
        }

        for (const city of countryData.cities) {
          if (
            !city ||
            !city.name ||
            !city.slug
          ) {
            continue;
          }

          const cityName = city.name;
          const countryName =
            countryData.country_name ||
            countryKey;

          const translation =
            translations[lang];

          const locationDescription =
            city.unique_descriptions &&
            city.unique_descriptions[lang]
              ? city.unique_descriptions[lang]
              : replaceTokens(
                  translation.location_text,
                  {
                    CITY: cityName,
                    COUNTRY: countryName
                  }
                );

          const title =
            replaceTokens(
              translation.meta_title,
              {
                CITY: cityName,
                COUNTRY: countryName
              }
            );

          const description =
            replaceTokens(
              translation.meta_desc,
              {
                CITY: cityName,
                COUNTRY: countryName
              }
            );

          const keywords =
            replaceTokens(
              translation.keywords,
              {
                CITY: cityName,
                COUNTRY: countryName
              }
            );

          const pathname =
            `${countryKey}/${city.slug}`;

          const html =
            generatePage({
              template: homeTemplate,
              lang,
              pathname,
              title,
              description,
              keywords,
              pageType: "Location Page",
              city: cityName,
              country: countryName,
              locationDescription,
              translations
            });

          const outputDir =
            path.join(
              DIST_DIR,
              localizedPath(
                lang,
                pathname
              )
            );

          ensureDir(outputDir);

          fs.writeFileSync(
            path.join(
              outputDir,
              "index.html"
            ),
            html,
            "utf8"
          );

          addSitemapUrl(
            localizedUrl(
              lang,
              pathname
            ),
            0.9
          );
        }
      }
    }

    console.log(
      "✅ Global location pages generated"
    );
  }

  /*
   * ---------------------------------------------------
   * ROBOTS + SITEMAP
   * ---------------------------------------------------
   */

  writeSitemap();
  writeRobots();

  console.log("");
  console.log(
    "🎉 BUILD COMPLETE"
  );
  console.log(
    `🌍 Languages: ${LANGUAGES.join(", ")}`
  );
  console.log(
    `🔗 URLs: ${sitemapUrls.size}`
  );
  console.log(
    `🌐 Domain: ${BASE_URL}`
  );
}

try {
  build();
} catch (error) {
  console.error("");
  console.error(
    "❌ BUILD FAILED"
  );
  console.error(error);
  process.exit(1);
}
// Force Final SEO Update