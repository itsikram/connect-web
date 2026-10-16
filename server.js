// Production server for the built React app (used by GoDaddy Node.js
// Hosting via `npm start`). Serves ./build and falls back to index.html for
// client-side routes. Local development uses `npm run dev`.
const http = require("http");
const https = require("https");
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
    title: "Connect – Connect BD Social Media App by Ikramul | Connect Online",
    description:
      "Connect (Connect BD) is a free social media app by Ikramul. Chat, video call, share moments and build communities with Connect online on web, Android and iPhone.",
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
  "/about": {
    title: "About Connect – Connect BD Social Media App by Ikramul",
    description:
      "About Connect (Connect BD): the free social media app by Ikramul for chat, video calls, posts and communities. Learn who built the Connect App and how to use Connect online.",
  },
  "/privacy-policy": {
    title: "Privacy Policy | Connect BD",
    description:
      "How Connect BD collects, uses, shares and protects your information when you use the Connect website and mobile apps.",
  },
  "/terms-of-service": {
    title: "Terms of Service | Connect BD",
    description:
      "The terms and rules for using Connect BD, the social media app for messaging, video calls, sharing moments and communities.",
  },
  // Aliases render the same pages; canonical points Google at one URL.
  "/privacy": { alias: "/privacy-policy" },
  "/terms": { alias: "/terms-of-service" },
  "/portfolio": {
    title: "Md Ikram (Programmer Ikram) – WordPress Developer & Software Engineer",
    description:
      "Md Ikram (Ikramul Islam), known as Programmer Ikram, is a WordPress Developer and Senior Software Developer from Bangladesh building WordPress, MERN Stack and React Native apps.",
    image: PORTFOLIO_IMAGE,
    ogType: "profile",
  },
  "/portfolio/about": {
    title: "About Md Ikram – Programmer Ikram, WordPress & MERN Developer",
    description:
      "About Md Ikram (Ikramul Islam / Programmer Ikram): a WordPress Developer and Senior Software Developer from Munshiganj, Bangladesh, with 5+ years of experience.",
    image: PORTFOLIO_IMAGE,
    ogType: "profile",
  },
  "/portfolio/resume": {
    title: "Md Ikram Resume – WordPress Developer & Senior Software Developer",
    description:
      "Resume of Md Ikram (Programmer Ikram, Ikramul Islam): WordPress development, MERN Stack and React Native experience, skills and education.",
    image: PORTFOLIO_IMAGE,
    ogType: "profile",
  },
  "/portfolio/blogs": {
    title: "Blog by Programmer Ikram (Md Ikram) – WordPress, React & MERN",
    description:
      "Articles by Md Ikram (Programmer Ikram) on WordPress development, React, React Native and the MERN Stack.",
    image: PORTFOLIO_IMAGE,
  },
  "/portfolio/contact": {
    title: "Contact Md Ikram – Hire a WordPress Developer in Bangladesh",
    description:
      "Hire Md Ikram (Programmer Ikram / Ikramul Islam) for WordPress websites, custom themes and plugins, MERN Stack and React Native apps.",
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
  const requested = pathname.replace(/\/+$/, "") || "/";
  const route = PUBLIC_PAGES[requested]?.alias || requested;
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
  if (route.startsWith("/portfolio")) {
    const body = renderPortfolioBody(route, getPortfolioData());
    if (body) {
      html = html.replace(
        '<div id="root"></div>',
        `<div id="root">${body}</div>`
      );
    }
  }
  return { html, robots: null };
};

// --- SEO: static portfolio content ----------------------------------------
// Without this every /portfolio URL serves the same empty app shell, which
// Google tends to leave as "Discovered - currently not indexed". We render
// the real portfolio text (from the same /api/portfolio the app uses) into
// #root; React's createRoot replaces it as soon as the app mounts.
const PORTFOLIO_API_BASES = (
  process.env.PORTFOLIO_API_BASES ||
  "https://connect-server-nhaw.onrender.com,https://connect-server-u85b.onrender.com,https://connect-server-k1if.onrender.com,https://oeazgm4zwn.c35.airoapp.ai"
)
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
const PORTFOLIO_TTL_MS = 10 * 60 * 1000;

let portfolioCache = { data: null, fetchedAt: 0, refreshing: false };

const fetchJson = (url, timeoutMs) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith("http:") ? http : https;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });

const refreshPortfolio = async () => {
  if (portfolioCache.refreshing) return;
  portfolioCache.refreshing = true;
  try {
    for (const base of PORTFOLIO_API_BASES) {
      try {
        const data = await fetchJson(`${base}/api/portfolio`, 8000);
        if (data && data.profile) {
          portfolioCache.data = data;
          portfolioCache.fetchedAt = Date.now();
          return;
        }
      } catch (_) {
        /* try the next server */
      }
    }
  } finally {
    portfolioCache.refreshing = false;
  }
};

// Never block a page on the API: serve what we have, refresh in background.
const getPortfolioData = () => {
  if (Date.now() - portfolioCache.fetchedAt > PORTFOLIO_TTL_MS) {
    refreshPortfolio();
  }
  return portfolioCache.data;
};

const esc = escapeAttr;
const list = (items) =>
  items && items.length
    ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
    : "";

const renderPortfolioBody = (route, d) => {
  if (!d || !d.profile) return "";
  const p = d.profile;
  const name = p.name || "Md Ikram";
  const nav = `<nav aria-label="Portfolio"><a href="/portfolio">Home</a> · <a href="/portfolio/about">About</a> · <a href="/portfolio/resume">Resume</a> · <a href="/portfolio/blogs">Blog</a> · <a href="/portfolio/contact">Contact</a> · <a href="/">Connect BD</a></nav>`;
  const experience = (d.experiences || [])
    .map(
      (e) =>
        `<article><h3>${esc(e.role)} — ${esc(e.company)}</h3><p>${esc(
          e.period || ""
        )}${e.location ? ` · ${esc(e.location)}` : ""}</p>${list(e.bullets)}</article>`
    )
    .join("");
  const education = (d.education || [])
    .map(
      (e) =>
        `<article><h3>${esc(e.title)}${e.field ? ` — ${esc(e.field)}` : ""}</h3><p>${esc(
          [e.org, e.board, e.period, e.result].filter(Boolean).join(" · ")
        )}</p></article>`
    )
    .join("");
  const skills = ((d.skills && d.skills.groups) || [])
    .map((g) => `<h3>${esc(g.title)}</h3><p>${esc((g.items || []).join(", "))}</p>`)
    .join("");

  let main;
  if (route === "/portfolio/about") {
    const a = d.aboutPage || {};
    main = `<h1>${esc(a.title || `About ${name}`)}</h1><p>${esc(a.subtitle || "")}</p>
<h2>Career Objectives</h2><p>${esc(a.careerObjectives || "")}</p>
<h2>Strengths</h2>${list(a.strengths)}
<h2>Skills</h2>${skills}`;
  } else if (route === "/portfolio/resume") {
    const r = d.resumePage || {};
    main = `<h1>${esc(r.title || `Resume of ${name}`)}</h1><p>${esc(r.subtitle || "")}</p>
<h2>Work Experience</h2>${experience}<h2>Education</h2>${education}<h2>Skills</h2>${skills}`;
  } else if (route === "/portfolio/blogs") {
    const b = d.blogs || {};
    const posts = (b.posts || [])
      .map(
        (post) =>
          `<article><h2>${esc(post.title)}</h2><p>${esc(
            [post.date, post.readTime].filter(Boolean).join(" · ")
          )}</p><p>${esc(post.excerpt || "")}</p></article>`
      )
      .join("");
    main = `<h1>${esc(b.title || `Blog by ${name}`)}</h1><p>${esc(b.subtitle || "")}</p>${posts}`;
  } else if (route === "/portfolio/contact") {
    const c = d.contactPage || {};
    const s = d.social || {};
    const links = [
      ["LinkedIn", s.linkedin],
      ["GitHub", s.github],
      ["Facebook", s.facebook],
    ]
      .filter(([, href]) => href)
      .map(([label, href]) => `<li><a href="${esc(href)}" rel="me">${label}</a></li>`)
      .join("");
    main = `<h1>${esc(c.title || `Contact ${name}`)}</h1><p>${esc(c.subtitle || "")}</p>
<p>${esc(name)} — ${esc(p.jobTitle || "")}${p.locality ? `, ${esc(p.locality)}` : ""}${p.country ? `, ${esc(p.country)}` : ""}.</p>${links ? `<ul>${links}</ul>` : ""}`;
  } else {
    const h = d.hero || {};
    const projects = ((d.projects && d.projects.items) || [])
      .map((pr) => `<article><h3>${esc(pr.title)}</h3><p>${esc(pr.description || "")}</p></article>`)
      .join("");
    main = `<h1>${esc(name)} (Programmer Ikram) — WordPress Developer &amp; ${esc(p.jobTitle || "Software Developer")}</h1><p>Also known as ${esc((p.alternateNames || ["Programmer Ikram", "Ikramul Islam"]).join(", "))}. ${esc(p.tagline || "")}</p><p>${esc(h.description || "")}</p>
<h2>${esc((d.skills && d.skills.title) || "Skills")}</h2>${skills}
<h2>${esc((d.projects && d.projects.title) || "Projects")}</h2>${projects}
<h2>Work Experience</h2>${experience}`;
  }

  return `<div style="max-width:860px;margin:0 auto;padding:24px 16px;font-family:Inter,system-ui,sans-serif;line-height:1.6;color:#e5e7eb;background:#111112">${nav}<main>${main}</main>${
    d.footerText ? `<footer><p>${esc(d.footerText)}</p></footer>` : ""
  }</div>`;
};

refreshPortfolio();

// --- SEO: public user profiles (/:username) --------------------------------
// The API's /api/profile/public/:username returns display fields only, and
// only for profiles whose posts are Public ("indexable"). Everything else
// stays noindex. First path segments used by the app itself skip the lookup.
const APP_ROUTES = new Set(
  (
    "menu wallet video-call youtube expo download-app downloads search login signup " +
    "forgot-password reset-password story post connects watch message ludo-game chess-game " +
    "video-player marketplace groups yt-download camera notes tasks timer flashcards calendar " +
    "habits health rehab settings test-notifications privacy terms about portfolio api static " +
    "assets privacy-policy terms-of-service"
  ).split(" ")
);
const USERNAME_RE = /^[A-Za-z0-9._-]{1,64}$/;
const PROFILE_TTL_MS = 5 * 60 * 1000;
const PROFILE_CACHE_MAX = 5000;
const profileCache = new Map(); // username -> { at, data } (data null = not public)

const lookupPublicProfile = async (username) => {
  const hit = profileCache.get(username);
  if (hit && Date.now() - hit.at < PROFILE_TTL_MS) return hit.data;
  for (const base of PORTFOLIO_API_BASES) {
    try {
      const data = await fetchJson(
        `${base}/api/profile/public/${encodeURIComponent(username)}`,
        4000
      );
      const value = data && data.indexable ? data : null;
      if (profileCache.size >= PROFILE_CACHE_MAX) {
        profileCache.delete(profileCache.keys().next().value);
      }
      profileCache.set(username, { at: Date.now(), data: value });
      return value;
    } catch (e) {
      // 404 means the server answered: not a (public) profile.
      if (/HTTP 404/.test(e.message)) {
        profileCache.set(username, { at: Date.now(), data: null });
        return null;
      }
      /* network error / 5xx: try the next server */
    }
  }
  throw new Error("profile API unavailable");
};

const profileUsernameFor = (pathname) => {
  const route = pathname.replace(/\/+$/, "");
  const m = /^\/([^/]+)$/.exec(route);
  if (!m || !USERNAME_RE.test(m[1]) || APP_ROUTES.has(m[1].toLowerCase())) return null;
  return m[1];
};

const renderProfileHtml = (p) => {
  const url = `${SITE_URL}/${encodeURIComponent(p.username)}`;
  const title = `${p.name} (@${p.username}) on Connect BD`;
  const description = (
    p.bio
      ? `${p.name} (@${p.username}) is on Connect BD. ${p.bio}`
      : `${p.name} (@${p.username}) is on Connect, the Connect BD social media app. Join Connect to chat, call and share moments with ${p.name}.`
  ).slice(0, 300);
  const image = p.profilePic || `${SITE_URL}/logo512.png`;

  let html = readIndexHtml()
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(url)}$2`);
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "name", "robots", "index, follow, max-image-preview:large");
  html = setMeta(html, "property", "og:type", "profile");
  html = setMeta(html, "property", "og:url", url);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:image", image);
  html = setMeta(html, "name", "twitter:url", url);
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);
  html = setMeta(html, "name", "twitter:image", image);

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    name: title,
    dateCreated: p.joinedAt,
    mainEntity: {
      "@type": "Person",
      name: p.name,
      alternateName: `@${p.username}`,
      identifier: p.username,
      description: p.bio || undefined,
      image: p.profilePic || undefined,
      url,
    },
  }).replace(/</g, "\\u003c");
  html = html.replace(
    "</head>",
    `<script type="application/ld+json">${jsonLd}</script></head>`
  );

  const body = `<div style="max-width:720px;margin:0 auto;padding:24px 16px;font-family:Inter,system-ui,sans-serif;line-height:1.6;color:#e5e7eb;background:#111112;text-align:center"><nav><a href="/">Connect BD</a> · <a href="/about">About Connect</a> · <a href="/signup">Sign up</a></nav><main>${
    p.profilePic
      ? `<img src="${esc(p.profilePic)}" alt="${esc(p.name)} profile picture" width="128" height="128" style="border-radius:50%;object-fit:cover">`
      : ""
  }<h1>${esc(p.name)}</h1><p>@${esc(p.username)}</p>${
    p.bio ? `<p>${esc(p.bio)}</p>` : ""
  }<p><a href="/signup">Join Connect</a> to chat, call and share moments with ${esc(p.name)}.</p></main></div>`;
  return html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
};

const renderAny = async (pathname) => {
  const username = profileUsernameFor(pathname);
  if (!username) return renderIndexHtml(pathname);
  try {
    const profile = await lookupPublicProfile(username);
    if (profile) return { html: renderProfileHtml(profile), robots: null };
    return renderIndexHtml(pathname); // not public: noindex like other app routes
  } catch (_) {
    // API down: don't tell Google to drop the page, just point it at itself.
    const url = `${SITE_URL}/${encodeURIComponent(username)}`;
    const html = readIndexHtml().replace(
      /(<link rel="canonical" href=")[^"]*(")/,
      `$1${esc(url)}$2`
    );
    return { html, robots: null };
  }
};

const sendIndex = async (req, res, pathname) => {
  let rendered;
  try {
    rendered = await renderAny(pathname);
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
