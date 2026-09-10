import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/api";
import { getProfileDisplayName } from "./commentUtils";

const getMentionQuery = (value, cursor) => {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
  return match ? match[1] : null;
};

const MentionInput = ({
  value = "",
  onChange,
  myProfileId,
  className = "",
  placeholder,
  disabled,
  onKeyDown,
  ...props
}) => {
  const inputRef = useRef(null);
  const [connects, setConnects] = useState([]);
  const [activeQuery, setActiveQuery] = useState(null);
  const [cursor, setCursor] = useState(value.length);
  const mentionActive = activeQuery !== null;

  useEffect(() => {
    if (!myProfileId || !mentionActive) return;
    let cancelled = false;
    api
      .get("/connects/getConnects", { params: { profile: myProfileId } })
      .then((response) => {
        if (!cancelled) setConnects(Array.isArray(response.data) ? response.data : []);
      })
      .catch((error) => {
        if (!cancelled) {
          setConnects([]);
          console.error("Unable to load profile connects for mentions:", error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [myProfileId, mentionActive]);

  const matches = useMemo(() => {
    const query = String(activeQuery || "").trim().toLowerCase();
    return connects
      .filter((profile) => {
        const name = getProfileDisplayName(profile);
        return !query || `${name} ${profile?.username || ""}`.toLowerCase().includes(query);
      })
      .slice(0, 8);
  }, [activeQuery, connects]);

  const handleChange = (event) => {
    const nextValue = event.target.value;
    const nextCursor = event.target.selectionStart ?? nextValue.length;
    setCursor(nextCursor);
    setActiveQuery(getMentionQuery(nextValue, nextCursor));
    onChange(event);
  };

  const selectProfile = (profile) => {
    const start = value.slice(0, cursor).search(/(?:^|\s)@[^\s@]*$/);
    if (start < 0) return;
    const mentionStart = value[cursor - 1] === "@" ? cursor - 1 : start + (value[start] === " " ? 1 : 0);
    const name = getProfileDisplayName(profile).replace(/\s+/g, "");
    const nextValue = `${value.slice(0, mentionStart)}@${name} ${value.slice(cursor)}`;
    const nextCursor = mentionStart + name.length + 2;
    onChange({ target: { value: nextValue } });
    setActiveQuery(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div className="mention-input-wrap">
      <input
        ref={inputRef}
        {...props}
        className={className}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key === "Escape") setActiveQuery(null);
        }}
      />
      {activeQuery !== null && matches.length > 0 && (
        <div className="mention-suggestions" role="listbox" aria-label="Profile connects">
          {matches.map((profile) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              className="mention-suggestion"
              key={profile._id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectProfile(profile)}
            >
              <img src={profile.profilePic} alt="" />
              <span>
                <strong>{getProfileDisplayName(profile)}</strong>
                {profile.username ? <small>@{profile.username}</small> : null}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
