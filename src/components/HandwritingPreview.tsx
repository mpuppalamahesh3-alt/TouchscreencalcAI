import { Loader2, ScanText } from "lucide-react";

interface HandwritingPreviewProps {
  hasInk: boolean;
  isLoading: boolean;
  recognizedText: string;
}

const HandwritingPreview = ({ hasInk, isLoading, recognizedText }: HandwritingPreviewProps) => {
  const helperText = !hasInk
    ? "Write on the pad and the text will appear here."
    : isLoading
      ? "Reading handwriting..."
      : recognizedText || "Keep writing, then edit the question box below if needed.";

  return (
    <section className="rounded-xl border border-border glass px-3 py-2.5 flex items-center gap-2">
      <ScanText size={14} className="text-primary shrink-0" />
      <p className={`flex-1 break-words font-sans text-[15px] leading-snug ${recognizedText ? "text-foreground" : "text-muted-foreground"}`}>
        {helperText}
      </p>
      {isLoading && <Loader2 size={14} className="text-primary animate-spin shrink-0" />}
    </section>
  );
};

export default HandwritingPreview;
