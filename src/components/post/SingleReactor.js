import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import UserPP from "../UserPP";
import { Link } from "react-router-dom";
import { getReactIcon, getReactLabel } from "../../utils/reactTypes";

const getViewerId = (viewer) => {
  if (!viewer) return "";
  if (typeof viewer === "string") return viewer;
  return String(viewer._id || viewer.id || "");
};

const isPopulatedProfile = (viewer) =>
  Boolean(viewer && typeof viewer === "object" && (viewer.fullName || viewer.profilePic));

const SingleReactor = ({ viewer, reacts = [], reactType = "" }) => {
  const viewerId = getViewerId(viewer);
  const [profileData, setProfileData] = useState(
    isPopulatedProfile(viewer) ? viewer : false,
  );

  const resolvedReactType = useMemo(() => {
    if (reactType) return reactType;

    const matchedReact = reacts.find((react) => {
      const reactProfileId = String(react?.profile?._id || react?.profile || "");
      return reactProfileId && reactProfileId === viewerId;
    });

    return matchedReact?.type || "";
  }, [reactType, reacts, viewerId]);

  const reactImg = getReactIcon(resolvedReactType);

  useEffect(() => {
    if (isPopulatedProfile(viewer)) {
      setProfileData(viewer);
      return;
    }

    if (!viewerId) return undefined;

    let isMounted = true;

    const loadProfileData = async () => {
      try {
        const res = await api.get("profile", { params: { profileId: viewerId } });
        if (isMounted && res.status === 200) {
          setProfileData(res.data);
        }
      } catch (error) {
        // Keep the row hidden if the profile cannot be loaded.
      }
    };

    loadProfileData();

    return () => {
      isMounted = false;
    };
  }, [viewer, viewerId]);

  if (!profileData) {
    return (
      <li className="sp-reacts-item sp-reacts-item--pending" aria-hidden="true">
        <span className="sp-viewer-skeleton-avatar" />
        <span className="sp-viewer-skeleton-line" />
      </li>
    );
  }

  return (
    <li className="sp-reacts-item">
      <div className="reactor-pp">
        <UserPP
          profilePic={profileData.profilePic}
          profile={profileData._id || viewerId}
        />
      </div>
      <div className="react-details">
        <Link to={`/${profileData._id || viewerId}`}>
          <span className="reactor-name">{profileData.fullName}</span>
        </Link>
        {resolvedReactType ? (
          <span className="reactor-react-label">
            {getReactLabel(resolvedReactType)}
          </span>
        ) : null}
      </div>
      <span className="reactor-react">
        {resolvedReactType ? (
          <img src={reactImg} alt={resolvedReactType || "reacted"} />
        ) : (
          <span className="reactor-view-badge">Viewed</span>
        )}
      </span>
    </li>
  );
};

export default SingleReactor;
