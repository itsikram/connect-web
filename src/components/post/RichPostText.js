import React from "react";
import { Link } from "react-router-dom";

const tokenPattern = /(@\[([^\]]+)\]\(([a-f\d]{24})\)|(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{1,50}))/giu;

const RichPostText = ({ children }) => {
  const value = String(children || "");
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = tokenPattern.exec(value))) {
    if (match.index > lastIndex) parts.push(value.slice(lastIndex, match.index));
    if (match[2] && match[3]) {
      parts.push(
        <Link key={`mention-${match.index}`} className="post-tag post-profile-tag" to={`/${match[3]}`}>
          @{match[2].trim()}
        </Link>,
      );
    } else {
      const prefix = match[4] || "";
      if (prefix) parts.push(prefix);
      parts.push(
        <Link
          key={`hashtag-${match.index}`}
          className="post-tag post-hashtag"
          to={`/search?input=${encodeURIComponent(`#${match[5]}`)}`}
        >
          #{match[5]}
        </Link>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) parts.push(value.slice(lastIndex));
  return <>{parts.length ? parts : value}</>;
};

export default RichPostText;
