// Production server for the built React app (used by GoDaddy Node.js
// Hosting via `npm start`). Serves ./build and falls back to index.html for
// client-side routes. Local development uses `npm run dev`.
const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BUILD_DIR = path.join(__dirname, "build");
const INDEX_HTML = path.join(BUILD_DIR, "index.html");
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wasm": "application/wasm",
  ".pdf": "application/pdf",
  ".bin": "application/octet-stream",
  ".mobileconfig": "application/x-apple-aspen-config",
};

const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml|wasm)|image\/svg)/;

const acceptsGzip = (req) => /\bgzip\b/.test(req.headers["accept-encoding"] || "");

const sendFile = (req, res, filePath, cacheControl) => {
  const type =
    MIME_TYPES[path.extname(filePath).toLowerCase()] ||
    "application/octet-stream";
  const headers = { "Content-Type": type, "Cache-Control": cacheControl };
  const gzip = COMPRESSIBLE.test(type) && acceptsGzip(req);
  if (gzip) {
    headers["Content-Encoding"] = "gzip";
    headers.Vary = "Accept-Encoding";
  }
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  const stream = fs.createReadStream(filePath);
  (gzip ? stream.pipe(zlib.createGzip()) : stream).pipe(res);
};

// --- SEO: per-route <head> for crawlers and link previews -----------------
// The app is client-rendered, so without this every URL would serve the
// homepage title/description/canonical until JS runs. Social crawlers
// (Facebook, WhatsApp, X, LinkedIn) never run JS, and Google indexes the raw
// HTML first. Keep these in sync with seoPages in src/pages/Main.js and
// src/pages/portfolio/portfolioSeo.js (those still update the head client-side).
const SITE_URL = "https://connect-bd.online";
const PORTFOLIO_IMAGE = `${SITE_URL}/assets/images/portfolio-pp.png`;

const PUBLIC_PAGES = {
  "/": {
    title: "Connect BD - Social Media App in Bangladesh | Connect with Connects",
    description:
      "Connect BD by Ikramul is a modern social media app for Bangladesh users to connect, share moments, make video calls, and build communities online.",
  },
  "/login": {
    title: "Login | Connect BD by Ikramul",
    description:
      "Sign in to Connect BD by Ikramul to chat, share moments, and stay connected with connects and communities in Bangladesh.",
  },
  "/signup": {
    title: "Sign Up | Connect BD by Ikramul",
    description:
      "Create your Connect BD account today and start building your network on the leading social media app for Bangladesh users.",
  },
  "/forgot-password": {
    title: "Reset Password | Connect BD",
    description:
      "Reset your Connect BD password and get back to messaging, sharing, and calling your connects on the Connect social media app.",
  },
  "/download-app": {
    title: "Download Connect BD App for Android & iPhone | Connect",
    description:
      "Download the Connect BD social media app for Android and iPhone. Chat, share moments, make video calls, and join communities on the go.",
  },
  "/portfolio": {
    title: "Md Ikram | Senior Software Developer | Portfolio",
    description:
      "Md Ikram (Ikramul Islam) is a Senior Software Developer from Munshiganj, Bangladesh, specializing in WordPress, MERN Stack, and React Native.",
    image: PORTFOLIO_IMAGE,
    ogType: "profile",
  },
  "/portfolio/about": {
    title: "About Md Ikram | Senior Software Developer",
    description:
      "About Md Ikram (Ikramul Islam), a Senior Software Developer from Bangladesh building web and mobile apps with WordPress, MERN Stack, and React Native.",
    image: PORTFOLIO_IMAGE,
    ogType: "profile",
  },
  "/portfolio/resume": {
    title: "Resume of Md Ikram | Senior Software Developer",
    description:
      "Resume, skills, and work experience of Md Ikram (Ikramul Islam), Senior Software Developer from Bangladesh.",
    image: PORTFOLIO_IMAGE,
    ogType: "profile",
  },
  "/portfolio/blogs": {
    title: "Blog by Md Ikram | Web & App Development Articles",
    description:
      "Articles on web development, React, React Native, and WordPress by Md Ikram (Ikramul Islam).",
    image: PORTFOLIO_IMAGE,
  },
  "/portfolio/contact": {
    title: "Contact Md Ikram | Hire a Senior Software Developer",
    description:
      "Contact Md Ikram (Ikramul Islam) for web development, React Native apps, and WordPress projects.",
    image: PORTFOLIO_IMAGE,
  },
};

// Everything else (feeds, profiles, messages, settings, reset links...) is
// behind login and only renders a login redirect to crawlers, so keep it out
// of the index instead of letting Google see hundreds of duplicate pages.
const NOINDEX_ROBOTS = "noindex, follow";

const escapeAttr = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const setMeta = (html, attr, key, value) =>
  html.replace(
    new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`),
    `$1${escapeAttr(value)}$2`
  );

let indexCache = { mtimeMs: 0, html: "" };
const readIndexHtml = () => {
  const { mtimeMs } = fs.statSync(INDEX_HTML);
  if (mtimeMs !== indexCache.mtimeMs) {
    indexCache = { mtimeMs, html: fs.readFileSync(INDEX_HTML, "utf8") };
  }
  return indexCache.html;
};

const renderIndexHtml = (pathname) => {
  const route = pathname.replace(/\/+$/, "") || "/";
  const page = PUBLIC_PAGES[route];
  let html = readIndexHtml();
  if (!page) {
    return {
      html: setMeta(html, "name", "robots", NOINDEX_ROBOTS),
      robots: NOINDEX_ROBOTS,
    };
  }
  const url = route === "/" ? `${SITE_URL}/` : `${SITE_URL}${route}`;
  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(page.title)}</title>`)
    .replace(
      /(<link rel="canonical" href=")[^"]*(")/,
      `$1${escapeAttr(url)}$2`
    );
  html = setMeta(html, "name", "description", page.description);
  html = setMeta(html, "property", "og:url", url);
  html = setMeta(html, "property", "og:title", page.title);
  html = setMeta(html, "property", "og:description", page.description);
  html = setMeta(html, "name", "twitter:url", url);
  html = setMeta(html, "name", "twitter:title", page.title);
  html = setMeta(html, "name", "twitter:description", page.description);
  if (page.ogType) html = setMeta(html, "property", "og:type", page.ogType);
  if (page.image) {
    html = setMeta(html, "property", "og:image", page.image);
    html = setMeta(html, "name", "twitter:image", page.image);
  }
  return { html, robots: null };
};

const sendIndex = (req, res, pathname) => {
  let rendered;
  try {
    rendered = renderIndexHtml(pathname);
  } catch (_) {
    return sendFile(req, res, INDEX_HTML, "no-cache");
  }
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache",
    Vary: "Accept-Encoding",
  };
  if (rendered.robots) headers["X-Robots-Tag"] = rendered.robots;
  const gzip = acceptsGzip(req);
  if (gzip) headers["Content-Encoding"] = "gzip";
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  res.end(gzip ? zlib.gzipSync(rendered.html) : rendered.html);
};

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch (_) {
    res.writeHead(400);
    return res.end();
  }

  // Resolve inside BUILD_DIR only; anything escaping it is treated as missing.
  const filePath = path.join(BUILD_DIR, path.normalize(pathname));
  const insideBuild = filePath.startsWith(BUILD_DIR + path.sep);

  fs.stat(filePath, (err, stat) => {
    if (insideBuild && !err && stat.isFile()) {
      // The shell itself goes through the SEO renderer.
      if (filePath === INDEX_HTML) return sendIndex(req, res, "/");
      // Hashed bundles under /static never change; everything else (sw.js,
      // manifest, app-config.json) must be re-fetched.
      const cacheControl = pathname.startsWith("/static/")
        ? "public, max-age=31536000, immutable"
        : "no-cache";
      return sendFile(req, res, filePath, cacheControl);
    }
    // Missing file with an extension: real 404, not the app shell.
    if (path.extname(pathname)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    sendIndex(req, res, pathname);
  });
});

server.listen(PORT, () => {
  console.log(`connect-web serving ${BUILD_DIR} on port ${PORT}`);
});
