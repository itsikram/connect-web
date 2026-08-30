const CACHE_KEYS = {
  PROFILE: "cachedProfileData",
  PROFILE_TIMESTAMP: "cachedProfileDataTimestamp",
  CACHE_VERSION: "profile_cache_version",
};

const CACHE_VERSION = "1.0";
const PROFILE_CACHE_DURATION = 30 * 60 * 1000;

class ProfileCacheManager {
  static initialize() {
    try {
      const cachedVersion = localStorage.getItem(CACHE_KEYS.CACHE_VERSION);
      if (cachedVersion !== CACHE_VERSION) {
        this.clearCache();
        localStorage.setItem(CACHE_KEYS.CACHE_VERSION, CACHE_VERSION);
      }
    } catch (error) {
      console.warn("Profile cache initialization error:", error);
    }
  }

  static getCachedProfile() {
    try {
      const cachedProfile = localStorage.getItem(CACHE_KEYS.PROFILE);
      const timestamp = localStorage.getItem(CACHE_KEYS.PROFILE_TIMESTAMP);

      if (!cachedProfile || !timestamp) {
        return null;
      }

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      if (timeSinceCache > PROFILE_CACHE_DURATION) {
        this.clearCache();
        return null;
      }

      const parsedProfile = JSON.parse(cachedProfile);
      return parsedProfile && typeof parsedProfile === "object"
        ? parsedProfile
        : null;
    } catch (error) {
      console.error("Error reading profile from localStorage:", error);
      return null;
    }
  }

  static setCachedProfile(profile) {
    try {
      if (!profile || typeof profile !== "object") {
        return false;
      }

      localStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(profile));
      localStorage.setItem(
        CACHE_KEYS.PROFILE_TIMESTAMP,
        Date.now().toString(),
      );
      return true;
    } catch (error) {
      console.error("Error saving profile to localStorage:", error);
      return false;
    }
  }

  static isCacheValid() {
    try {
      const cachedProfile = localStorage.getItem(CACHE_KEYS.PROFILE);
      const timestamp = localStorage.getItem(CACHE_KEYS.PROFILE_TIMESTAMP);

      if (!cachedProfile || !timestamp) {
        return false;
      }

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      return timeSinceCache <= PROFILE_CACHE_DURATION;
    } catch (error) {
      console.warn("Error checking profile cache validity:", error);
      return false;
    }
  }

  static clearCache() {
    try {
      localStorage.removeItem(CACHE_KEYS.PROFILE);
      localStorage.removeItem(CACHE_KEYS.PROFILE_TIMESTAMP);
    } catch (error) {
      console.error("Error clearing cached profile:", error);
    }
  }
}

ProfileCacheManager.initialize();

export default ProfileCacheManager;
