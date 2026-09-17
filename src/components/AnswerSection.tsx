import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, FileDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AnswerSectionProps {
  expression: string;
  result: string;
  steps: string[];
  isLoading: boolean;
  questionText?: string;
  inkImage?: string | null;
}

// Paper sheet uses literal print colors so the exported PDF always looks like
// a white notebook page, independent of the app theme.
const PAPER = "#fdfdf7";
const RULE = "#c9dcf5";
const MARGIN_LINE = "#e5808f";
const INK = "#1b3a8f";
const PENCIL = "#41506b";

const splitLines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l, i, arr) => l.length > 0 || (i > 0 && arr[i - 1].length > 0));

const AnswerSection = ({ expression, result, steps, isLoading, questionText, inkImage }: AnswerSectionProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const answerLines = splitLines(result);

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    toast({ duration: 1200, title: "⏳ Preparing PDF…" });
    try {
      const { exportHandwritingPdf } = await import("@/lib/exportPdf");
      await exportHandwritingPdf({
        question: questionText?.trim() || expression || "—",
        steps,
        answer: result,
        inkImage: inkImage ?? null,
      });
      toast({ duration: 3500, title: "✅ Downloaded successfully", description: "Your handwritten solution PDF was saved to your device." });
    } catch (e: any) {
      toast({ duration: 4000, variant: "destructive", title: "Download failed", description: e?.message || "Try again." });

    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-border glass p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <p className="text-sm text-muted-foreground font-semibold tracking-wide uppercase">Solution</p>
        </div>
        {result && !isLoading && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleExport}
            disabled={exporting}
            className="h-9 px-3 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
            PDF
          </motion.button>
        )}
      </div>

      <div>
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 py-4"
          >
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <p className="text-muted-foreground text-base">Solving on paper…</p>
          </motion.div>
        ) : result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Handwritten notebook sheet */}
            <div
              ref={sheetRef}
              className="rounded-xl overflow-hidden shadow-lg"
              style={{
                background: `repeating-linear-gradient(${PAPER}, ${PAPER} 33px, ${RULE} 33px, ${RULE} 34px)`,
                border: `1px solid ${RULE}`,
                padding: "18px 16px 22px 34px",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 24,
                  width: 1,
                  background: MARGIN_LINE,
                  opacity: 0.7,
                }}
              />

              <p
                className="font-handwriting"
                style={{ color: PENCIL, fontSize: 15, lineHeight: "34px", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                Question:{" "}
                <span style={{ color: INK }}>{questionText || expression || "—"}</span>
              </p>


              {steps.length > 0 && (
                <div style={{ marginTop: 0 }}>
                  {steps.map((step, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.07 }}
                      className="font-handwriting"
                      style={{
                        color: INK,
                        fontSize: 17,
                        lineHeight: "34px",
                        margin: 0,
                        wordBreak: "break-word",
                      }}
                    >
                      {step}
                    </motion.p>
                  ))}
                </div>
              )}

              {(answerLines.length > 1 ? answerLines.slice(0, -1) : []).map((line, i) => (
                <motion.p
                  key={`l-${i}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + (steps.length + i) * 0.06 }}
                  className="font-handwriting"
                  style={{
                    color: INK,
                    fontSize: 17,
                    lineHeight: "34px",
                    margin: 0,
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {line}
                </motion.p>
              ))}

              {(() => {
                const last = answerLines[answerLines.length - 1] ?? result;
                const isShort = last.length <= 70;
                return (
                  <motion.p
                    initial={{ opacity: 0, scale: isShort ? 0.94 : 1, x: isShort ? 0 : -6 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 220 }}
                    className="font-handwriting"
                    style={{
                      color: INK,
                      fontSize: isShort ? 26 : 17,
                      fontWeight: isShort ? 700 : 400,
                      lineHeight: "34px",
                      margin: 0,
                      textDecoration: isShort ? "underline" : "none",
                      textDecorationThickness: 2,
                      textUnderlineOffset: 5,
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {isShort && !/^(ans|answer)\b/i.test(last) ? `Ans = ${last}` : last}
                  </motion.p>
                );
              })()}

            </div>
          </motion.div>
        ) : (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground/50 text-sm py-2"
          >
            Draw, upload, or speak a question, then tap Solve ✨
          </motion.p>
        )}
      </div>
    </div>
  );
};

export default AnswerSection;
