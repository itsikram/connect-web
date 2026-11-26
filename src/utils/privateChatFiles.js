import api from "../api/api";

export const driveChatFile = (value) =>
  typeof value === "string" ? /^drive-chat:([a-f0-9]{32}):(image|file|voice)$/.exec(value) : null;

export const fetchDriveChatFile = (reference, signal) => {
  const file = driveChatFile(reference);
  return api.get(`/personal-drive/files/${file[1]}`, { responseType: "blob", signal });
};

export const driveDownloadName = (header) => {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header || "");
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      return "attachment";
    }
  }
  return /filename="([^"]+)"/i.exec(header || "")?.[1] || "attachment";
};

export const chatUploadForm = (file, recipient) => {
  const form = new FormData();
  form.append("file", file);
  if (recipient) form.append("recipient", recipient);
  return form;
};
