const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");

const DOMAIN = "https://antoniobishik.com";

function normalizeUrl(relativePath) {
  let value = relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  if (
    value === "index.html" ||
    value === ""
  ) {
    return `${DOMAIN}/`;
  }

  if (value.endsWith("/index.html")) {
    value = value.slice(
      0,
      -"index.html".length
    );
  }

  if (value.endsWith(".html")) {
    value = value.slice(
      0,
      -".html".length
    );
  }

  value = value
    .replace(/\/+/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  return `${DOMAIN}/${value}/`;
}

function collectIndexFiles(directory, base = "") {
  const results = [];

  if (!fs.existsSync(directory)) {
    return results;
  }

  for (const item of fs.readdirSync(
    directory
  )) {
    if (
      item === "assets" ||
      item === ".vscode"
    ) {
      continue;
    }

    const fullPath =
      path.join(directory, item);

    const relative =
      path.join(base, item);

    const stat =
      fs.lstatSync(fullPath);

    if (stat.isDirectory()) {
      results.push(
        ...collectIndexFiles(
          fullPath,
          relative
        )
      );
    } else if (
      item.toLowerCase() ===
      "index.html"
    ) {
      results.push(relative);
    }
  }

  return results;
}

function buildSitemap() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(
      "❌ dist directory does not exist."
    );

    console.error(
      "Run: npm run build"
    );

    process.exit(1);
  }

  const files =
    collectIndexFiles(
      DIST_DIR
    );

  const urls = new Set();

  for (const file of files) {
    const fullPath =
      path.join(
        DIST_DIR,
        file
      );

    const stats =
      fs.statSync(fullPath);

    if (stats.size <= 0) {
      continue;
    }

    const url =
      normalizeUrl(file);

    if (
      url.includes("/base/") ||
      url.includes("/location-page/") ||
      url.includes("/service-page/")
    ) {
      continue;
    }

    urls.add(url);
  }

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  const sortedUrls =
    Array.from(urls)
      .sort((a, b) =>
        a.localeCompare(b)
      );

  let xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const url of sortedUrls) {
    let priority = "0.8";

    if (
      url === `${DOMAIN}/`
    ) {
      priority = "1.0";
    } else if (
      /\/(ar|tr|es)\/?$/.test(url)
    ) {
      priority = "0.9";
    } else if (
      url.split("/").length >= 5
    ) {
      priority = "0.9";
    }

    xml +=
`  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>
`;
  }

  xml += "</urlset>\n";

  fs.writeFileSync(
    path.join(
      DIST_DIR,
      "sitemap.xml"
    ),
    xml,
    "utf8"
  );

  fs.writeFileSync(
    path.join(
      DIST_DIR,
      "robots.txt"
    ),
`User-agent: *
Allow: /

Sitemap: ${DOMAIN}/sitemap.xml
`,
    "utf8"
  );

  console.log(
    `✅ Sitemap generated successfully. URLs: ${sortedUrls.length}`
  );
}

buildSitemap();