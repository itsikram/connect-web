import React, { useCallback, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import api from "../../api/api";
import { showSuccessToast, showErrorToast } from "../../utils/toastUtils";

const AccountSetting = () => {
  const myProfile = useSelector((state) => state.profile);
  const [data, setData] = useState({
    userEmail: myProfile?.user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [banglaName, setBanglaName] = useState(myProfile?.banglaName || "");
  const [isListening, setIsListening] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingBangla, setIsSavingBangla] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [voiceConfidence, setVoiceConfidence] = useState(null);
  const [showVoiceConfirmation, setShowVoiceConfirmation] = useState(false);
  const [pendingVoiceTranscript, setPendingVoiceTranscript] = useState("");

  // Update benglaName when profile changes
  useEffect(() => {
    setBanglaName(myProfile?.banglaName || "");
  }, [myProfile?.banglaName]);

  const handleInputChange = useCallback((e) => {
    const { id, value } = e.target;
    setData((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleBanglaNameChange = useCallback((e) => {
    setBanglaName(e.target.value);
  }, []);

  // Voice Recognition for Bengali name with confidence checking
  const startVoiceRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showErrorToast("Voice recognition is not supported in your browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "bn-BD"; // Bengali (Bangladesh)
    recognition.interimResults = false;
    recognition.maxAlternatives = 3; // Get multiple alternatives to check confidence
    recognition.continuous = false;
    recognition.autoRestart = false;

    setIsListening(true);
    setVoiceConfidence(null);
    setShowVoiceConfirmation(false);
    setPendingVoiceTranscript("");

    recognition.onstart = () => {
      console.log("[Voice Recognition] Started");
    };

    recognition.onresult = (event) => {
      // Get the best result with confidence score
      if (event.results.length > 0) {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult && lastResult.length > 0) {
          const transcript = lastResult[0].transcript || "";
          const confidence = lastResult[0].confidence || 0;

          console.log("[Voice Recognition] Result:", {
            transcript,
            confidence,
            isFinal: lastResult.isFinal,
          });

          // Only accept transcripts with confidence > 0.5
          // For critical data like names, require higher confidence
          const MIN_CONFIDENCE_THRESHOLD = 0.6;

          if (confidence < MIN_CONFIDENCE_THRESHOLD) {
            // Low confidence: show warning and ask for confirmation
            setPendingVoiceTranscript(transcript);
            setVoiceConfidence(confidence);
            setShowVoiceConfirmation(true);
            showErrorToast(
              `Low confidence (${(confidence * 100).toFixed(0)}%). Verify below before saving.`,
            );
            return;
          }

          // High confidence: set directly
          setBanglaName(transcript);
          setVoiceConfidence(confidence);
          setPendingVoiceTranscript("");
          setShowVoiceConfirmation(false);
          showSuccessToast(
            `Recognized: "${transcript}" (${(confidence * 100).toFixed(0)}% confident)`,
          );
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("[Voice Recognition] Error:", event.error);
      setIsListening(false);
      setShowVoiceConfirmation(false);

      const errorMessages = {
        "no-speech": "No speech detected. Please speak clearly and try again.",
        "audio-capture": "No microphone found. Check your browser permissions.",
        network: "Network error. Check your connection.",
        aborted: "Voice recognition was cancelled.",
      };

      const errorMsg =
        errorMessages[event.error] || `Voice error: ${event.error}`;
      showErrorToast(errorMsg);
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log("[Voice Recognition] Ended");
    };

    recognition.start();
  }, []);

  // Approve low-confidence transcription
  const approveVoiceTranscript = useCallback(() => {
    if (pendingVoiceTranscript.trim()) {
      setBanglaName(pendingVoiceTranscript);
      setPendingVoiceTranscript("");
      setShowVoiceConfirmation(false);
      showSuccessToast(`Bengali name set to: "${pendingVoiceTranscript}"`);
    }
  }, [pendingVoiceTranscript]);

  // Reject and retry
  const rejectVoiceTranscript = useCallback(() => {
    setPendingVoiceTranscript("");
    setShowVoiceConfirmation(false);
    setVoiceConfidence(null);
    showErrorToast("Discarded. Click microphone again to retry.");
  }, []);

  const handleSaveBanglaName = useCallback(
    async (e) => {
      e.preventDefault();

      // Validate Bengali name
      const trimmedName = banglaName.trim();
      if (!trimmedName) {
        showErrorToast("Bengali name cannot be empty");
        return;
      }

      // Check for common low-confidence transcription garbage
      // Examples: nonsensical long phrases, repeated characters, obvious misrecognitions
      const suspiciousPatterns = [
        /^[\u0980-\u09FF]{50,}$/, // Very long single block with no spaces
        /(.)\1{5,}/, // Character repeated 6+ times
        /[,.!?\-]{5,}/, // Excessive punctuation
      ];

      const isSuspicious = suspiciousPatterns.some((pattern) =>
        pattern.test(trimmedName),
      );

      if (isSuspicious && voiceConfidence !== null && voiceConfidence < 0.7) {
        const shouldContinue = window.confirm(
          `This name looks unusual (confidence: ${(voiceConfidence * 100).toFixed(0)}%). Are you sure you want to save it?\n\nName: "${trimmedName}"`,
        );
        if (!shouldContinue) return;
      }

      setIsSavingBangla(true);
      try {
        const res = await api.post("/profile/update/bangla-name", {
          banglaName: trimmedName,
        });

        if (res.status === 200) {
          showSuccessToast("Bengali name updated successfully");
          setVoiceConfidence(null);
        }
      } catch (error) {
        console.error("Error updating Bengali name:", error);
        showErrorToast(
          error?.response?.data?.message || "Failed to update Bengali name",
        );
      } finally {
        setIsSavingBangla(false);
      }
    },
    [banglaName, voiceConfidence],
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      // Prevent form submission while confirming voice input
      if (showVoiceConfirmation) {
        showErrorToast("Please approve or reject the voice input first.");
        return;
      }

      setIsSaving(true);

      try {
        if (data.userEmail && data.userEmail !== myProfile?.user?.email) {
          const emailChangeRes = await api.post("auth/changeEmail", {
            email: data.userEmail,
          });

          if (emailChangeRes.status === 200) {
            localStorage.setItem("user", JSON.stringify(emailChangeRes.data));
            showSuccessToast("Email updated successfully");
            window.location.reload();
            return;
          }
        }

        if (
          !data.newPassword &&
          !data.confirmPassword &&
          !data.currentPassword
        ) {
          return;
        }

        if (
          !data.currentPassword ||
          !data.newPassword ||
          !data.confirmPassword
        ) {
          showErrorToast("Please fill in all password fields");
          return;
        }

        if (data.newPassword.length < 6) {
          showErrorToast("New password must be at least 6 characters");
          return;
        }

        if (data.newPassword !== data.confirmPassword) {
          showErrorToast("Your new password and confirm password do not match");
          return;
        }

        const res = await api.post("auth/changePass", data);

        if (res.status === 400) {
          showErrorToast("Your current password is invalid");
          return;
        }

        if (res.status === 200 || res.status === 202) {
          localStorage.setItem("user", JSON.stringify(res.data));
          showSuccessToast("Password updated successfully");
          setData((prev) => ({
            ...prev,
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          }));
        }
      } catch (error) {
        console.error("Account settings error:", error);
        showErrorToast(
          error?.response?.data?.message || "Failed to update account settings",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [data, myProfile?.user?.email, showVoiceConfirmation],
  );

  const deleteAccount = useCallback(async (e) => {
    e.preventDefault();
    const confirmed = window.confirm(
      "Delete your account permanently? This cannot be undone.",
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const deletedAccountRes = await api.post("auth/delete");
      if (deletedAccountRes.status === 200) {
        localStorage.removeItem("user");
        showSuccessToast(deletedAccountRes.data.message || "Account deleted");
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Delete account error:", error);
      showErrorToast(
        error?.response?.data?.message || "Failed to delete account",
      );
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const handleEditEmailClick = useCallback((e) => {
    e.preventDefault();
    setEditEmail((prev) => !prev);
  }, []);

  return (
    <div className="profile-setting">
      <div className="setting-field-container">
        <h3>Account Settings</h3>
        <p className="setting-section-desc">
          Manage your email, password, and Bengali name.
        </p>

        {/* Bengali Name Section */}
        <div
          style={{
            marginBottom: "30px",
            paddingBottom: "20px",
            borderBottom: "1px solid #e0e0e0",
          }}
        >
          <h3 className="fs-4">Bengali Name (বাংলা নাম)</h3>
          <p className="text-muted small">
            Add your name in Bengali script to make it easier for Bengali
            speakers to find you.
          </p>

          <div className="form-group mb-3">
            <label htmlFor="banglaName" className="form-label">
              Bengali Name
            </label>
            <div className="input-group">
              <input
                type="text"
                className="form-control"
                id="banglaName"
                value={banglaName}
                onChange={handleBanglaNameChange}
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
                disabled={
                  isListening || isSavingBangla || showVoiceConfirmation
                }
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
                {isListening
                  ? " Listening..."
                  : showVoiceConfirmation
                    ? " Verify"
                    : " Voice"}
              </button>
            </div>

            {/* Voice Confidence Feedback */}
            {voiceConfidence !== null && (
              <div className="mt-2 mb-2">
                <small className="text-muted d-block">
                  Confidence:{" "}
                  <strong>{(voiceConfidence * 100).toFixed(0)}%</strong>
                  <div
                    className="progress mt-1"
                    style={{ height: "6px", backgroundColor: "#e9ecef" }}
                  >
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

            {/* Voice Confirmation Dialog */}
            {showVoiceConfirmation && pendingVoiceTranscript && (
              <div
                className="alert alert-warning mt-3 mb-3"
                style={{ borderRadius: "6px" }}
              >
                <div className="mb-2">
                  <strong>Please verify the recognized text:</strong>
                </div>
                <div
                  className="card mb-3"
                  style={{
                    backgroundColor: "#fff3cd",
                    border: "1px solid #ffc107",
                    padding: "12px",
                    borderRadius: "4px",
                  }}
                >
                  <p
                    className="mb-0"
                    style={{
                      fontSize: "16px",
                      fontWeight: "500",
                      direction: "auto",
                    }}
                  >
                    "{pendingVoiceTranscript}"
                  </p>
                  <small className="text-muted">
                    Confidence: {(voiceConfidence * 100).toFixed(0)}%
                  </small>
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={approveVoiceTranscript}
                  >
                    <i className="fas fa-check me-1"></i>Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={rejectVoiceTranscript}
                  >
                    <i className="fas fa-times me-1"></i>Reject & Retry
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowVoiceConfirmation(false)}
                  >
                    <i className="fas fa-edit me-1"></i>Edit Manually
                  </button>
                </div>
              </div>
            )}

            <small className="text-muted d-block mt-2">
              {isListening && (
                <span className="text-danger">
                  <i
                    className="fas fa-circle"
                    style={{ animation: "pulse 1s infinite" }}
                  ></i>{" "}
                  Microphone is active - speak your Bengali name clearly
                </span>
              )}
              {!isListening && banglaName && !showVoiceConfirmation && (
                <span className="text-success">
                  <i className="fas fa-check me-1"></i>✓ {banglaName}
                </span>
              )}
              {!isListening && !banglaName && !showVoiceConfirmation && (
                <span>
                  Type your name in Bengali or click the microphone icon to use
                  voice input. Speak clearly for best results.
                </span>
              )}
            </small>
          </div>

          <style>
            {`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}
          </style>

          <div className="d-flex gap-2">
            <button
              type="button"
              onClick={handleSaveBanglaName}
              className="btn btn-primary"
              disabled={
                isSavingBangla || !banglaName.trim() || showVoiceConfirmation
              }
            >
              <i className="fas fa-save me-2"></i>
              {isSavingBangla ? "Saving Bengali Name…" : "Save Bengali Name"}
            </button>
            {banglaName && (
              <button
                type="button"
                onClick={() => {
                  setBanglaName("");
                  setVoiceConfidence(null);
                  setPendingVoiceTranscript("");
                  setShowVoiceConfirmation(false);
                }}
                className="btn btn-outline-secondary"
                disabled={isSavingBangla}
                title="Clear the Bengali name field"
              >
                <i className="fas fa-trash me-2"></i>Clear
              </button>
            )}
          </div>
        </div>

        {/* Password and Email Section */}
        <form onSubmit={handleSubmit}>
          <h3 className="fs-4">Change Password & Email</h3>
          <div className="form-group mb-2">
            <label htmlFor="userEmail">Email</label>
            <div className="input-group">
              <input
                onChange={handleInputChange}
                type="email"
                className="form-control"
                id="userEmail"
                disabled={!editEmail}
                value={
                  editEmail ? data.userEmail : myProfile?.user?.email || ""
                }
                placeholder="Email"
              />
              <div className="input-group-append">
                <button
                  type="button"
                  onClick={handleEditEmailClick}
                  className="btn btn-danger"
                >
                  <i className="fas fa-pen" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          <div className="form-group mb-2">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              onChange={handleInputChange}
              type="password"
              className="form-control"
              id="currentPassword"
              value={data.currentPassword}
              placeholder="Current Password"
            />
          </div>
          <div className="form-group mb-2">
            <label htmlFor="newPassword">New Password</label>
            <input
              onChange={handleInputChange}
              type="password"
              className="form-control"
              id="newPassword"
              value={data.newPassword}
              placeholder="New Password"
            />
          </div>
          <div className="form-group mb-2">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              onChange={handleInputChange}
              type="password"
              className="form-control"
              id="confirmPassword"
              value={data.confirmPassword}
              placeholder="Confirm Password"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Settings"}
          </button>
          <br />

          <button
            type="button"
            onClick={deleteAccount}
            className="btn btn-danger mt-3"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete My Account"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AccountSetting;
