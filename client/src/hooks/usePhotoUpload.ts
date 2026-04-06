import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface UsePhotoUploadOptions {
  purpose?: "profile-photo" | "chat-image" | "court-photo";
  maxSizeMB?: number;
  onSuccess?: (url: string) => void;
  enableCrop?: boolean;
}

export function usePhotoUpload(options: UsePhotoUploadOptions = {}) {
  const { purpose = "profile-photo", maxSizeMB = 10, onSuccess, enableCrop = false } = options;
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const uploadBlob = useCallback(async (blob: Blob, fileName?: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, fileName || `photo-${Date.now()}.jpg`);
      formData.append("purpose", purpose);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t("photoUpload.failed") }));
        throw new Error(err.error || t("photoUpload.failed"));
      }

      const data = await res.json();
      const url = data.url as string;
      toast.success(t("photoUpload.success"));
      onSuccess?.(url);
    } catch (err: any) {
      toast.error(err.message || t("photoUpload.uploadError"));
      // Revoke blob URL to prevent memory leak before clearing preview
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, [purpose, onSuccess]);

  const handleCropComplete = useCallback(async (croppedBlob: Blob) => {
    setCropSrc(null);
    const localUrl = URL.createObjectURL(croppedBlob);
    setPreview(localUrl);
    await uploadBlob(croppedBlob);
  }, [uploadBlob]);

  const handleCropCancel = useCallback(() => {
    setCropSrc(null);
  }, []);

  const openFilePicker = useCallback(() => {
    if (!inputRef.current) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp,image/gif";
      input.style.display = "none";
      document.body.appendChild(input);
      inputRef.current = input;
    }
    inputRef.current.value = "";
    inputRef.current.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Validate size
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(t("photoUpload.tooLarge", { size: maxSizeMB }));
        return;
      }

      // Validate type
      if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/)) {
        toast.error(t("photoUpload.invalidType"));
        return;
      }

      if (enableCrop) {
        // Show crop dialog
        const localUrl = URL.createObjectURL(file);
        setCropSrc(localUrl);
        return;
      }

      // Show local preview immediately
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);

      // Upload directly
      await uploadBlob(file, file.name);
    };
    inputRef.current.click();
  }, [maxSizeMB, enableCrop, uploadBlob]);

  const clearPreview = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }, [preview]);

  return { uploading, preview, openFilePicker, clearPreview, cropSrc, handleCropComplete, handleCropCancel };
}
