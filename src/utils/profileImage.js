export const PROFILE_IMG_REFERRER_POLICY = "no-referrer";
const LEGACY_CLOUDINARY_CLOUD = "dz88yjerw";
const ACTIVE_CLOUDINARY_CLOUD = "exwmmdyg";

export const normalizeCloudinaryUrl = (value) =>
  typeof value === "string"
    ? value.replace(
        `res.cloudinary.com/${LEGACY_CLOUDINARY_CLOUD}/`,
        `res.cloudinary.com/${ACTIVE_CLOUDINARY_CLOUD}/`,
      )
    : value;

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
  const activeUrl = normalizeCloudinaryUrl(trimmed);
  if (!isGoogleHostedImage(activeUrl)) return activeUrl;

  let next = activeUrl.split("#")[0].split("?")[0];
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
