import { PROFILE_IMG_REFERRER_POLICY, sanitizeProfileImageUrl } from "./profileImage";

const checkImgLoading = (url, setLoaded) => {
    if (!url) {
        setLoaded(false);
        return;
    }

    const img = new Image();
    img.referrerPolicy = PROFILE_IMG_REFERRER_POLICY;
    img.onload = () => setLoaded(true);
    img.onerror = () => setLoaded(false);
    img.src = sanitizeProfileImageUrl(url);
};

export default checkImgLoading
