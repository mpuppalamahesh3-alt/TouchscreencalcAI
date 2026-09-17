import { useRef, useState, useCallback } from "react";
import { Camera, Upload, X, Loader2, AlertCircle } from "lucide-react";

interface CameraUploadProps {
  onImageReady: (dataUrl: string) => void;
  currentImage: string | null;
  onClear: () => void;
}

const CameraUpload = ({ onImageReady, currentImage, onClear }: CameraUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState("");

  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      if (!file.type.startsWith("image/")) {
        setError("Choose a valid photo.");
        return;
      }

      setIsPreparing(true);
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        const maxSide = 2048;
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Photo processing is unavailable.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        onImageReady(canvas.toDataURL("image/jpeg", 0.9));
      } catch {
        setError("This photo could not be opened. Try JPG, PNG, or take a new photo.");
      } finally {
        setIsPreparing(false);
      }
    },
    [onImageReady]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-3">
      {isPreparing ? (
        <div className="flex h-[280px] items-center justify-center gap-3 rounded-2xl border-2 border-border bg-canvas text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium">Preparing photo…</span>
        </div>
      ) : currentImage ? (
        <div className="relative rounded-2xl border-2 border-border overflow-hidden bg-canvas" style={{ height: "280px" }}>
          <img
            src={currentImage}
            alt="Math problem"
            className="w-full h-full object-contain"
          />
          <button
            onClick={onClear}
            className="absolute top-3 right-3 p-2 rounded-full bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3" style={{ height: "280px" }}>
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-canvas hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="p-4 rounded-2xl gradient-primary group-hover:scale-110 transition-transform">
              <Camera size={28} className="text-primary-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Take Photo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Use your camera</p>
            </div>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-canvas hover:border-accent/50 hover:bg-accent/5 transition-all group"
          >
            <div className="p-4 rounded-2xl bg-accent group-hover:scale-110 transition-transform">
              <Upload size={28} className="text-accent-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Upload Image</p>
              <p className="text-xs text-muted-foreground mt-0.5">From your gallery</p>
            </div>
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default CameraUpload;
