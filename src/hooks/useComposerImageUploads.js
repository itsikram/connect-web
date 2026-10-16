import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";

export const MAX_COMPOSER_IMAGES = 10;
const MAX_PARALLEL_UPLOADS = 3;

const getUploadError = (error) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  "Upload failed";

/**
 * Uploads chat photos in the background, a few at a time, tracking per-image progress.
 * Each image: { id, previewUrl, file, status: queued|uploading|processing|done|error, progress, url, error }.
 */
const useComposerImageUploads = () => {
  const [images, setImages] = useState([]);
  const controllersRef = useRef(new Map());
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const patchImage = useCallback((id, patch) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...patch } : img)),
    );
  }, []);

  const startUpload = useCallback(
    async (image) => {
      const controller = new AbortController();
      controllersRef.current.set(image.id, controller);
      patchImage(image.id, { status: "uploading", progress: 0, error: "" });

      try {
        const form = new FormData();
        form.append("image", image.file);
        const res = await api.post("/upload", form, {
          headers: { "Content-Type": "multipart/form-data" },
          signal: controller.signal,
          onUploadProgress: (event) => {
            if (!event.total) return;
            const pct = Math.round((event.loaded / event.total) * 100);
            // Bytes are sent; the server still has to store the image.
            patchImage(image.id, {
              progress: Math.min(pct, 99),
              status: pct >= 100 ? "processing" : "uploading",
            });
          },
        });
        const url = res?.data?.secure_url || res?.data?.url;
        if (!url) throw new Error("Upload returned no URL");
        patchImage(image.id, { status: "done", progress: 100, url });
      } catch (error) {
        if (controller.signal.aborted) return;
        patchImage(image.id, { status: "error", error: getUploadError(error) });
      } finally {
        controllersRef.current.delete(image.id);
      }
    },
    [patchImage],
  );

  // Keep at most MAX_PARALLEL_UPLOADS in flight; start queued ones as slots free up.
  useEffect(() => {
    const active = images.filter(
      (img) => img.status === "uploading" || img.status === "processing",
    ).length;
    const slots = MAX_PARALLEL_UPLOADS - active;
    if (slots <= 0) return;
    images
      .filter((img) => img.status === "queued")
      .slice(0, slots)
      .forEach((img) => startUpload(img));
  }, [images, startUpload]);

  /** Returns how many files were skipped (non-images or over the limit). */
  const addFiles = useCallback((fileList) => {
    const all = Array.from(fileList || []);
    const files = all.filter((file) => String(file?.type || "").startsWith("image/"));
    const room = Math.max(0, MAX_COMPOSER_IMAGES - imagesRef.current.length);
    const accepted = files.slice(0, room);
    if (accepted.length) {
      const stamp = Date.now();
      setImages((prev) => [
        ...prev,
        ...accepted.map((file, i) => ({
          id: `img-${stamp}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          status: "queued",
          progress: 0,
          url: "",
          error: "",
        })),
      ]);
    }
    return all.length - accepted.length;
  }, []);

  const removeImage = useCallback((id) => {
    controllersRef.current.get(id)?.abort();
    controllersRef.current.delete(id);
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const retryImage = useCallback(
    (id) => patchImage(id, { status: "queued", progress: 0, error: "" }),
    [patchImage],
  );

  const clearImages = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    setImages((prev) => {
      prev.forEach((img) => img.previewUrl && URL.revokeObjectURL(img.previewUrl));
      return [];
    });
  }, []);

  useEffect(
    () => () => {
      controllersRef.current.forEach((controller) => controller.abort());
      imagesRef.current.forEach(
        (img) => img.previewUrl && URL.revokeObjectURL(img.previewUrl),
      );
    },
    [],
  );

  const summary = useMemo(() => {
    const pending = images.filter((img) => img.status !== "done" && img.status !== "error");
    const totalProgress = images.length
      ? Math.round(images.reduce((sum, img) => sum + (img.progress || 0), 0) / images.length)
      : 0;
    return {
      hasImages: images.length > 0,
      isUploading: pending.length > 0,
      pendingCount: pending.length,
      failedCount: images.filter((img) => img.status === "error").length,
      readyUrls: images.filter((img) => img.status === "done").map((img) => img.url),
      totalProgress,
      canAddMore: images.length < MAX_COMPOSER_IMAGES,
    };
  }, [images]);

  return { images, addFiles, removeImage, retryImage, clearImages, ...summary };
};

export default useComposerImageUploads;
