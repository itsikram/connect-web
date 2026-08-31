export const normalizeTranscript = (text = "") =>
  String(text || "")
    .replace(/\s+/g, " ")
    .trim();

export const collapseRepeatedTranscript = (text = "") => {
  const value = normalizeTranscript(text);
  if (!value) return "";

  const words = value.split(" ");
  if (words.length >= 2 && words.length % 2 === 0) {
    const mid = words.length / 2;
    const left = words.slice(0, mid).join(" ");
    const right = words.slice(mid).join(" ");
    if (left.toLowerCase() === right.toLowerCase()) return left;
  }

  if (!/\s/.test(value) && value.length >= 8 && value.length % 2 === 0) {
    const mid = value.length / 2;
    const left = value.slice(0, mid);
    const right = value.slice(mid);
    if (left.toLowerCase() === right.toLowerCase()) return left;
  }

  return value;
};

const hasBangla = (text) => /[\u0980-\u09FF]/.test(text);

const isTranscriptPrefix = (haystack, needle) => {
  if (!needle) return true;
  if (haystack === needle) return true;
  if (haystack.startsWith(`${needle} `)) return true;
  return hasBangla(needle) && haystack.startsWith(needle);
};

const isTranscriptSuffix = (haystack, needle) => {
  if (!needle) return true;
  if (haystack === needle) return true;
  if (haystack.endsWith(` ${needle}`)) return true;
  return hasBangla(needle) && haystack.endsWith(needle);
};

export const mergeTranscriptChunk = (base, incoming) => {
  const left = normalizeTranscript(base);
  const right = collapseRepeatedTranscript(incoming);
  if (!right) return left;
  if (!left) return right;

  const l = left.toLowerCase();
  const r = right.toLowerCase();
  if (r === l) return left;
  if (isTranscriptSuffix(l, r)) return left;
  if (isTranscriptPrefix(r, l)) return right;
  if (isTranscriptSuffix(r, l)) return right;

  const leftWords = left.split(" ");
  const rightWords = right.split(" ");
  const max = Math.min(leftWords.length, rightWords.length);
  for (let n = max; n >= 1; n -= 1) {
    const tail = leftWords.slice(-n).join(" ").toLowerCase();
    const head = rightWords.slice(0, n).join(" ").toLowerCase();
    if (tail === head) {
      return normalizeTranscript(
        `${leftWords.slice(0, -n).join(" ")} ${right}`,
      );
    }
  }

  return `${left} ${right}`;
};
