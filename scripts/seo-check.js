const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const BASE_URL = "https://antoniobishik.com";

let errors = [];
let warnings = [];

function walk(dir, result = []) {
  if (!fs.existsSync(dir)) return result;

  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.lstatSync(full);

    if (stat.isDirectory()) {
      walk(full, result);
    } else {
      result.push(full);
    }
  }

  return result;
}

function fail(file, message) {
  errors.push({
    file,
    message
  });
}

function warn(file, message) {
  warnings.push({
    file,
    message
  });
}

function getCount(html, regex) {
  return (html.match(regex) || []).length;
}

function getTag(html, regex) {
  const match = html.match(regex);
  return match ? match[1] : "";
}

function validateHtml(file) {
  const html = fs.readFileSync(file, "utf8");

  const relative =
    "/" +
    path.relative(DIST, file).replace(/\\/g, "/");

  /*
   * HTML
   */
  if (!/<html\b/i.test(html)) {
    fail(relative, "Missing <html> tag");
  }

  if (!/<html\b[^>]*\blang=["'][^"']+["']/i.test(html)) {
    fail(relative, "Missing html lang attribute");
  }

  /*
   * TITLE
   */
  const titleCount = getCount(
    html,
    /<title\b[^>]*>[\s\S]*?<\/title>/gi
  );

  if (titleCount !== 1) {
    fail(
      relative,
      `Expected exactly 1 <title>, found ${titleCount}`
    );
  }

  const title = getTag(
    html,
    /<title\b[^>]*>([\s\S]*?)<\/title>/i
  ).trim();

  if (!title) {
    fail(relative, "Empty title");
  }

  if (title.length > 65) {
    warn(
      relative,
      `Title is ${title.length} characters`
    );
  }

  /*
   * META DESCRIPTION
   */
  const descriptionCount = getCount(
    html,
    /<meta\b[^>]*name=["']description["'][^>]*>/gi
  );

  if (descriptionCount !== 1) {
    fail(
      relative,
      `Expected exactly 1 meta description, found ${descriptionCount}`
    );
  }

  const description = getTag(
    html,
    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
  ).trim();

  if (!description) {
    fail(relative, "Empty meta description");
  }

  if (description.length > 170) {
    warn(
      relative,
      `Meta description is ${description.length} characters`
    );
  }

  /*
   * CANONICAL
   */
  const canonicalCount = getCount(
    html,
    /<link\b[^>]*rel=["']canonical["'][^>]*>/gi
  );

  if (canonicalCount !== 1) {
    fail(
      relative,
      `Expected exactly 1 canonical, found ${canonicalCount}`
    );
  }

  const canonical = getTag(
    html,
    /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i
  );

  if (!canonical.startsWith(BASE_URL)) {
    fail(
      relative,
      `Canonical does not start with ${BASE_URL}`
    );
  }

  const afterProtocol =
    canonical.replace(/^https?:\/\//i, "");

  if (afterProtocol.includes("//")) {
    fail(relative, "Canonical contains duplicate //");
  }

  /*
   * HREFLANG
   */
  for (const lang of [
    "en",
    "ar",
    "tr",
    "es",
    "x-default"
  ]) {
    const regex = new RegExp(
      `<link[^>]*rel=["']alternate["'][^>]*hreflang=["']${lang}["'][^>]*>`,
      "i"
    );

    if (!regex.test(html)) {
      fail(
        relative,
        `Missing hreflang: ${lang}`
      );
    }
  }

  /*
   * H1
   */
  const h1Count = getCount(
    html,
    /<h1\b[^>]*>[\s\S]*?<\/h1>/gi
  );

  if (h1Count === 0) {
    fail(relative, "Missing H1");
  }

  if (h1Count > 1) {
    warn(
      relative,
      `Multiple H1 tags: ${h1Count}`
    );
  }

  /*
   * JSON-LD
   */
  const schemaCount = getCount(
    html,
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>/gi
  );

  if (schemaCount === 0) {
    fail(relative, "Missing JSON-LD schema");
  }

  /*
   * ROBOTS
   */
  const robotsMatch = html.match(
    /<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );

  if (
    robotsMatch &&
    /noindex/i.test(robotsMatch[1])
  ) {
    warn(
      relative,
      "Page contains noindex"
    );
  }

  /*
   * IMAGES
   */
  const images =
    html.match(/<img\b[^>]*>/gi) || [];

  for (const img of images) {
    if (!/\balt=["'][^"']*["']/i.test(img)) {
      fail(
        relative,
        "Image missing alt attribute"
      );
    }
  }

  /*
   * INTERNAL LINKS
   */
  const links =
    html.match(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi
    ) || [];

  for (const link of links) {
    const match = link.match(
      /href=["']([^"']+)["']/i
    );

    if (!match) continue;

    const href = match[1];

    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      continue;
    }

    if (href.startsWith(BASE_URL)) {
      const local = href
        .replace(BASE_URL, "")
        .split("#")[0]
        .split("?")[0];

      let target;

      if (
        local === "" ||
        local === "/"
      ) {
        target = path.join(
          DIST,
          "index.html"
        );
      } else {
        target = path.join(
          DIST,
          local.replace(/^\/+/, ""),
          "index.html"
        );
      }

      if (!fs.existsSync(target)) {
        warn(
          relative,
          `Internal link target not found: ${href}`
        );
      }
    }
  }
}

function validateSitemap() {
  const sitemapPath =
    path.join(DIST, "sitemap.xml");

  if (!fs.existsSync(sitemapPath)) {
    fail(
      "sitemap.xml",
      "Sitemap does not exist"
    );

    return;
  }

  const xml = fs.readFileSync(
    sitemapPath,
    "utf8"
  );

  const urls = [
    ...xml.matchAll(
      /<loc>(.*?)<\/loc>/gi
    )
  ].map(match => match[1]);

  if (urls.length === 0) {
    fail(
      "sitemap.xml",
      "Sitemap contains zero URLs"
    );
  }

  const uniqueUrls =
    new Set(urls);

  if (
    uniqueUrls.size !== urls.length
  ) {
    fail(
      "sitemap.xml",
      "Sitemap contains duplicate URLs"
    );
  }

  for (const url of urls) {
    if (!url.startsWith(BASE_URL)) {
      fail(
        "sitemap.xml",
        `Invalid sitemap URL: ${url}`
      );
    }
  }

  console.log(
    `🗺️ Sitemap URLs: ${urls.length}`
  );
}

function validateRobots() {
  const robotsPath =
    path.join(DIST, "robots.txt");

  if (!fs.existsSync(robotsPath)) {
    fail(
      "robots.txt",
      "robots.txt does not exist"
    );

    return;
  }

  const robots = fs.readFileSync(
    robotsPath,
    "utf8"
  );

  if (
    !/Sitemap:\s*https:\/\/antoniobishik\.com\/sitemap\.xml/i.test(
      robots
    )
  ) {
    warn(
      "robots.txt",
      "Sitemap URL missing from robots.txt"
    );
  }
}

function main() {
  console.log("");
  console.log(
    "🔍 ANTONIO BISHIK SEO VALIDATION"
  );
  console.log(
    "================================="
  );
  console.log("");

  if (!fs.existsSync(DIST)) {
    console.error(
      "❌ dist folder does not exist. Run npm run build first."
    );

    process.exit(1);
  }

  const htmlFiles = walk(DIST).filter(
    file =>
      file.toLowerCase().endsWith(".html")
  );

  console.log(
    `📄 HTML pages: ${htmlFiles.length}`
  );

  for (const file of htmlFiles) {
    validateHtml(file);
  }

  validateSitemap();
  validateRobots();

  console.log("");
  console.log(
    `⚠️ Warnings: ${warnings.length}`
  );

  for (const item of warnings) {
    console.log(
      `⚠️ ${item.file} — ${item.message}`
    );
  }

  console.log("");
  console.log(
    `❌ Errors: ${errors.length}`
  );

  for (const item of errors) {
    console.log(
      `❌ ${item.file} — ${item.message}`
    );
  }

  console.log("");

  if (errors.length > 0) {
    console.log(
      "❌ SEO VALIDATION FAILED"
    );

    process.exit(1);
  }

  console.log(
    "✅ SEO VALIDATION PASSED"
  );
}

main();