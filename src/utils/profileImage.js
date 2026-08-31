export const PROFILE_IMG_REFERRER_POLICY = "no-referrer";

export const isGoogleHostedImage = (url) =>
  typeof url === "string" &&
  /googleusercontent\.com|ggpht\.com/i.test(url);

/**
 * Google avatar URLs break when extra query params are appended (cache-bust)
 * and are often served at s96, which looks empty/blurry on the profile page.
 */
export const sanitizeProfileImageUrl = (url, size) => {
  if (!url || typeof url !== "string") return url || "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (!isGoogleHostedImage(trimmed)) return trimmed;

  let next = trimmed.split("#")[0].split("?")[0];
  if (size) {
    if (/=s\d+/i.test(next)) {
      next = next.replace(
        /=s\d+(-[a-z]+)?/i,
        (_, suffix) => `=s${size}${suffix || ""}`
      );
    } else {
      next = `${next}=s${size}-c`;
    }
  }
  return next;
};
