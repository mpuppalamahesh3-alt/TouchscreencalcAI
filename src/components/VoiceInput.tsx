import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
}

const VoiceInput = ({ onTranscript }: VoiceInputProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");

  const emit = useCallback((text: string) => {
    transcriptRef.current = text;
    setTranscript(text);
    onTranscript(text);
  }, [onTranscript]);

  const startRecording = useCallback(async () => {
    setError(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Voice recognition isn't supported in this browser. Try Chrome or Edge.");
      return;
    }

    // Ensure microphone permission is requested up-front (synchronously triggered by user gesture)
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      setError("Microphone permission denied. Please allow mic access and try again.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interimText += event.results[i][0].transcript;
        }
      }
      const combined = (finalText + " " + interimText).trim();
      emit(combined);
    };

    recognition.onerror = (e: any) => {
      const msg = e?.error || "unknown";
      if (msg === "not-allowed" || msg === "service-not-allowed") {
        setError("Microphone blocked. Allow mic access in your browser settings.");
      } else if (msg === "no-speech") {
        setError("No speech detected. Tap and speak clearly.");
      } else if (msg !== "aborted") {
        setError(`Voice error: ${msg}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setIsProcessing(false);
      const finalText = transcriptRef.current.trim();
      if (finalText) onTranscript(finalText);
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      setTranscript("");
      transcriptRef.current = "";
    } catch (err) {
      setError("Couldn't start the microphone. Try again.");
      setIsRecording(false);
    }
  }, [emit, onTranscript]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setIsProcessing(true);
    }
  }, []);

  useEffect(() => () => {
    try { recognitionRef.current?.abort?.(); } catch {}
  }, []);

  return (
    <div className="flex flex-col items-center gap-4" style={{ height: "280px", justifyContent: "center" }}>
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all ${
          isRecording
            ? "gradient-primary glow-primary scale-105"
            : "bg-secondary hover:bg-secondary/80"
        }`}
      >
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full gradient-primary animate-ping opacity-20" />
            <span className="absolute inset-[-8px] rounded-full border-2 border-primary/30 animate-pulse" />
          </>
        )}
        {isProcessing ? (
          <Loader2 size={36} className="text-foreground animate-spin" />
        ) : isRecording ? (
          <Square size={32} className="text-primary-foreground" />
        ) : (
          <Mic size={36} className="text-foreground" />
        )}
      </button>

      <div className="text-center px-4">
        {error ? (
          <p className="text-xs font-medium text-destructive flex items-center justify-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        ) : isRecording ? (
          <p className="text-sm font-medium text-primary animate-pulse">Listening… Tap to stop</p>
        ) : isProcessing ? (
          <p className="text-sm text-muted-foreground">Processing…</p>
        ) : (
          <p className="text-sm text-muted-foreground">Tap, speak clearly, then press Solve</p>
        )}
      </div>

      {transcript && (
        <div className="w-full max-w-xs rounded-xl bg-secondary/50 border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Heard</p>
          <p className="text-sm font-mono text-foreground">{transcript}</p>
        </div>
      )}
    </div>
  );
};

export default VoiceInput;
