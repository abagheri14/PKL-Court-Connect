import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { X, Check, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  aspect?: number;
  circular?: boolean;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

export default function ImageCropper({ imageSrc, onCropComplete, onCancel, aspect = 1, circular = true }: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const { t } = useTranslation();

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  }, [aspect]);

  const getCroppedImg = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;
    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio || 1;
    
    canvas.width = completedCrop.width * scaleX * pixelRatio;
    canvas.height = completedCrop.height * scaleY * pixelRatio;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = "high";
    
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0, 0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
    );
    
    canvas.toBlob(
      (blob) => { if (blob) onCropComplete(blob); },
      "image/jpeg",
      0.92
    );
  }, [completedCrop, onCropComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm">
        <button onClick={onCancel} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
          <X size={20} className="text-white" />
        </button>
        <h2 className="text-white font-bold text-sm">{t("imageCropper.cropPhoto")}</h2>
        <button
          onClick={getCroppedImg}
          disabled={!completedCrop}
          className="p-2 rounded-xl bg-gradient-to-r from-primary to-accent disabled:opacity-40 transition-all"
        >
          <Check size={20} className="text-white" />
        </button>
      </div>

      {/* Crop Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={aspect}
          circularCrop={circular}
          className="max-h-[70vh]"
        >
          <img
            ref={imgRef}
            alt="Crop"
            src={imageSrc}
            onLoad={onImageLoad}
            className="max-h-[70vh] max-w-full object-contain"
            crossOrigin="anonymous"
          />
        </ReactCrop>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 px-4 py-4 bg-black/50 backdrop-blur-sm">
        <Button onClick={onCancel} variant="outline" className="border-white/20 text-white hover:bg-white/10">
          {t("imageCropper.cancel")}
        </Button>
        <Button
          onClick={getCroppedImg}
          disabled={!completedCrop}
          className="bg-gradient-to-r from-primary to-accent text-white shadow-[0_0_16px_rgba(168,85,247,0.3)]"
        >
          <Check size={16} className="mr-1.5" /> {t("imageCropper.usePhoto")}
        </Button>
      </div>
    </div>
  );
}
