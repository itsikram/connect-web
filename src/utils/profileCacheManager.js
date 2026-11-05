import {
  BOOT_SLICES,
  getSessionProfileId,
  readBootCache,
  removeBootCache,
  writeBootCache,
} from "./bootCache";

// Keys used by the old cache, which was not tied to an account and expired
// after 30 minutes. Removed on load so they can never be read again.
const LEGACY_KEYS = [
  "cachedProfileData",
  "cachedProfileDataTimestamp",
  "profile_cache_version",
];

// Fields of the Redux profile slice that describe a request, not the profile.
const TRANSIENT_FIELDS = ["isLoading", "error", "isLoggedIn"];

const profileIdOf = (profile) =>
  profile && typeof profile === "object" ? String(profile._id || profile.id || "") : "";

class ProfileCacheManager {
  static initialize() {
    try {
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      // ignore
    }
  }

  // The signed-in account's own profile, or null. Never returns a profile
  // that belongs to a different account than `profileId` (default: the
  // account signed in right now).
  static getCachedProfile(profileId = getSessionProfileId()) {
    const owner = String(profileId || "");
    if (!owner) return null;
    const profile = readBootCache(BOOT_SLICES.PROFILE, { ownerId: owner });
    return profileIdOf(profile) === owner ? profile : null;
  }

  // Only the signed-in account's own profile is stored.
  static setCachedProfile(profile) {
    const owner = getSessionProfileId();
    if (!owner || profileIdOf(profile) !== owner) return false;
    const clean = { ...profile };
    TRANSIENT_FIELDS.forEach((field) => delete clean[field]);
    return writeBootCache(BOOT_SLICES.PROFILE, clean, owner);
  }

  static isCacheValid() {
    return Boolean(this.getCachedProfile());
  }

  static clearCache() {
    removeBootCache(BOOT_SLICES.PROFILE);
  }
}

ProfileCacheManager.initialize();

export default ProfileCacheManager;
