import React, { useCallback, useEffect, useState } from "react";
import api from "../../api/api";
import { showErrorToast, showSuccessToast } from "../../utils/toastUtils";

const BanglaNameField = ({ value, onChange }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [voiceConfidence, setVoiceConfidence] = useState(null);
  const [showVoiceConfirmation, setShowVoiceConfirmation] = useState(false);
  const [pendingVoiceTranscript, setPendingVoiceTranscript] = useState("");

  useEffect(() => {
    setVoiceConfidence(null);
    setPendingVoiceTranscript("");
    setShowVoiceConfirmation(false);
  }, [value]);

  const setName = useCallback(
    (name) => {
      onChange(name);
    },
    [onChange],
  );

  const startVoiceRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showErrorToast("Voice recognition is not supported in your browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "bn-BD";
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.continuous = false;
    recognition.autoRestart = false;

    setIsListening(true);
    setVoiceConfidence(null);
    setShowVoiceConfirmation(false);
    setPendingVoiceTranscript("");

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      if (!lastResult || !lastResult.length) return;

      const transcript = lastResult[0].transcript || "";
      const confidence = lastResult[0].confidence || 0;
      if (confidence < 0.6) {
        setPendingVoiceTranscript(transcript);
        setVoiceConfidence(confidence);
        setShowVoiceConfirmation(true);
        showErrorToast(
          `Low confidence (${(confidence * 100).toFixed(0)}%). Verify below before saving.`,
        );
        return;
      }

      setName(transcript);
      setVoiceConfidence(confidence);
      setPendingVoiceTranscript("");
      setShowVoiceConfirmation(false);
      showSuccessToast(
        `Recognized: "${transcript}" (${(confidence * 100).toFixed(0)}% confident)`,
      );
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setShowVoiceConfirmation(false);
      const errorMessages = {
        "no-speech": "No speech detected. Please speak clearly and try again.",
        "audio-capture": "No microphone found. Check your browser permissions.",
        network: "Network error. Check your connection.",
        aborted: "Voice recognition was cancelled.",
      };
      showErrorToast(
        errorMessages[event.error] || `Voice error: ${event.error}`,
      );
    };

    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [setName]);

  const approveVoiceTranscript = useCallback(() => {
    if (!pendingVoiceTranscript.trim()) return;
    setName(pendingVoiceTranscript);
    setPendingVoiceTranscript("");
    setShowVoiceConfirmation(false);
    showSuccessToast(`Bengali name set to: "${pendingVoiceTranscript}"`);
  }, [pendingVoiceTranscript, setName]);

  const rejectVoiceTranscript = useCallback(() => {
    setPendingVoiceTranscript("");
    setShowVoiceConfirmation(false);
    setVoiceConfidence(null);
    showErrorToast("Discarded. Click microphone again to retry.");
  }, []);

  const handleSave = useCallback(
    async (event) => {
      event.preventDefault();
      const trimmedName = String(value || "").trim();
      if (!trimmedName) {
        showErrorToast("Bengali name cannot be empty");
        return;
      }

      setIsSaving(true);
      try {
        const response = await api.post("/profile/update/bangla-name", {
          banglaName: trimmedName,
        });
        if (response.status === 200) {
          setName(trimmedName);
          setVoiceConfidence(null);
          showSuccessToast("Bengali name updated successfully");
        }
      } catch (error) {
        console.error("Error updating Bengali name:", error);
        showErrorToast(
          error?.response?.data?.message || "Failed to update Bengali name",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [setName, value],
  );

  const clearName = useCallback(() => {
    setName("");
    setVoiceConfidence(null);
    setPendingVoiceTranscript("");
    setShowVoiceConfirmation(false);
  }, [setName]);

  return (
    <div
      style={{
        marginBottom: "30px",
        paddingBottom: "20px",
        borderBottom: "1px solid #e0e0e0",
      }}
    >
      <h3 className="fs-4">Bengali Name (বাংলা নাম)</h3>
      <p className="text-muted small">
        Add your name in Bengali script to make it easier for Bengali speakers
        to find you.
      </p>

      <div className="form-group mb-3">
        <label htmlFor="banglaName" className="form-label">
          Bengali Name
        </label>
        <div className="input-group bengali-name-input-group">
          <input
            type="text"
            className="form-control"
            id="banglaName"
            value={value || ""}
            onChange={(event) => setName(event.target.value)}
            placeholder="আপনার বাংলা নাম লিখুন"
            dir="auto"
          />
          <button
            type="button"
            onClick={startVoiceRecognition}
            className={`btn ${
              isListening
                ? "btn-danger"
                : showVoiceConfirmation
                  ? "btn-warning"
                  : "btn-outline-secondary"
            }`}
            disabled={isListening || isSaving || showVoiceConfirmation}
            title="Use voice to set Bengali name (requires clear speech)"
          >
            <i
              className={`fas ${
                isListening
                  ? "fa-microphone-alt-slash"
                  : showVoiceConfirmation
                    ? "fa-question-circle"
                    : "fa-microphone"
              }`}
            />
            {isListening ? " Listening..." : showVoiceConfirmation ? " Verify" : " Voice"}
          </button>
        </div>

        {voiceConfidence !== null && (
          <div className="mt-2 mb-2">
            <small className="text-muted d-block">
              Confidence: <strong>{(voiceConfidence * 100).toFixed(0)}%</strong>
              <div className="progress mt-1" style={{ height: "6px", backgroundColor: "#e9ecef" }}>
                <div
                  className="progress-bar bg-info"
                  role="progressbar"
                  style={{ width: `${voiceConfidence * 100}%` }}
                  aria-valuenow={voiceConfidence * 100}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
            </small>
          </div>
        )}

        {showVoiceConfirmation && pendingVoiceTranscript && (
          <div className="alert alert-warning mt-3 mb-3" style={{ borderRadius: "6px" }}>
            <div className="mb-2"><strong>Please verify the recognized text:</strong></div>
            <div className="card mb-3" style={{ backgroundColor: "#fff3cd", border: "1px solid #ffc107", padding: "12px", borderRadius: "4px" }}>
              <p className="mb-0" style={{ fontSize: "16px", fontWeight: "500", direction: "auto" }}>
                "{pendingVoiceTranscript}"
              </p>
              <small className="text-muted">
                Confidence: {(voiceConfidence * 100).toFixed(0)}%
              </small>
            </div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-success" onClick={approveVoiceTranscript}>
                <i className="fas fa-check me-1"></i>Approve
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={rejectVoiceTranscript}>
                <i className="fas fa-times me-1"></i>Reject & Retry
              </button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowVoiceConfirmation(false)}>
                <i className="fas fa-edit me-1"></i>Edit Manually
              </button>
            </div>
          </div>
        )}

        <small className="text-muted d-block mt-2">
          {isListening && <span className="text-danger">Microphone is active - speak your Bengali name clearly</span>}
          {!isListening && value && !showVoiceConfirmation && <span className="text-success"><i className="fas fa-check me-1"></i>✓ {value}</span>}
          {!isListening && !value && !showVoiceConfirmation && <span>Type your name in Bengali or click the microphone icon to use voice input. Speak clearly for best results.</span>}
        </small>
      </div>

      <div className="d-flex gap-2">
        <button type="button" onClick={handleSave} className="btn btn-primary" disabled={isSaving || !String(value || "").trim() || showVoiceConfirmation}>
          <i className="fas fa-save me-2"></i>
          {isSaving ? "Saving Bengali Name…" : "Save Bengali Name"}
        </button>
        {value && (
          <button type="button" onClick={clearName} className="btn btn-outline-secondary" disabled={isSaving} title="Clear the Bengali name field">
            <i className="fas fa-trash me-2"></i>Clear
          </button>
        )}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
};

export default BanglaNameField;
