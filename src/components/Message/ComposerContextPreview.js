import React from "react";
import {
  getMessageSnippet,
  getProfileDisplayName,
  hasImageAttachment,
  isAudioMessage,
} from "../../utils/messageMedia";

const ComposerContextPreview = ({
  replyData,
  userId,
  friendProfile,
  attachmentUrl,
  uploadPlaceholder,
  onCancelReply,
  onRemoveAttachment,
}) => {
  const hasReply = Boolean(replyData?.messageId);
  const hasAttach = Boolean(attachmentUrl);
  if (!hasReply && !hasAttach) return null;

  const isMine = String(replyData?.senderId) === String(userId);
  const targetName = isMine
    ? "yourself"
    : getProfileDisplayName(friendProfile, "them");
  const snippet = getMessageSnippet(replyData);
  const uploading = Boolean(
    attachmentUrl && uploadPlaceholder && attachmentUrl === uploadPlaceholder,
  );
  const replyIsVoice = isAudioMessage(replyData);
  const replyIsPhoto = hasImageAttachment(replyData);

  return (
    <div className="composer-context">
      {hasReply && (
        <div className="composer-reply-bar" role="status">
          <span className="composer-reply-accent" aria-hidden="true" />
          <span className="composer-reply-icon" aria-hidden="true">
            <i className="fa fa-reply"></i>
          </span>
          <div className="composer-reply-copy">
            <span className="composer-reply-label">
              Replying to {targetName}
            </span>
            <span className="composer-reply-snippet">
              {replyIsVoice && (
                <i className="fa fa-microphone" aria-hidden="true"></i>
              )}
              {replyIsPhoto && !String(replyData?.body || "").trim() && (
                <i className="fa fa-image" aria-hidden="true"></i>
              )}
              {snippet}
            </span>
          </div>
          {replyIsPhoto && (
            <span className="composer-reply-thumb">
              <img src={replyData.attachment} alt="" />
            </span>
          )}
          <button
            type="button"
            className="composer-context-close"
            onClick={onCancelReply}
            aria-label="Cancel reply"
          >
            <i className="fa fa-times"></i>
          </button>
        </div>
      )}

      {hasAttach && (
        <div
          className={`composer-attach-chip${uploading ? " is-uploading" : ""}`}
        >
          {uploading ? (
            <div className="composer-attach-preview" aria-hidden="true">
              <div className="msg-media-skeleton is-compact">
                <span className="msg-media-skeleton-shimmer" />
              </div>
            </div>
          ) : (
            <div className="composer-attach-preview">
              <img
                className="composer-attach-thumb"
                src={attachmentUrl}
                alt="Attachment preview"
              />
            </div>
          )}
          <div className="composer-attach-meta">
            <span className="composer-attach-title">
              {uploading ? "Uploading photo" : "Photo attached"}
            </span>
            <span className="composer-attach-hint">
              {uploading ? "Almost ready…" : "Will send with your message"}
            </span>
          </div>
          {!uploading && (
            <button
              type="button"
              className="composer-context-close"
              onClick={onRemoveAttachment}
              aria-label="Remove attachment"
            >
              <i className="fa fa-times"></i>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ComposerContextPreview;
