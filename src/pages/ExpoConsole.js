import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowLeft,
  FiCheck,
  FiCopy,
  FiCpu,
  FiDownload,
  FiExternalLink,
  FiGlobe,
  FiMenu,
  FiPlay,
  FiRefreshCw,
  FiRotateCw,
  FiSearch,
  FiSettings,
  FiSmartphone,
  FiSquare,
  FiTerminal,
  FiTrash2,
  FiWifi,
  FiZap,
} from "react-icons/fi";
import useExpoControl from "../hooks/useExpoControl";
import { showErrorToast, showSuccessToast } from "../utils/toastUtils";
import "./ExpoConsole.css";

const EXPO_GO_APP_STORE = "https://apps.apple.com/app/expo-go/id982107779";

const STATUS_META = {
  running: { label: "Running", tone: "success" },
  starting: { label: "Starting", tone: "accent" },
  stopping: { label: "Stopping", tone: "warn" },
  stopped: { label: "Stopped", tone: "muted" },
  error: { label: "Error", tone: "danger" },
};

const HEALTH_META = {
  healthy: { label: "Healthy", tone: "success" },
  degraded: { label: "Slow", tone: "warn" },
  down: { label: "Unreachable", tone: "danger" },
  unknown: { label: "Waiting", tone: "muted" },
};

const TUNNEL_STEPS = ["Checking port", "Starting Metro", "Connecting tunnel", "Verifying tunnel", "Ready"];
const LAN_STEPS = ["Checking port", "Starting Metro", "Ready"];

const OPTION_KEYS = ["mode", "provider", "bundleMode", "compress", "prewarm", "autoRecover"];

// --------------------------------------------------------------- helpers

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function formatDuration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function timeAgo(timestamp, now) {
  if (!timestamp) return "never";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
}

function clockTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour12: false });
}

function stepIndex(phase, isTunnel) {
  if (!phase) return 0;
  const map = isTunnel
    ? { "Checking port": 0, "Starting Metro bundler": 1, "Connecting tunnel": 2, "Retrying tunnel connection": 2, "Verifying tunnel": 3, Ready: 4 }
    : { "Checking port": 0, "Starting Metro bundler": 1, "Bundler ready": 2, Ready: 2 };
  return map[phase] ?? 1;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    // Clipboard API needs a secure context; plain-http LAN pages fall back here.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

const isIOSDevice = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function useNow(active, intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}

// --------------------------------------------------------------- pieces

function Pill({ tone = "muted", pulse = false, children }) {
  return (
    <span className={`ec-pill ec-tone-${tone}`}>
      <span className={`ec-dot${pulse ? " ec-dot-pulse" : ""}`} />
      {children}
    </span>
  );
}

function CopyField({ label, value, icon }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <div className="ec-copy">
      <span className="ec-copy-label">
        {icon}
        {label}
      </span>
      <div className="ec-copy-row">
        <code className="ec-copy-value" title={value}>
          {value}
        </code>
        <button type="button" className="ec-icon-btn" onClick={onCopy} aria-label={`Copy ${label}`}>
          {copied ? <FiCheck /> : <FiCopy />}
        </button>
      </div>
    </div>
  );
}

function Sparkline({ history }) {
  const width = 240;
  const height = 48;
  const points = history.filter((point) => point.ms != null);
  if (points.length < 2) {
    return <div className="ec-spark-empty">Collecting latency samples…</div>;
  }
  const max = Math.max(...points.map((p) => p.ms), 300);
  const step = width / Math.max(history.length - 1, 1);
  let path = "";
  history.forEach((point, i) => {
    if (point.ms == null) return;
    const x = i * step;
    const y = height - 4 - (point.ms / max) * (height - 8);
    path += `${path && history[i - 1] && history[i - 1].ms != null ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
  });
  const failures = history
    .map((point, i) => (point.ms == null ? i * step : null))
    .filter((x) => x != null);
  return (
    <svg className="ec-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Tunnel latency history">
      <path d={path} className="ec-spark-line" vectorEffect="non-scaling-stroke" />
      {failures.map((x) => (
        <line key={x} x1={x} x2={x} y1={0} y2={height} className="ec-spark-fail" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

function Segmented({ value, options, onChange, disabled }) {
  return (
    <div className="ec-segmented" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? "is-active" : ""}
          disabled={disabled}
          onClick={() => value !== option.value && onChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={`ec-toggle${disabled ? " is-disabled" : ""}`}>
      <span className="ec-toggle-text">
        <span className="ec-toggle-label">{label}</span>
        {description && <span className="ec-toggle-desc">{description}</span>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="ec-switch" aria-hidden="true" />
    </label>
  );
}

function Stepper({ steps, current }) {
  return (
    <ol className="ec-stepper">
      {steps.map((step, i) => (
        <li key={step} className={i < current ? "is-done" : i === current ? "is-current" : ""}>
          <span className="ec-step-marker">{i < current ? <FiCheck /> : i + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function LogConsole({ logs, onClear }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [follow, setFollow] = useState(true);
  const bodyRef = useRef(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return logs
      .filter((entry) => filter === "all" || entry.level === filter || (filter === "warn" && entry.level === "error"))
      .filter((entry) => !needle || entry.text.toLowerCase().includes(needle))
      .slice(-800);
  }, [logs, filter, query]);

  useEffect(() => {
    if (follow && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [visible, follow]);

  const onScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom !== follow) setFollow(atBottom);
  };

  const onCopy = async () => {
    const text = visible.map((e) => `${clockTime(e.t)} [${e.stream}] ${e.text}`).join("\n");
    if (await copyText(text)) showSuccessToast("Logs copied");
  };

  const errorCount = logs.filter((entry) => entry.level === "error").length;

  return (
    <section className="ec-card ec-logs">
      <div className="ec-card-head">
        <h2>
          <FiTerminal /> Server logs
        </h2>
        <div className="ec-log-tools">
          <div className="ec-search">
            <FiSearch />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter logs" aria-label="Filter logs" />
          </div>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "warn", label: "Issues" },
              { value: "error", label: `Errors${errorCount ? ` (${errorCount})` : ""}` },
            ]}
          />
          <button type="button" className="ec-icon-btn" onClick={onCopy} aria-label="Copy logs" title="Copy logs">
            <FiCopy />
          </button>
          <button type="button" className="ec-icon-btn" onClick={onClear} aria-label="Clear logs" title="Clear logs">
            <FiTrash2 />
          </button>
        </div>
      </div>
      <div className="ec-log-body" ref={bodyRef} onScroll={onScroll}>
        {visible.length === 0 ? (
          <div className="ec-log-empty">{logs.length ? "No lines match this filter." : "Logs from Expo and Metro will stream here."}</div>
        ) : (
          visible.map((entry) => (
            <div key={entry.id} className={`ec-log-line ec-log-${entry.level} ec-log-src-${entry.stream}`}>
              <span className="ec-log-time">{clockTime(entry.t)}</span>
              <span className="ec-log-text">{entry.text}</span>
            </div>
          ))
        )}
      </div>
      {!follow && (
        <button type="button" className="ec-follow" onClick={() => setFollow(true)}>
          Jump to latest
        </button>
      )}
    </section>
  );
}

function OfflinePanel({ connection, onRetry }) {
  const starting = connection === "starting" || connection === "connecting";
  return (
    <div className="ec-offline">
      <div className={`ec-offline-icon ${starting ? "is-busy" : ""}`}>{starting ? <FiRefreshCw /> : <FiCpu />}</div>
      <h2>{starting ? "Connecting to the Expo control service…" : "The Expo control service isn't running"}</h2>
      <p>
        This page talks to a small service on your computer that starts and watches Expo. It starts automatically with the web
        dev server (<code>npm start</code> in <code>web</code>). To run it on its own:
      </p>
      <pre className="ec-code">cd expo-connect-app{"\n"}npm run control</pre>
      <button type="button" className="ec-btn ec-btn-secondary" onClick={onRetry}>
        <FiRefreshCw /> Try again
      </button>
    </div>
  );
}

// --------------------------------------------------------------- page

export default function ExpoConsole() {
  const navigate = useNavigate();
  const { connection, state, logs, actions, reconnect } = useExpoControl();
  const [pending, setPending] = useState(null);
  const onIOS = useMemo(isIOSDevice, []);

  const status = state ? state.status : "stopped";
  const now = useNow(Boolean(state) && (status === "running" || status === "starting"));

  useEffect(() => {
    const previous = document.title;
    document.title = "Expo Go Tunnel · Connect";
    return () => {
      document.title = previous;
    };
  }, []);

  const run = async (name, task, successMessage) => {
    setPending(name);
    try {
      await task();
      if (successMessage) showSuccessToast(successMessage);
    } catch (error) {
      showErrorToast(error.message);
    } finally {
      setPending(null);
    }
  };

  if (connection !== "online" || !state) {
    return (
      <div className="expo-console">
        <TopBar connection={connection} onBack={() => navigate(-1)} />
        <main className="ec-main">
          <OfflinePanel connection={connection} onRetry={reconnect} />
        </main>
      </div>
    );
  }

  const options = state.options;
  const active = state.activeOptions;
  const isTunnel = (active || options).mode === "tunnel";
  const meta = STATUS_META[status] || STATUS_META.stopped;
  const running = status === "running";
  const busy = status === "starting" || status === "stopping" || Boolean(pending);
  const canStart = status === "stopped" || status === "error";
  const expoUrl = state.urls.expoGo;
  const optionsChanged = Boolean(active) && OPTION_KEYS.some((key) => active[key] !== options[key]);
  const health = HEALTH_META[state.health.status] || HEALTH_META.unknown;
  const lastTransfer = state.bundles.find((b) => b.kind === "bundle" && !b.prewarm);
  const port = state.controller.port;

  const setOption = (key, value) => run(`option-${key}`, () => actions.updateOptions({ [key]: value }));

  const freePort = () => {
    const busyInfo = state.portBusy;
    const who = busyInfo ? `${busyInfo.name || "the process"}${busyInfo.pid ? ` (PID ${busyInfo.pid})` : ""}` : "the process";
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Stop ${who} that is using port ${port}? Any Expo server running in a terminal will be closed.`)) return;
    run("free-port", actions.freePort, `Port ${port} is free`);
  };

  return (
    <div className="expo-console">
      <TopBar connection={connection} onBack={() => navigate(-1)} />

      <main className="ec-main">
        <div className="ec-layout">
          <div className="ec-col">
            {/* ---------------------------------------------------- status */}
            <section className="ec-card ec-hero">
              <div className="ec-hero-head">
                <div className="ec-hero-status">
                  <Pill tone={meta.tone} pulse={status === "starting" || running}>
                    {meta.label}
                  </Pill>
                  <span className="ec-hero-phase">
                    {running && state.readyAt
                      ? `Up ${formatDuration(now - state.readyAt)} · ${isTunnel ? "tunnel" : "LAN"} · ${(active || options).bundleMode}`
                      : status === "starting"
                        ? `${state.phase || "Starting"}${state.attempt > 1 ? ` (attempt ${state.attempt})` : ""} · ${formatDuration(now - state.startedAt)}`
                        : status === "stopping"
                          ? state.phase
                          : status === "error"
                            ? "Needs attention"
                            : "Server is off"}
                  </span>
                </div>
                <div className="ec-actions">
                  {canStart ? (
                    <button type="button" className="ec-btn ec-btn-primary" disabled={busy} onClick={() => run("start", () => actions.start())}>
                      <FiPlay /> {pending === "start" ? "Starting…" : "Start server"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ec-btn ec-btn-primary"
                        disabled={Boolean(pending) || status === "stopping"}
                        onClick={() => run("restart", () => actions.restart())}
                      >
                        <FiRotateCw /> Restart
                      </button>
                      <button type="button" className="ec-btn ec-btn-danger" disabled={status === "stopping" || pending === "stop"} onClick={() => run("stop", actions.stop)}>
                        <FiSquare /> Stop
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="ec-btn ec-btn-ghost"
                    disabled={Boolean(pending) || status === "stopping"}
                    title="Restart with an empty Metro cache (slower first load)"
                    onClick={() => run("restart-clear", () => (canStart ? actions.start({ clearCache: true }) : actions.restart({ clearCache: true })))}
                  >
                    <FiRefreshCw /> {canStart ? "Start fresh" : "Clear cache"}
                  </button>
                </div>
              </div>

              {state.error && (
                <div className="ec-alert ec-alert-danger" role="alert">
                  <FiAlertTriangle />
                  <div>
                    <strong>{state.error.message}</strong>
                    {state.error.hint && <p>{state.error.hint}</p>}
                  </div>
                  {state.error.code === "PORT_IN_USE" && (
                    <button type="button" className="ec-btn ec-btn-secondary" disabled={Boolean(pending)} onClick={freePort}>
                      Free port
                    </button>
                  )}
                </div>
              )}

              {!state.error && canStart && state.portBusy && (
                <div className="ec-alert ec-alert-warn">
                  <FiAlertTriangle />
                  <div>
                    <strong>
                      Port {port} is in use by {state.portBusy.name || "another process"}
                      {state.portBusy.pid ? ` (PID ${state.portBusy.pid})` : ""}.
                    </strong>
                    <p>An Expo server started from a terminal is probably running. Free the port so this console can take over.</p>
                  </div>
                  <button type="button" className="ec-btn ec-btn-secondary" disabled={Boolean(pending)} onClick={freePort}>
                    Free port
                  </button>
                </div>
              )}

              {optionsChanged && (running || status === "starting") && (
                <div className="ec-alert ec-alert-info">
                  <FiSettings />
                  <div>
                    <strong>Settings changed.</strong>
                    <p>Restart the server to apply them.</p>
                  </div>
                  <button type="button" className="ec-btn ec-btn-secondary" disabled={busy} onClick={() => run("restart", () => actions.restart())}>
                    Apply &amp; restart
                  </button>
                </div>
              )}

              <div className="ec-connect">
                <div className={`ec-qr${expoUrl ? "" : " is-empty"}`}>
                  {expoUrl ? (
                    <QRCodeSVG value={expoUrl} size={208} level="M" marginSize={2} bgColor="#ffffff" fgColor="#0b1220" title="Scan with your iPhone camera" />
                  ) : status === "starting" ? (
                    <div className="ec-qr-placeholder">
                      <FiRefreshCw className="ec-spin" />
                      <span>{isTunnel ? "Opening tunnel…" : "Starting…"}</span>
                    </div>
                  ) : (
                    <div className="ec-qr-placeholder">
                      <FiSmartphone />
                      <span>Start the server to get a QR code</span>
                    </div>
                  )}
                </div>

                <div className="ec-connect-info">
                  {status === "starting" && <Stepper steps={isTunnel ? TUNNEL_STEPS : LAN_STEPS} current={stepIndex(state.phase, isTunnel)} />}

                  {expoUrl ? (
                    <>
                      <CopyField label="Expo Go URL" value={expoUrl} icon={<FiSmartphone />} />
                      {onIOS ? (
                        <a className="ec-btn ec-btn-primary ec-btn-block" href={expoUrl}>
                          <FiExternalLink /> Open in Expo Go
                        </a>
                      ) : (
                        <p className="ec-hint">
                          Scan with the iPhone <strong>Camera</strong> app and tap the Expo Go banner.
                          {isTunnel && " Works on any network — Wi-Fi or cellular."}
                        </p>
                      )}
                      {state.urls.tunnel && <CopyField label="Tunnel (HTTPS)" value={state.urls.tunnel} icon={<FiGlobe />} />}
                      {state.urls.lan && state.urls.lan !== expoUrl && <CopyField label="Same Wi-Fi (LAN)" value={state.urls.lan} icon={<FiWifi />} />}
                    </>
                  ) : (
                    status !== "starting" && (
                      <div className="ec-intro">
                        <h3>Run Connect on your iPhone from anywhere</h3>
                        <p>
                          Start the server and scan the QR code with Expo Go. The tunnel URL stays the same across restarts, so
                          Expo Go&apos;s <em>Recently opened</em> list keeps working.
                        </p>
                        <a className="ec-link" href={EXPO_GO_APP_STORE} target="_blank" rel="noreferrer">
                          <FiDownload /> Get Expo Go on the App Store
                        </a>
                      </div>
                    )
                  )}
                </div>
              </div>
            </section>

            {/* ---------------------------------------------------- settings */}
            <section className="ec-card">
              <div className="ec-card-head">
                <h2>
                  <FiSettings /> Connection settings
                </h2>
                {active && <span className="ec-muted-sm">Applied on restart</span>}
              </div>

              <div className="ec-field">
                <span className="ec-field-label">Network</span>
                <Segmented
                  value={options.mode}
                  onChange={(value) => setOption("mode", value)}
                  disabled={Boolean(pending)}
                  options={[
                    { value: "tunnel", label: "Tunnel · any network", icon: <FiGlobe /> },
                    { value: "lan", label: "LAN · same Wi-Fi", icon: <FiWifi /> },
                  ]}
                />
              </div>

              <div className="ec-field">
                <span className="ec-field-label">Tunnel provider</span>
                <Segmented
                  value={options.provider}
                  onChange={(value) => setOption("provider", value)}
                  disabled={Boolean(pending) || options.mode !== "tunnel"}
                  options={[
                    { value: "ngrok", label: "ngrok (default)" },
                    { value: "expo-ws", label: "Expo WS (beta)" },
                  ]}
                />
                {options.provider === "expo-ws" && options.mode === "tunnel" && (
                  <span className="ec-field-note">Needs <code>npx expo login</code> and port 8081. Switch back to ngrok if it fails.</span>
                )}
              </div>

              <div className="ec-field">
                <span className="ec-field-label">JavaScript bundle</span>
                <Segmented
                  value={options.bundleMode}
                  onChange={(value) => setOption("bundleMode", value)}
                  disabled={Boolean(pending)}
                  options={[
                    { value: "development", label: "Development", icon: <FiZap /> },
                    { value: "production", label: "Production-like", icon: <FiCpu /> },
                  ]}
                />
                <span className="ec-field-note">
                  {options.bundleMode === "production"
                    ? "Minified, no dev checks: smallest download and fastest app. No Fast Refresh."
                    : "Fast Refresh and dev warnings. Larger bundle than production mode."}
                </span>
              </div>

              <div className="ec-toggles">
                <Toggle
                  label="Compress bundles"
                  description="Brotli/gzip over the tunnel: ~80% smaller downloads."
                  checked={options.compress}
                  disabled={Boolean(pending)}
                  onChange={(value) => setOption("compress", value)}
                />
                <Toggle
                  label="Pre-build iOS bundle"
                  description="Builds the bundle before your phone asks for it."
                  checked={options.prewarm}
                  disabled={Boolean(pending)}
                  onChange={(value) => setOption("prewarm", value)}
                />
                <Toggle
                  label="Auto-recover tunnel"
                  description="Restarts Expo when the tunnel stays unreachable."
                  checked={options.autoRecover}
                  disabled={Boolean(pending)}
                  onChange={(value) => setOption("autoRecover", value)}
                />
              </div>
            </section>
          </div>

          <div className="ec-col">
            {/* ---------------------------------------------------- health */}
            <section className="ec-card">
              <div className="ec-card-head">
                <h2>
                  <FiActivity /> {isTunnel ? "Tunnel health" : "Server health"}
                </h2>
                {running && <Pill tone={health.tone} pulse={state.health.status === "healthy"}>{health.label}</Pill>}
              </div>
              {running ? (
                <>
                  <div className="ec-metric-row">
                    <div className="ec-metric">
                      <span className="ec-metric-value">{state.health.latencyMs != null ? formatDuration(state.health.latencyMs) : "—"}</span>
                      <span className="ec-metric-label">{isTunnel ? "Round trip via tunnel" : "Metro response"}</span>
                    </div>
                    <div className="ec-metric">
                      <span className="ec-metric-value">{state.health.localMs != null ? formatDuration(state.health.localMs) : "—"}</span>
                      <span className="ec-metric-label">Local Metro</span>
                    </div>
                  </div>
                  <Sparkline history={state.health.history} />
                  <div className="ec-meta-row">
                    <span>Checked {timeAgo(state.health.checkedAt, now)}</span>
                    {isTunnel && <span>Tunnel {state.tunnel.status}</span>}
                    <span>Auto-recover {options.autoRecover ? "on" : "off"}</span>
                  </div>
                </>
              ) : (
                <p className="ec-empty">Health checks run every 10 seconds while the server is up.</p>
              )}
            </section>

            {/* ---------------------------------------------------- speed */}
            <section className="ec-card">
              <div className="ec-card-head">
                <h2>
                  <FiZap /> Load speed
                </h2>
                <button
                  type="button"
                  className="ec-btn ec-btn-ghost ec-btn-sm"
                  disabled={!running || state.prewarm.status === "running" || Boolean(pending)}
                  onClick={() => run("prewarm", actions.prewarm)}
                >
                  <FiRefreshCw className={state.prewarm.status === "running" ? "ec-spin" : ""} /> Pre-build
                </button>
              </div>

              <div className="ec-prewarm">
                <span className={`ec-dot ec-tone-${state.prewarm.status === "done" ? "success" : state.prewarm.status === "failed" ? "danger" : state.prewarm.status === "running" ? "accent" : "muted"}`} />
                <span>
                  {state.prewarm.status === "done" && `iOS bundle pre-built (${formatBytes(state.prewarm.bytes)} in ${formatDuration(state.prewarm.ms)}) — your phone skips the cold build.`}
                  {state.prewarm.status === "running" && "Pre-building the iOS bundle…"}
                  {state.prewarm.status === "failed" && `Pre-build failed: ${state.prewarm.error}`}
                  {state.prewarm.status === "idle" && (running ? "Bundle not pre-built yet." : "The iOS bundle is pre-built right after the server starts.")}
                </span>
              </div>

              {lastTransfer ? (
                <div className="ec-transfer">
                  <div className="ec-transfer-sizes">
                    <span className="ec-metric-value">{formatBytes(lastTransfer.sentBytes)}</span>
                    {lastTransfer.sentBytes < lastTransfer.rawBytes && (
                      <span className="ec-saved">
                        {Math.round((1 - lastTransfer.sentBytes / lastTransfer.rawBytes) * 100)}% smaller than {formatBytes(lastTransfer.rawBytes)}
                      </span>
                    )}
                  </div>
                  <span className="ec-metric-label">
                    Last {lastTransfer.platform} download · {formatDuration(lastTransfer.ms)} server time · {lastTransfer.encoding} · {lastTransfer.viaTunnel ? "via tunnel" : "local"} ·{" "}
                    {timeAgo(lastTransfer.at, now)}
                  </span>
                </div>
              ) : (
                <p className="ec-empty">Download stats appear when Expo Go loads the app.</p>
              )}
            </section>

            {/* ---------------------------------------------------- devices */}
            <section className="ec-card">
              <div className="ec-card-head">
                <h2>
                  <FiSmartphone /> Connected apps
                </h2>
                <span className="ec-count">{state.devices.length}</span>
              </div>
              {state.devices.length ? (
                <ul className="ec-devices">
                  {state.devices.map((device) => (
                    <li key={device.id}>
                      <FiSmartphone />
                      <div>
                        <strong>{device.name}</strong>
                        {device.app && <span>{device.app}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ec-empty">{running ? "No app connected yet. Scan the QR code with your iPhone." : "Apps appear here once they load the project."}</p>
              )}
              <div className="ec-actions ec-actions-stretch">
                <button
                  type="button"
                  className="ec-btn ec-btn-secondary"
                  disabled={!state.devices.length || Boolean(pending)}
                  onClick={() => run("reload", actions.reloadApps, "Reload sent")}
                >
                  <FiRotateCw /> Reload app
                </button>
                <button
                  type="button"
                  className="ec-btn ec-btn-secondary"
                  disabled={!state.devices.length || Boolean(pending)}
                  onClick={() => run("dev-menu", actions.openDevMenu)}
                >
                  <FiMenu /> Dev menu
                </button>
              </div>
            </section>
          </div>
        </div>

        <LogConsole logs={logs} onClear={() => run("clear-logs", actions.clearLogs)} />
      </main>
    </div>
  );
}

function TopBar({ connection, onBack }) {
  const tone = connection === "online" ? "success" : connection === "offline" ? "danger" : "warn";
  const label = connection === "online" ? "Live" : connection === "offline" ? "Offline" : "Connecting";
  return (
    <header className="ec-topbar">
      <button type="button" className="ec-icon-btn" onClick={onBack} aria-label="Go back">
        <FiArrowLeft />
      </button>
      <div className="ec-title">
        <h1>Expo Go Tunnel</h1>
        <p>Start, restart and share your dev server with Expo Go on iOS</p>
      </div>
      <Pill tone={tone} pulse={connection === "online"}>
        {label}
      </Pill>
    </header>
  );
}
