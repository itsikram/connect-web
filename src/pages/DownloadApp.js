import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { getServerAddress } from "../utils/offlineUtils";
import { openIosProfile } from "../utils/iosProfile";
import "./Menu.css";
import "./DownloadApp.css";

const EXPO_GO_IOS = "https://apps.apple.com/app/expo-go/id982107779";
const EXPO_GO_ANDROID = "https://play.google.com/store/apps/details?id=host.exp.exponent";

const PAGE_URL = "https://connect-bd.online/download-app";

const FEATURES = [
  ["fas fa-comments", "Messaging", "Private chats, voice messages, photos and emoji reactions."],
  ["fas fa-video", "Video & voice calls", "Free HD video calls and audio calls with your connects."],
  ["fas fa-images", "Posts & stories", "Share moments with your feed, stories and reels."],
  ["fas fa-users", "Groups & communities", "Join communities and chat with people who share your interests."],
  ["fas fa-bell", "Instant notifications", "Never miss a message, call or comment."],
  ["fas fa-wifi", "Offline access", "Read recent chats and posts even on a weak connection."],
];

// Shown on the page and sent as FAQPage structured data: keep them identical.
export const DOWNLOAD_FAQ = [
  {
    q: "Is the Connect App free to download?",
    a: "Yes. The Connect App (Connect BD) is free to download and free to use on Android, iPhone, iPad and the web. There are no fees for messaging or video calls.",
  },
  {
    q: "How do I download Connect on Android?",
    a: "Open connect-bd.online/download-app on your Android phone, tap Android to download the Connect APK, then open the file and allow installing from your browser if asked.",
  },
  {
    q: "How do I download Connect on iPhone or iPad?",
    a: "Open connect-bd.online/download-app in Safari on your iPhone or iPad, tap iOS, allow the profile download, then open Settings → Profile Downloaded and tap Install. Connect then appears on your home screen.",
  },
  {
    q: "Can I use Connect without downloading the app?",
    a: "Yes. Connect also works in any modern web browser at connect-bd.online, so you can chat, call and share posts on a computer without installing anything.",
  },
  {
    q: "Who made the Connect App?",
    a: "Connect (Connect BD) is a social media app built by Ikramul Islam (Md Ikram), a software developer from Bangladesh.",
  },
];

export const JSON_LD_ID = "download-app-structured-data";

// Also written into the served HTML by server.js (via the pre-render), so
// crawlers get it without running JS.
export const DOWNLOAD_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: "Connect Download – Get the Connect App for Android & iPhone",
      description:
        "Connect Download: get the free Connect App (Connect BD) for Android and iPhone. Chat, video call, share moments and join communities.",
      inLanguage: "en",
      isPartOf: { "@type": "WebSite", name: "Connect BD", url: "https://connect-bd.online/" },
      mainEntity: { "@id": `${PAGE_URL}#app` },
      breadcrumb: { "@id": `${PAGE_URL}#breadcrumb` },
    },
    {
      "@type": "MobileApplication",
      "@id": `${PAGE_URL}#app`,
      name: "Connect App",
      alternateName: ["Connect", "Connect BD", "Connect Social Media", "Connect by Ikramul"],
      url: PAGE_URL,
      downloadUrl: PAGE_URL,
      installUrl: PAGE_URL,
      image: "https://connect-bd.online/logo512.png",
      applicationCategory: "SocialNetworkingApplication",
      operatingSystem: "Android, iOS, iPadOS, Web",
      description:
        "Connect App is a free social media app for messaging, HD video calls, posts, stories and communities.",
      featureList: FEATURES.map(([, name]) => name).join(", "),
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: {
        "@type": "Person",
        name: "Ikramul Islam",
        alternateName: ["Md Ikram", "Programmer Ikram"],
        url: "https://connect-bd.online/portfolio",
      },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${PAGE_URL}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Connect", item: "https://connect-bd.online/" },
        { "@type": "ListItem", position: 2, name: "Connect Download", item: PAGE_URL },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: DOWNLOAD_FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

const detectPlatform = () => {
  // scripts/prerender-public.js renders this page in Node.
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/android/.test(ua)) return "android";
  return "other";
};

const DownloadCard = ({ accent, icon, name, desc, badge, disabled, href, to, onClick }) => {
  const body = (
    <>
      <span className="apps-menu-icon" aria-hidden="true">
        <i className={icon} />
      </span>
      <span className="apps-menu-text">
        <span className="apps-menu-name">
          {name}
          {badge && <span className="download-app-badge">{badge}</span>}
        </span>
        <span className="apps-menu-desc">{desc}</span>
      </span>
      <i
        className={`fas ${disabled ? "fa-clock" : to ? "fa-chevron-right" : "fa-download"} apps-menu-chevron`}
        aria-hidden="true"
      />
    </>
  );
  const props = {
    className: `apps-menu-card download-app-card${disabled ? " is-disabled" : ""}`,
    style: { "--app-accent": accent },
  };

  if (disabled) {
    return (
      <div {...props} aria-disabled="true">
        {body}
      </div>
    );
  }
  if (to) {
    return (
      <Link {...props} to={to}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" {...props} onClick={onClick}>
        {body}
      </button>
    );
  }
  return (
    <a {...props} href={href} target="_blank" rel="noreferrer">
      {body}
    </a>
  );
};

/** /download-app ("Connect Download") — Android, iOS and Expo Go install options. */
const DownloadApp = () => {
  const [links, setLinks] = useState({ apkUrl: "", ipaUrl: "", appVersion: "" });
  const [loaded, setLoaded] = useState(false);
  const platform = detectPlatform();

  useEffect(() => {
    let cancelled = false;
    // APK / IPA links are set in the admin panel (Settings → General).
    axios
      .get(`${getServerAddress()}/api/connect`)
      .then((res) => {
        if (!cancelled && res.data) setLinks((prev) => ({ ...prev, ...res.data }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let script = document.getElementById(JSON_LD_ID);
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = JSON_LD_ID;
      script.textContent = JSON.stringify(DOWNLOAD_JSON_LD);
      document.head.appendChild(script);
    }
    return () => script.remove();
  }, []);

  const recommended = (p) => (platform === p ? "For this device" : null);

  return (
    <div className="apps-menu-page">
      <div className="apps-menu-container download-app-container">
        <Link to="/menu" className="download-app-back">
          <i className="fas fa-arrow-left" aria-hidden="true" /> Apps
        </Link>
        <header className="apps-menu-header">
          <p className="download-app-eyebrow">Connect Download</p>
          <h1>Download the Connect App</h1>
          <p>
            Get the free Connect App for Android, iPhone and iPad. Chat, make video calls,
            share moments and get notifications on the go.
            {links.appVersion ? ` Latest version ${links.appVersion}.` : ""}
          </p>
        </header>

        <nav className="download-app-list" aria-label="Download options">
          <DownloadCard
            accent="#3DDC84"
            icon="fab fa-android"
            name="Android"
            badge={recommended("android")}
            desc={
              links.apkUrl
                ? "Download the APK, then open it to install."
                : loaded
                  ? "The Android download is not available yet."
                  : "Download the Connect APK for Android phones and tablets."
            }
            disabled={!links.apkUrl}
            href={links.apkUrl}
          />

          {links.ipaUrl ? (
            <DownloadCard
              accent="#E5E7EB"
              icon="fab fa-apple"
              name="iOS"
              badge={recommended("ios")}
              desc="Download the iPhone and iPad app."
              href={links.ipaUrl}
            />
          ) : (
            <DownloadCard
              accent="#E5E7EB"
              icon="fab fa-apple"
              name="iOS"
              badge={recommended("ios")}
              desc={
                platform === "ios"
                  ? "Install from Safari: allow the profile, then open Settings → Profile Downloaded."
                  : "Open this page in Safari on your iPhone or iPad to install."
              }
              disabled={platform !== "ios"}
              onClick={openIosProfile}
            />
          )}

          <DownloadCard
            accent="#00D4FF"
            icon="fas fa-mobile-alt"
            name="Expo Go"
            desc="Run the latest development build in the Expo Go app."
            to="/expo"
          />
        </nav>

        <p className="download-app-note">
          New to Expo Go? Install it from the{" "}
          <a href={EXPO_GO_IOS} target="_blank" rel="noreferrer">
            App Store
          </a>{" "}
          or{" "}
          <a href={EXPO_GO_ANDROID} target="_blank" rel="noreferrer">
            Google Play
          </a>{" "}
          first.
        </p>

        <section className="download-app-section" aria-labelledby="download-about">
          <h2 id="download-about">Why download the Connect App?</h2>
          <p>
            Connect (Connect BD) is a free social media app made in Bangladesh. The Connect App
            brings your chats, calls and feed together, and works the same on your phone and on
            the web at <Link to="/">connect-bd.online</Link>.
          </p>
          <ul className="download-app-features">
            {FEATURES.map(([icon, name, desc]) => (
              <li key={name}>
                <i className={icon} aria-hidden="true" />
                <span>
                  <strong>{name}.</strong> {desc}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="download-app-section" aria-labelledby="download-steps">
          <h2 id="download-steps">How to install Connect</h2>
          <h3>Connect download for Android</h3>
          <ol>
            <li>Open this page on your Android phone and tap <strong>Android</strong>.</li>
            <li>Open the downloaded Connect APK file.</li>
            <li>If asked, allow installing apps from your browser, then tap <strong>Install</strong>.</li>
          </ol>
          <h3>Connect download for iPhone and iPad</h3>
          <ol>
            <li>Open this page in <strong>Safari</strong> and tap <strong>iOS</strong>.</li>
            <li>Allow the profile download.</li>
            <li>
              Open <strong>Settings → Profile Downloaded</strong> and tap <strong>Install</strong>.
            </li>
          </ol>
        </section>

        <section className="download-app-section" aria-labelledby="download-faq">
          <h2 id="download-faq">Connect App FAQ</h2>
          {DOWNLOAD_FAQ.map(({ q, a }) => (
            <details key={q} className="download-app-faq">
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>

        <p className="download-app-note">
          New to Connect? <Link to="/signup">Create a free account</Link> or{" "}
          <Link to="/about">learn more about the Connect App</Link>.
        </p>
      </div>
    </div>
  );
};

export default DownloadApp;
