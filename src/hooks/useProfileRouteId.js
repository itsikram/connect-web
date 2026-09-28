import { useOutletContext, useParams } from "react-router-dom";

/**
 * Returns the profile id for the current /:profile route.
 * The URL may contain a username (e.g. /programmerikram), so prefer the id
 * resolved by the parent Profile page and fall back to the raw URL param.
 */
const useProfileRouteId = () => {
  const { profile } = useParams();
  const context = useOutletContext();
  return context?.profileId ? String(context.profileId) : profile;
};

export default useProfileRouteId;
