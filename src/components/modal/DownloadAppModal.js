import React, { useEffect, useState } from "react";
import ModalContainer from "./ModalContainer";
import axios from "axios";

const IOS_PROFILE_URL = `${process.env.PUBLIC_URL || ""}/connect.mobileconfig`;

const StoreButton = ({ href, label, icon, subtitle = "Get it on", download }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    download={download || undefined}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      background: "linear-gradient(135deg, #111, #1b1b1b)",
      color: "#fff",
      padding: "12px 16px",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.08)",
      textDecoration: "none",
      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    }}
  >
    <span className={icon} style={{ fontSize: 20 }} />
    <div style={{ lineHeight: 1 }}>
      <div style={{ fontSize: 11, opacity: 0.8 }}>{subtitle}</div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
    </div>
  </a>
);

const DownloadAppModal = ({ isOpen, onClose }) => {
  const [connectData, setConnectData] = useState({
    apkUrl: "",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      let res = await axios.get(
        process.env.REACT_APP_SERVER_ADDR + "/api/connect"
      );
      if (res.status === 200) {
        setConnectData((prev) => ({
          ...prev,
          ...res.data,
        }));
      }
    };
    fetchSettings();
  }, []);

  return (
    <ModalContainer
      isOpen={isOpen}
      onRequestClose={onClose}
      style={{ borderRadius: "16px", padding: 0 }}
    >
      <div
        style={{
          background: "linear-gradient(180deg, #141518 0%, #0f1114 100%)",
          color: "#eaecef",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <span className="fas fa-mobile-alt" style={{ color: "#fff" }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Get our mobile app</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "#9aa4af",
              cursor: "pointer",
              fontSize: 18,
              padding: 6,
              borderRadius: 8,
            }}
          >
            <span className="fas fa-times" />
          </button>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 16 }}>
          <p style={{ margin: 0, color: "#b8c1cc" }}>
            Enjoy a faster, more native experience. Enable notifications,
            seamless calling, and offline access.
          </p>

          <div
            style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}
          >
            {connectData?.apkUrl && (
              <StoreButton
                href={connectData?.apkUrl || ""}
                label="Google Play"
                icon="fab fa-google-play"
              />
            )}
            {connectData?.ipaUrl && (
              <StoreButton
                href={connectData?.ipaUrl || ""}
                label="App Store"
                icon="fab fa-apple"
              />
            )}
            <StoreButton
              href={IOS_PROFILE_URL}
              label="iOS Profile"
              subtitle="Install via Settings"
              icon="fab fa-apple"
              download="connect.mobileconfig"
            />
          </div>

          <p style={{ margin: 0, fontSize: 12, color: "#7c8a97", lineHeight: 1.45 }}>
            <b style={{ color: "#b8c1cc" }}>iPhone / iPad:</b> Tap{" "}
            <b style={{ color: "#b8c1cc" }}>iOS Profile</b>, then open{" "}
            <b style={{ color: "#b8c1cc" }}>Settings → Profile Downloaded → Install</b>.
            Allow the unsigned profile warning — this only adds Connect to your Home Screen.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 6,
            }}
          >
            <small style={{ color: "#7c8a97" }}>
              You can find the link anytime in the footer.
            </small>
            <button
              onClick={onClose}
              style={{
                background: "#2563eb",
                border: "none",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: 10,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 6px 18px rgba(37,99,235,0.35)",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </ModalContainer>
  );
};

export default DownloadAppModal;
