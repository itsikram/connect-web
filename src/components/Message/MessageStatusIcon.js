import React, { memo } from "react";
import { MdDone, MdDoneAll, MdVisibility, MdWifiOff } from "react-icons/md";
import { MESSAGE_STATUS_LABELS } from "../../utils/messageStatus";
import "./MessageStatusIcon.css";

const ICONS = {
  pending: MdWifiOff,
  sent: MdDone,
  delivered: MdDoneAll,
  seen: MdVisibility,
};

/**
 * Status of one of my messages: no internet (not sent), one check (sent),
 * two checks (delivered: the receiver opened the app), eye (seen).
 * Sized and colored by CSS (`.message-status-icon.<status>`).
 */
const MessageStatusIcon = ({ status, className = "", title }) => {
  const Icon = ICONS[status] || MdDone;
  const label = title || MESSAGE_STATUS_LABELS[status] || "";
  return (
    <span
      className={`message-status-icon ${status} ${className}`.trim()}
      title={label}
      aria-label={label}
      role="img"
      data-status={status}
    >
      <Icon aria-hidden="true" focusable="false" />
    </span>
  );
};

export default memo(MessageStatusIcon);
