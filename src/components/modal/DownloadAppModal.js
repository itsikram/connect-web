import React, { useEffect, useState } from "react";
import ModalContainer from "./ModalContainer";
import axios from "axios";

const IOS_PROFILE_URL = `${process.env.PUBLIC_URL || ""}/connect.mobileconfig`;

const StoreButton = ({
  href,
  label,
  icon,
  subtitle = "Get it on",
  download,
  primary = false,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    download={download || undefined}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      width: "100%",
      background: primary
        ? "linear-gradient(135deg, #29b1a9 0%, #1a8f88 100%)"
        : "linear-gradient(135deg, #111, #1b1b1b)",
      color: "#fff",
      padding: "14px 16px",
      borderRadius: "12px",
      border: primary
        ? "1px solid rgba(255,255,255,0.18)"
        : "1px solid rgba(255,255,255,0.08)",
      textDecoration: "none",
      boxShadow: primary
        ? "0 8px 24px rgba(41,177,169,0.35)"
        : "0 8px 24px rgba(0,0,0,0.35)",
      boxSizing: "border-box",
    }}
  >
    <span className={icon} style={{ fontSize: 22, width: 24, textAlign: "center" }} />
    <div style={{ lineHeight: 1.2, textAlign: "left" }}>
      <div style={{ fontSize: 11, opacity: 0.85 }}>{subtitle}</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
    </div>
  </a>
);

const DownloadAppModal = ({ isOpen, onClose }) => {
  const [connectData, setConnectData] = useState({
    apkUrl: "",
    ipaUrl: "",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(
          process.env.REACT_APP_SERVER_ADDR + "/api/connect"
        );
        if (res.status === 200) {
          setConnectData((prev) => ({
            ...prev,
            ...res.data,
          }));
        }
      } catch (_) {
        // Keep local iOS profile button even if API fails
      }
    };
    if (isOpen) fetchSettings();
  }, [isOpen]);

  return (
    <ModalContainer
      isOpen={isOpen}
      onRequestClose={onClose}
      style={{
        borderRadius: "16px",
        padding: 0,
        maxHeight: "90vh",
        overflow: "auto",
      }}
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

        <div style={{ padding: 20, display: "grid", gap: 12 }}>
          <p style={{ margin: 0, color: "#b8c1cc" }}>
            Enjoy a faster, more native experience. Enable notifications,
            seamless calling, and offline access.
          </p>

          {/* Always-visible iOS install */}
          <StoreButton
            href={IOS_PROFILE_URL}
            label="Download iOS App"
            subtitle="iPhone / iPad"
            icon="fab fa-apple"
            download="connect.mobileconfig"
            primary
          />

          {connectData?.apkUrl ? (
            <StoreButton
              href={connectData.apkUrl}
              label="Google Play"
              subtitle="Get it on"
              icon="fab fa-google-play"
            />
          ) : null}

          {connectData?.ipaUrl ? (
            <StoreButton
              href={connectData.ipaUrl}
              label="App Store"
              subtitle="Get it on"
              icon="fab fa-apple"
            />
          ) : null}

          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "#7c8a97",
              lineHeight: 1.45,
            }}
          >
            After downloading the iOS profile, open{" "}
            <b style={{ color: "#b8c1cc" }}>
              Settings → Profile Downloaded → Install
            </b>
            .
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              marginTop: 6,
            }}
          >
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
