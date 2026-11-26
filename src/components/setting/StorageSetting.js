import React, { useCallback, useEffect, useState } from "react";
import api from "../../api/api";

export default function StorageSetting() {
  const [storage, setStorage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const { data } = await api.get("/personal-drive");
    setStorage(data);
  }, []);

  useEffect(() => {
    const load = () => refresh().catch(() => setMessage("Could not load storage settings."));
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [refresh]);

  const run = async (action = refresh) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      if (action !== refresh) await refresh();
    } catch (error) {
      setMessage(error?.response?.data?.error || "Could not update storage settings.");
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setMessage("Allow pop-ups to connect Google Drive.");
      return;
    }
    popup.opener = null;
    await run(async () => {
      try {
        const { data } = await api.post("/personal-drive/connect");
        popup.location.replace(data.authorizationUrl);
        setMessage("Finish in the Google tab, then return and refresh.");
      } catch (error) {
        popup.close();
        throw error;
      }
    });
  };

  return (
    <section className="setting-field-container profile-setting">
      <h3>Google Drive</h3>
      <p className="setting-section-desc">Use your Google Drive for new chat photos, files, and voice notes. Through Connect, only you and the chat recipient can open them.</p>
      <p>Disconnecting turns off access to your Drive attachments in Connect. Your files stay in Drive.</p>
      {!storage && !message && <p>Loading storage settings…</p>}
      {storage?.connected ? (
        <>
          <p>{storage.email}</p>
          <label>
            <input
              type="checkbox"
              checked={storage.enabled}
              disabled={busy || (!storage.available && !storage.enabled)}
              onChange={(event) => {
                const enabled = event.target.checked;
                run(() => api.put("/personal-drive", { enabled }));
              }}
            />
            {" "}Use Google Drive for new chat uploads
          </label>
          <div>
            <button type="button" disabled={busy} onClick={() => {
              if (window.confirm("Disconnect Google Drive and turn off access to existing Drive attachments in Connect?")) {
                run(() => api.delete("/personal-drive"));
              }
            }}>
              Disconnect
            </button>
          </div>
        </>
      ) : storage?.available ? (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={connect}>Connect Google Drive</button>
      ) : storage ? (
        <p>Google Drive is unavailable on this server.</p>
      ) : null}
      <button type="button" className="btn btn-secondary ms-2" disabled={busy} onClick={() => run()}>Refresh</button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
