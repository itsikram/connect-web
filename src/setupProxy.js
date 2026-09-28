const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");
const { spawn } = require("child_process");

const EXPO_CONTROL_PORT = Number(process.env.EXPO_CONTROL_PORT) || 19010;
const EXPO_CONTROL_PREFIX = "/__expo-control";
const EXPO_APP_DIR = path.resolve(__dirname, "../../expo-connect-app");
const EXPO_CONTROL_ENTRY = path.join(EXPO_APP_DIR, "scripts/expo-control/index.js");
// Dev-server variables that must not leak into the Expo/Metro process.
const DEV_SERVER_ENV = /^(REACT_APP_|WDS_|SSL_)|^(NODE_ENV|BABEL_ENV|PORT|HOST|HTTPS|BROWSER|PUBLIC_URL|FAST_REFRESH|GENERATE_SOURCEMAP|DISABLE_ESLINT_PLUGIN|TSC_COMPILE_ON_ERROR|SKIP_PREFLIGHT_CHECK|INLINE_RUNTIME_CHUNK)$/;

let lastAutostartAt = 0;

function isPrivateAddress(address = "") {
  const ip = address.replace(/^::ffff:/, "");
  return (
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    /^fe80:/i.test(ip)
  );
}

function pingExpoControl() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port: EXPO_CONTROL_PORT, path: "/api/health", timeout: 1000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(false));
  });
}

/**
 * Launch the Expo control daemon (expo-connect-app/scripts/expo-control) in the
 * background so the /expo page works without a separate terminal. It is
 * detached, so restarting the web dev server does not kill a running tunnel.
 * Opt out with EXPO_CONTROL_AUTOSTART=false.
 */
/** True when PM2 (home-cobalt/install-expo-control.ps1) owns the daemon. */
function isManagedByPm2() {
  try {
    const dump = fs.readFileSync(path.join(os.homedir(), ".pm2", "dump.pm2"), "utf8");
    return dump.includes('"connect-expo-control"');
  } catch (_) {
    return false;
  }
}

async function autostartExpoControl() {
  if (process.env.EXPO_CONTROL_AUTOSTART === "false") return false;
  // PM2 keeps its own instance running (and restarts it); a second copy
  // started here would grab the port and leave PM2's standing by.
  if (isManagedByPm2()) return true;
  if (!fs.existsSync(EXPO_CONTROL_ENTRY)) return false;
  if (Date.now() - lastAutostartAt < 10000) return true;
  lastAutostartAt = Date.now();
  if (await pingExpoControl()) return true;

  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !DEV_SERVER_ENV.test(key))
  );
  env.EXPO_CONTROL_PORT = String(EXPO_CONTROL_PORT);

  try {
    const logFile = path.join(EXPO_APP_DIR, ".expo", "expo-control.log");
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const out = fs.openSync(logFile, "a");
    const child = spawn(process.execPath, [EXPO_CONTROL_ENTRY], {
      cwd: EXPO_APP_DIR,
      env,
      detached: true,
      stdio: ["ignore", out, out],
      windowsHide: true,
    });
    child.unref();
    fs.closeSync(out);
    return true;
  } catch (error) {
    console.warn("[expo-control] Could not start the Expo control service:", error.message);
    return false;
  }
}

/** Same-origin proxy to the daemon (which only listens on 127.0.0.1). */
function proxyExpoControl(req, res) {
  if (!isPrivateAddress(req.socket.remoteAddress)) {
    res.status(403).json({ error: "Expo control is only available on this machine or your local network.", code: "FORBIDDEN" });
    return;
  }

  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: EXPO_CONTROL_PORT,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `127.0.0.1:${EXPO_CONTROL_PORT}` },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      if (typeof res.flushHeaders === "function") res.flushHeaders();
      upstreamRes.pipe(res);
    }
  );

  upstream.on("error", async () => {
    if (res.headersSent) {
      res.end();
      return;
    }
    const starting = await autostartExpoControl();
    res.status(503).json({
      error: starting
        ? "The Expo control service is starting…"
        : "The Expo control service is not running. Run \"npm run control\" in expo-connect-app.",
      code: starting ? "CONTROL_STARTING" : "CONTROL_OFFLINE",
    });
  });

  // Tear down long-lived event streams when the browser tab goes away.
  res.on("close", () => upstream.destroy());
  req.pipe(upstream);
}

/**
 * Serve .mobileconfig with Apple's MIME type so Safari installs it
 * into Settings → Profile Downloaded (not the Files app).
 */
module.exports = function setupProxy(app) {
  app.get("/connect.mobileconfig", (req, res) => {
    const filePath = path.join(__dirname, "../public/connect.mobileconfig");
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("iOS profile not found");
    }
    res.setHeader("Content-Type", "application/x-apple-aspen-config");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="connect.mobileconfig"'
    );
    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(filePath);
  });

  app.use(EXPO_CONTROL_PREFIX, proxyExpoControl);
  autostartExpoControl();
};
