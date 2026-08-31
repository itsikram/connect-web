import Rlike from "../assets/images/reacts/reactLike.svg";
import Rlove from "../assets/images/reacts/reactLove.svg";
import Rhaha from "../assets/images/reacts/reactHaha.svg";
import Rwow from "../assets/images/reacts/reactWow.svg";
import Rsad from "../assets/images/reacts/reactSad.svg";
import Rangry from "../assets/images/reacts/reactAngry.svg";

export const REACT_TYPES = ["like", "love", "haha", "wow", "sad", "angry"];

export const REACT_META = {
  like: { key: "like", label: "Like", icon: Rlike },
  love: { key: "love", label: "Love", icon: Rlove },
  haha: { key: "haha", label: "Haha", icon: Rhaha },
  wow: { key: "wow", label: "Wow", icon: Rwow },
  sad: { key: "sad", label: "Sad", icon: Rsad },
  angry: { key: "angry", label: "Angry", icon: Rangry },
};

export const REACT_LIST = REACT_TYPES.map((key) => REACT_META[key]);

export const getReactIcon = (type) =>
  REACT_META[type]?.icon || REACT_META.like.icon;

export const getReactLabel = (type) => REACT_META[type]?.label || "Like";

export const isReactType = (type) => REACT_TYPES.includes(type);

export const uniquePlacedReacts = (reacts = []) => {
  const seen = [];
  reacts.forEach((react) => {
    const type = react?.type;
    if (type && REACT_META[type] && !seen.includes(type)) {
      seen.push(type);
    }
  });
  return seen;
};

export const sameProfileId = (a, b) =>
  String(a?._id || a || "") === String(b?._id || b || "");

export const uniqueReactCount = (reacts = []) => {
  const seen = new Set();
  reacts.forEach((react) => {
    const id = String(react?.profile?._id || react?.profile || "");
    if (id) seen.add(id);
  });
  return seen.size;
};

export const emptyReactCounts = () =>
  REACT_TYPES.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
