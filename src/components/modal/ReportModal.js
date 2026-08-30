import React, { useEffect, useState } from "react";
import ModalContainer from "./ModalContainer";
import api from "../../api/api";
import { REPORT_REASONS } from "../../utils/reportReasons";
import { showErrorToast, showSuccessToast } from "../../utils/toastUtils";
import "./ReportModal.css";

const ReportModal = ({
  isOpen,
  onRequestClose,
  type = "post",
  targetId,
  targetLabel,
}) => {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isProfile = type === "profile";
  const noun = isProfile ? "profile" : "post";
  const heading = isProfile ? "Report profile" : "Report post";
  const subject = targetLabel || (isProfile ? "this profile" : "this post");

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setDetails("");
      setSubmitting(false);
    }
  }, [isOpen, targetId, type]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!targetId || submitting) return;
    if (!reason) {
      showErrorToast("Please choose a reason", { title: "Report" });
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isProfile ? "/report/profile" : "/report/post";
      const payload = isProfile
        ? { profileId: targetId, reason, details }
        : { postId: targetId, reason, details };
      const res = await api.post(endpoint, payload);
      showSuccessToast(
        res.data?.message || `Thanks. We received your report on ${subject}.`,
        { title: "Report submitted" },
      );
      onRequestClose?.();
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        `Could not report this ${noun}. Please try again.`;
      showErrorToast(message, { title: "Report" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalContainer
      title={heading}
      size="sm"
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      id="report-modal"
    >
      <form className="report-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3 className="modal-title">{heading}</h3>
          <button
            type="button"
            onClick={onRequestClose}
            className="modal-close-btn"
            aria-label="Close"
          >
            <i className="far fa-times"></i>
          </button>
        </div>
        <div className="modal-body">
          <p className="report-modal-intro">
            Why are you reporting {subject}? Your report is private and helps
            keep Connect safe.
          </p>
          <div className="report-reason-list" role="listbox" aria-label="Report reasons">
            {REPORT_REASONS.map((option) => (
              <button
                type="button"
                key={option}
                className={`report-reason-option${reason === option ? " selected" : ""}`}
                onClick={() => setReason(option)}
                aria-pressed={reason === option}
              >
                <span>{option}</span>
                {reason === option ? <i className="far fa-check-circle"></i> : null}
              </button>
            ))}
          </div>
          <label className="report-details-label" htmlFor="report-details">
            Additional details (optional)
          </label>
          <textarea
            id="report-details"
            className="form-control report-details-input"
            rows={3}
            maxLength={500}
            placeholder="Add anything that will help us review this report"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <div className="report-details-count">{details.length}/500</div>
        </div>
        <div className="report-modal-actions">
          <button
            type="button"
            className="report-btn report-btn-ghost"
            onClick={onRequestClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="report-btn report-btn-primary"
            disabled={submitting || !reason}
          >
            {submitting ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </form>
    </ModalContainer>
  );
};

export default ReportModal;
