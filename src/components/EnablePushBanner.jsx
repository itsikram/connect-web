import React, { useEffect, useState } from "react";
import webNotificationService from "../services/webNotificationService";
import "./EnablePushBanner.css";

const DISMISS_KEY = "connect_push_banner_dismissed";

/**
 * iOS Home Screen / PWA: permission + PushManager.subscribe must happen
 * from a user gesture. Show this banner until background push is enabled.
 */
const EnablePushBanner = ({ profileId, api }) => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "true") return;
    } catch (_) {}

    const status = webNotificationService.getStatus();
    // Show when push is possible but not yet granted/subscribed
    const shouldShow =
      status.isPushSupported &&
      status.canUseBackgroundPush &&
      status.permission !== "granted";

    // Also show on iOS Safari in standalone if permission default/denied
    if (shouldShow || (status.isIos && status.isStandalone && status.permission !== "granted")) {
      setVisible(true);
    }
  }, [profileId]);

  if (!visible || !profileId) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch (_) {}
    setVisible(false);
  };

  const enable = async () => {
    setBusy(true);
    setError("");
    try {
      await webNotificationService.enableBackgroundNotifications(profileId, api);
      try {
        localStorage.setItem(DISMISS_KEY, "true");
      } catch (_) {}
      setVisible(false);
      try {
        await webNotificationService.sendTestNotification(
          "Notifications on",
          "You’ll get alerts even when Connect is in the background."
        );
      } catch (_) {}
    } catch (err) {
      setError(err?.message || "Could not enable notifications");
    } finally {
      setBusy(false);
    }
  };

  const status = webNotificationService.getStatus();

  return (
    <div className="enable-push-banner" role="dialog" aria-label="Enable notifications">
      <button type="button" className="enable-push-close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
      <div className="enable-push-copy">
        <strong>Stay updated</strong>
        <span>
          {status.isIos
            ? "Enable notifications so messages and alerts arrive when the app is closed."
            : "Enable background notifications for messages and alerts."}
        </span>
        {error ? <em className="enable-push-error">{error}</em> : null}
      </div>
      <button
        type="button"
        className="enable-push-btn"
        onClick={enable}
        disabled={busy}
      >
        {busy ? "Enabling…" : "Enable"}
      </button>
    </div>
  );
};

export default EnablePushBanner;
