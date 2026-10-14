// Production server for the built React app (used by GoDaddy Node.js
// Hosting via `npm start`). Serves ./build and falls back to index.html for
// client-side routes. Local development uses `npm run dev`.
const http = require("http");
const fs = require("fs");
const path = require("path");

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

const sendFile = (req, res, filePath, cacheControl) => {
  const type =
    MIME_TYPES[path.extname(filePath).toLowerCase()] ||
    "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": cacheControl });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(filePath).pipe(res);
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
    sendFile(req, res, INDEX_HTML, "no-cache");
  });
});

server.listen(PORT, () => {
  console.log(`connect-web serving ${BUILD_DIR} on port ${PORT}`);
});
