import React, { useEffect, useState } from "react";
import { driveChatFile, driveDownloadName, fetchDriveChatFile } from "../../utils/privateChatFiles";

export function useDriveChatMedia(reference) {
  const [media, setMedia] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMedia(null);
    setFailed(false);
    if (!driveChatFile(reference)) return undefined;

    const controller = new AbortController();
    let url;
    fetchDriveChatFile(reference, controller.signal)
      .then(({ data, headers }) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(data);
        setMedia({ reference, url, name: driveDownloadName(headers["content-disposition"]) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [reference]);

  return { media: media?.reference === reference ? media : null, failed };
}

export default function DriveChatAttachment({ reference }) {
  const [requested, setRequested] = useState(false);
  const image = driveChatFile(reference)?.[2] === "image";
  const { media, failed } = useDriveChatMedia(image || requested ? reference : null);
  return (
    <div className="message-container">
      {media && image && <img className="message-attachment" src={media.url} alt={media.name} />}
      {media ? (
        <a href={media.url} download={media.name}>Download {media.name}</a>
      ) : failed ? (
        <span>Drive attachment unavailable</span>
      ) : requested || image ? (
        <span>Loading Drive attachment…</span>
      ) : (
        <button type="button" onClick={() => setRequested(true)}>Open Drive attachment</button>
      )}
    </div>
  );
}
