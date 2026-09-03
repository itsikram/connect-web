import React, { useEffect, useRef, useState } from "react";

const ExpandableText = ({ children, className = "", lines = 2 }) => {
  const textRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [children]);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;

    const measure = () => {
      const lineHeight = parseFloat(window.getComputedStyle(element).lineHeight);
      const maxHeight = lineHeight * lines;
      setHasMore(element.scrollHeight > maxHeight + 1);
    };

    measure();
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(measure)
      : null;
    resizeObserver?.observe(element);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children, lines]);

  return (
    <>
      <span
        ref={textRef}
        className={`expandable-text ${className}${expanded ? " is-expanded" : ""}`}
        style={expanded ? undefined : { WebkitLineClamp: lines }}
      >
        {children}
      </span>
      {hasMore && (
        <button
          type="button"
          className="expandable-text-button"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </>
  );
};

export default ExpandableText;
