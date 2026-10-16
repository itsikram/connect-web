import React from "react";
import {
  getMessageSnippet,
  getProfileDisplayName,
  hasImageAttachment,
  isAudioMessage,
} from "../../utils/messageMedia";

const getImageStatusLabel = (img) => {
  if (img.status === "error") return "Failed";
  if (img.status === "queued") return "Waiting";
  if (img.status === "processing") return "Saving";
  if (img.status === "uploading") return `${img.progress || 0}%`;
  return "";
};

const ComposerImageStrip = ({ images, onRemove, onRetry, onAdd }) => {
  const done = images.filter((img) => img.status === "done").length;
  const failed = images.filter((img) => img.status === "error").length;
  const uploading = images.length - done - failed;
  const overall = Math.round(
    images.reduce((sum, img) => sum + (img.progress || 0), 0) / images.length,
  );

  let title = `${images.length} photo${images.length === 1 ? "" : "s"} ready`;
  if (uploading) title = `Uploading ${done}/${images.length} photos · ${overall}%`;
  else if (failed) title = `${failed} photo${failed === 1 ? "" : "s"} failed · tap to retry`;

  return (
    <div className="composer-images" aria-live="polite">
      <div className="composer-images-head">
        <span className="composer-images-title">{title}</span>
        {uploading ? (
          <span className="composer-images-bar" aria-hidden="true">
            <span style={{ width: `${overall}%` }} />
          </span>
        ) : null}
      </div>
      <div className="composer-images-row">
        {images.map((img) => {
          const busy = img.status !== "done" && img.status !== "error";
          return (
            <div
              key={img.id}
              className={`composer-image-tile is-${img.status}`}
              title={img.error || img.name}
            >
              <img src={img.previewUrl} alt={img.name || "Selected photo"} />
              {img.status !== "done" ? (
                <button
                  type="button"
                  className="composer-image-overlay"
                  onClick={img.status === "error" ? () => onRetry?.(img.id) : undefined}
                  disabled={img.status !== "error"}
                  aria-label={img.status === "error" ? "Retry upload" : "Uploading"}
                >
                  {busy ? (
                    <span
                      className="composer-image-ring"
                      style={{ "--pct": `${img.progress || 0}%` }}
                    />
                  ) : (
                    <i className="fas fa-redo" aria-hidden="true" />
                  )}
                  <span className="composer-image-status">{getImageStatusLabel(img)}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="composer-image-remove"
                onClick={() => onRemove?.(img.id)}
                aria-label="Remove photo"
              >
                <i className="fa fa-times" aria-hidden="true" />
              </button>
            </div>
          );
        })}
        {onAdd ? (
          <button
            type="button"
            className="composer-image-add"
            onClick={onAdd}
            aria-label="Add more photos"
          >
            <i className="fas fa-plus" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
};

const ComposerContextPreview = ({
  replyData,
  userId,
  connectProfile,
  attachmentUrl,
  uploadPlaceholder,
  onCancelReply,
  onRemoveAttachment,
  images = [],
  onRemoveImage,
  onRetryImage,
  onAddImages,
  canAddMoreImages = false,
}) => {
  const hasReply = Boolean(replyData?.messageId);
  const hasAttach = Boolean(attachmentUrl);
  const hasImages = images.length > 0;
  if (!hasReply && !hasAttach && !hasImages) return null;

  const isMine = String(replyData?.senderId) === String(userId);
  const targetName = isMine
    ? "yourself"
    : getProfileDisplayName(connectProfile, "them");
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

      {hasImages && (
        <ComposerImageStrip
          images={images}
          onRemove={onRemoveImage}
          onRetry={onRetryImage}
          onAdd={canAddMoreImages ? onAddImages : null}
        />
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
