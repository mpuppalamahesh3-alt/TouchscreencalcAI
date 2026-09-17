import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Camera, Mic, Sparkles, BookOpen, Notebook, Calculator as CalcIcon, Square } from "lucide-react";
import DrawingCanvas from "@/components/DrawingCanvas";
import AnswerSection from "@/components/AnswerSection";
import HandwritingPreview from "@/components/HandwritingPreview";
import CameraUpload from "@/components/CameraUpload";
import VoiceInput from "@/components/VoiceInput";
import FormulaLibrary from "@/components/FormulaLibrary";
import NotebookSaver, { type SavedNote } from "@/components/NotebookSaver";
import Calculator from "@/components/Calculator";
import FloatingChat from "@/components/FloatingChat";
import { exportCanvasForRecognition } from "@/lib/handwriting";
import { invokeSolveMath } from "@/lib/solveMath";
import { useToast } from "@/hooks/use-toast";
import AnimatedLogo from "@/components/AnimatedLogo";

type InputMode = "draw" | "camera" | "voice";
type Section = "solve" | "calculator" | "formulas" | "notes";

const tabs: { id: InputMode; label: string; icon: React.ReactNode }[] = [
  { id: "draw", label: "Draw", icon: <Pencil size={18} /> },
  { id: "camera", label: "Camera", icon: <Camera size={18} /> },
  { id: "voice", label: "Voice", icon: <Mic size={18} /> },
];

const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "solve", label: "Solve", icon: <Sparkles size={16} /> },
  { id: "calculator", label: "Calc", icon: <CalcIcon size={16} /> },
  { id: "formulas", label: "Formulas", icon: <BookOpen size={16} /> },
  { id: "notes", label: "Notes", icon: <Notebook size={16} /> },
];

const HANDWRITING_IDLE_MS = 900;
const HANDWRITING_COOLDOWN_MS = 3500;
const HANDWRITING_RATE_LIMIT_RETRY_MS = 4000;

const panelFallback = (
  <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-5 text-sm text-muted-foreground">
    Loading…
  </div>
);


const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRequestRef = useRef(0);
  const recognitionTimerRef = useRef<number | null>(null);
  const recognitionInFlightRef = useRef(false);
  const pendingRecognitionImageRef = useRef<string | null>(null);
  const lastRecognizedImageRef = useRef<string | null>(null);
  const lastRecognitionAtRef = useRef(0);
  const [mode, setMode] = useState<InputMode>("draw");
  const [section, setSection] = useState<Section>("solve");
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState<string | null>(null);
  const [drawImage, setDrawImage] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [answeredQuestion, setAnsweredQuestion] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const lastAutoQuestionRef = useRef("");
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("inkCalcNotes") || "[]");
    } catch {
      return [];
    }
  });
  const answerCacheRef = useRef<Map<string, { expression: string; result: string; steps: string[] }>>(new Map());
  const lastInkRef = useRef<string | null>(null);
  const solveAbortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const cancelInFlightSolve = useCallback(() => {
    if (solveAbortRef.current) {
      solveAbortRef.current.abort();
      solveAbortRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const handleCanvasClear = useCallback(() => {
    cancelInFlightSolve();
    lastInkRef.current = null;
    setDrawImage(null);
    setRecognizedText("");
    setExpression("");
    setResult("");
    setSteps([]);
    setQuestionText("");
    setAnsweredQuestion("");
    lastAutoQuestionRef.current = "";
  }, [cancelInFlightSolve]);

  const resetDisplayedAnswer = useCallback(() => {
    cancelInFlightSolve();
    setExpression("");
    setResult("");
    setSteps([]);
    setAnsweredQuestion("");
  }, [cancelInFlightSolve]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [section]);

  const handleInkChange = useCallback((img: string | null) => {
    setDrawImage(img);
    // Only wipe the displayed answer when the actual ink content changed
    if (img === lastInkRef.current) return;
    lastInkRef.current = img;
    setResult("");
    setExpression("");
    setSteps([]);
    setAnsweredQuestion("");
  }, []);

  const persistNotes = useCallback((updater: SavedNote[] | ((p: SavedNote[]) => SavedNote[])) => {
    setSavedNotes((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      localStorage.setItem("inkCalcNotes", JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecognitionTimer = useCallback(() => {
    if (recognitionTimerRef.current !== null) {
      window.clearTimeout(recognitionTimerRef.current);
      recognitionTimerRef.current = null;
    }
  }, []);

  const recognizeHandwriting = useCallback(async (image: string) => {
    if (!image || recognitionInFlightRef.current || image === lastRecognizedImageRef.current) return;

    const elapsed = Date.now() - lastRecognitionAtRef.current;
    if (elapsed < HANDWRITING_COOLDOWN_MS) {
      clearRecognitionTimer();
      recognitionTimerRef.current = window.setTimeout(() => {
        recognitionTimerRef.current = null;
        const img = pendingRecognitionImageRef.current;
        if (img) void recognizeHandwriting(img);
      }, Math.max(HANDWRITING_IDLE_MS, HANDWRITING_COOLDOWN_MS - elapsed));
      return;
    }

    const requestId = ++recognitionRequestRef.current;
    recognitionInFlightRef.current = true;
    lastRecognitionAtRef.current = Date.now();
    setIsRecognizing(true);

    try {
      const data = await invokeSolveMath({ image, recognizeOnly: true }, { maxRetries: 2 });

      if (requestId !== recognitionRequestRef.current || pendingRecognitionImageRef.current !== image) return;

      if (data.rateLimited) {
        clearRecognitionTimer();
        recognitionTimerRef.current = window.setTimeout(() => {
          recognitionTimerRef.current = null;
          const img = pendingRecognitionImageRef.current;
          if (img) void recognizeHandwriting(img);
        }, data.retryAfterMs ?? HANDWRITING_RATE_LIMIT_RETRY_MS);
        return;
      }

      const nextText = String(data.recognizedText || data.expression || data.result || "").trim();
      lastRecognizedImageRef.current = image;
      setRecognizedText(nextText);
    } catch (error) {
      console.error("Recognition error:", error);
    } finally {
      if (requestId === recognitionRequestRef.current) {
        recognitionInFlightRef.current = false;
        setIsRecognizing(false);
      }

      const latest = pendingRecognitionImageRef.current;
      if (
        latest &&
        latest !== image &&
        latest !== lastRecognizedImageRef.current &&
        !recognitionInFlightRef.current
      ) {
        clearRecognitionTimer();
        recognitionTimerRef.current = window.setTimeout(() => {
          recognitionTimerRef.current = null;
          const queuedImage = pendingRecognitionImageRef.current;
          if (queuedImage) void recognizeHandwriting(queuedImage);
        }, HANDWRITING_IDLE_MS);
      }
    }
  }, [clearRecognitionTimer]);

  useEffect(() => {
    if (section !== "solve" || mode !== "draw") {
      pendingRecognitionImageRef.current = null;
      recognitionRequestRef.current += 1;
      recognitionInFlightRef.current = false;
      clearRecognitionTimer();
      setIsRecognizing(false);
      return;
    }

    pendingRecognitionImageRef.current = drawImage;

    if (!drawImage) {
      recognitionRequestRef.current += 1;
      recognitionInFlightRef.current = false;
      lastRecognizedImageRef.current = null;
      clearRecognitionTimer();
      setRecognizedText("");
      setIsRecognizing(false);
      return;
    }

    clearRecognitionTimer();
    recognitionTimerRef.current = window.setTimeout(() => {
      recognitionTimerRef.current = null;
      const latestImage = pendingRecognitionImageRef.current;
      if (latestImage) void recognizeHandwriting(latestImage);
    }, HANDWRITING_IDLE_MS);

    return clearRecognitionTimer;
  }, [clearRecognitionTimer, drawImage, mode, recognizeHandwriting, section]);

  useEffect(() => {
    const nextAutoText = (section === "solve" ? (mode === "draw" ? recognizedText : mode === "voice" ? voiceText ?? "" : "") : "").trim();

    setQuestionText((prev) => {
      const currentText = prev.trim();
      const previousAutoText = lastAutoQuestionRef.current.trim();

      if (!currentText || currentText === previousAutoText) {
        lastAutoQuestionRef.current = nextAutoText;
        return nextAutoText;
      }

      return prev;
    });
  }, [mode, recognizedText, section, voiceText]);

  const solveWithAI = useCallback(async (image?: string, text?: string) => {
    setSection("solve");
    const submittedQuestion = text?.trim() || "";

    // Cache lookup for repeated text questions
    const cacheKey = !image && text ? text.trim().toLowerCase() : "";
    if (cacheKey) {
      const cached = answerCacheRef.current.get(cacheKey);
      if (cached) {
        setAnsweredQuestion(submittedQuestion);
        setExpression(cached.expression);
        setResult(cached.result);
        setSteps(cached.steps);
        return;
      }
    }

    // Abort any previous in-flight solve so the newest question gets priority
    if (solveAbortRef.current) solveAbortRef.current.abort();
    const controller = new AbortController();
    solveAbortRef.current = controller;

    setIsLoading(true);
    setResult("");
    setExpression("");
    setSteps([]);
    setAnsweredQuestion(submittedQuestion);

    try {
      const data = await invokeSolveMath({ image, text }, { maxRetries: 1, signal: controller.signal });

      if (controller.signal.aborted) return;

      if (data.rateLimited) {
        toast({ title: "Try again", description: "AI is busy — please retry in a moment." });
        return;
      }

      if (data.error && !data.result) throw new Error(data.error);
      const solvedExpression = submittedQuestion || data.expression || "Question";
      const solvedResult = String(data.result || "").trim();
      if (!solvedResult) throw new Error("The problem could not be read clearly. Please try a sharper photo or retype it.");
      const solvedSteps = Array.isArray(data.steps) ? data.steps : [];

      setExpression(solvedExpression);
      setAnsweredQuestion(solvedExpression);
      setResult(solvedResult);
      setSteps(solvedSteps);

      if (cacheKey && solvedResult && solvedResult !== "Not available") {
        answerCacheRef.current.set(cacheKey, {
          expression: solvedExpression,
          result: solvedResult,
          steps: solvedSteps,
        });
      }

      persistNotes((prev) => [
        {
          id: crypto.randomUUID(),
          expression: solvedExpression,
          result: solvedResult,
          steps: solvedSteps,
          timestamp: Date.now(),
        },
        ...prev,
      ].slice(0, 50));
    } catch (error: any) {
      console.error("Solve error:", error);
      toast({
        variant: "destructive",
        title: "Couldn't solve",
        description: error.message || "Something went wrong.",
      });
    } finally {
      if (solveAbortRef.current === controller) solveAbortRef.current = null;
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [persistNotes, toast]);

  const handleSolve = async () => {
    const typedQuestion = questionText.trim();
    const autoFilledQuestion = lastAutoQuestionRef.current.trim();
    const hasManualQuestion = Boolean(typedQuestion) && typedQuestion !== autoFilledQuestion;

    if (mode === "draw") {
      const img = drawImage || (canvasRef.current ? exportCanvasForRecognition(canvasRef.current) : null);

      if (hasManualQuestion) {
        await solveWithAI(undefined, typedQuestion);
        return;
      }

      if (!img && !typedQuestion) {
        toast({ title: "No handwriting", description: "Write your question first." });
        return;
      }

      const recognizedQuestion = recognizedText.trim();
      await solveWithAI(img || undefined, typedQuestion || recognizedQuestion || undefined);
      return;
    }

    if (mode === "camera") {
      if (!uploadedImage) {
        if (typedQuestion) {
          await solveWithAI(undefined, typedQuestion);
          return;
        }
        toast({ title: "No image", description: "Upload an image first." });
        return;
      }
      await solveWithAI(uploadedImage, typedQuestion || undefined);
      return;
    }

    const voiceQuestion = typedQuestion || voiceText || "";

    if (!voiceQuestion.trim()) {
      toast({ title: "No input", description: "Record your question first." });
      return;
    }

    await solveWithAI(undefined, voiceQuestion);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 px-3 sm:px-5 py-3 glass sticky top-0 z-[200]">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <AnimatedLogo
              size={56}
              className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
            />
            <div className="leading-none flex flex-col items-start">
              <h1 className="font-display text-2xl sm:text-[26px] leading-none font-black tracking-tight">
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Ink</span>
                <span className="text-foreground">Calc</span>
              </h1>
              <span
                aria-hidden
                className="mt-1.5 h-[3px] w-full rounded-full bg-gradient-to-r from-primary via-accent to-primary shadow-[0_0_8px_hsl(var(--primary)/0.55)]"
              />
              <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground tracking-[0.28em] uppercase mt-1.5">
                AI Math Studio
              </p>
            </div>
          </div>

          <nav className="flex gap-1 bg-secondary/50 border border-border/60 rounded-2xl p-1 shadow-inner w-full sm:w-auto">
            {sections.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  aria-pressed={active}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-[12px] sm:text-[13px] font-semibold transition-all ${
                    active
                      ? "gradient-primary text-primary-foreground shadow-md shadow-primary/30 scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 px-3 sm:px-5 py-3 max-w-3xl mx-auto w-full space-y-3 pb-20">
        <div key={section}>
          {section === "solve" && (
            <motion.div key="solve" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              <div className="flex gap-0.5 p-0.5 rounded-xl bg-secondary/50 border border-border">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMode(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[13px] font-medium transition-all relative ${
                      mode === tab.id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 gradient-primary rounded-lg"
                        transition={{ type: "spring", duration: 0.4 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1">
                      {tab.icon}
                      {tab.label}
                    </span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {mode === "draw" && (
                    <>
                        <DrawingCanvas
                          canvasRef={canvasRef}
                          onInkChange={handleInkChange}
                          active={section === "solve" && mode === "draw"}
                          onClear={handleCanvasClear}
                        />
                    </>
                  )}

                  {mode === "camera" && (
                    <Suspense fallback={panelFallback}>
                      <CameraUpload
                        onImageReady={(image) => {
                          resetDisplayedAnswer();
                          setUploadedImage(image);
                          setQuestionText("");
                          lastAutoQuestionRef.current = "";
                        }}
                        currentImage={uploadedImage}
                        onClear={() => {
                          resetDisplayedAnswer();
                          setUploadedImage(null);
                          setQuestionText("");
                        }}
                      />
                    </Suspense>
                  )}

                  {mode === "voice" && (
                    <Suspense fallback={panelFallback}>
                      <VoiceInput
                        onTranscript={(text) => {
                          resetDisplayedAnswer();
                          setVoiceText(text);
                          setQuestionText(text);
                          lastAutoQuestionRef.current = text;
                        }}
                      />
                    </Suspense>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="flex gap-2 items-end">
                <input
                  type="text"
                  value={questionText}
                  onChange={(event) => {
                    setQuestionText(event.target.value);
                    setAnsweredQuestion("");
                    if (result || expression) {
                      setResult("");
                      setExpression("");
                      setSteps([]);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSolve();
                    }
                  }}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  placeholder={
                    mode === "draw"
                      ? (isRecognizing ? "Reading…" : recognizedText || "Type or draw your question")
                      : mode === "camera"
                        ? "Type question or upload image"
                        : "Type or speak your question"
                  }
                  className="flex-1 h-11 rounded-xl border border-border bg-background/80 px-3 text-[15px] font-sans text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ring-offset-background"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={isLoading ? cancelInFlightSolve : handleSolve}
                  className={`h-10 min-w-[88px] px-4 rounded-xl font-semibold text-sm tracking-wide transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                    isLoading
                      ? "bg-destructive text-destructive-foreground shadow-md hover:brightness-110"
                      : "gradient-primary text-primary-foreground hover:brightness-110"
                  }`}
                >
                  {isLoading ? <><Square size={13} fill="currentColor" /> Cancel</> : <><Sparkles size={14} /> Solve</>}
                </motion.button>
              </div>

              <AnswerSection
                expression={expression}
                result={result}
                steps={steps}
                isLoading={isLoading}
                questionText={answeredQuestion || questionText || recognizedText}
                inkImage={mode === "draw" ? drawImage : uploadedImage}
              />
            </motion.div>
          )}

          {section === "calculator" && (
            <motion.div key="calculator" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Suspense fallback={panelFallback}>
                <Calculator />
              </Suspense>
            </motion.div>
          )}

          {section === "formulas" && (
            <motion.div key="formulas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Suspense fallback={panelFallback}>
                <FormulaLibrary />
              </Suspense>
            </motion.div>
          )}

          {section === "notes" && (
            <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Suspense fallback={panelFallback}>
                <NotebookSaver
                  notes={savedNotes}
                  onDelete={(id) => persistNotes((prev) => prev.filter((n) => n.id !== id))}
                  onClear={() => persistNotes([])}
                />
              </Suspense>
              {savedNotes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Notebook size={40} className="text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">No saved notes yet</p>
                  <p className="text-muted-foreground/60 text-xs">Solved problems are auto-saved here</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>

      <Suspense fallback={null}>
        <FloatingChat />
      </Suspense>
    </div>
  );
};

export default Index;
