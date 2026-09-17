import { supabase } from "@/integrations/supabase/client";
import { solveLocally } from "@/lib/localSolver";

export interface SolveMathPayload {
  image?: string;
  text?: string;
  recognizeOnly?: boolean;
}

export interface SolveMathResponse {
  expression?: string;
  steps?: string[];
  result?: string;
  recognizedText?: string;
  rateLimited?: boolean;
  retryAfterMs?: number;
  error?: string;
  offline?: boolean;
}

const isOnline = () => (typeof navigator !== "undefined" ? navigator.onLine : true);

// Local-first solver.
// - Pure text problems: solved 100% locally via mathjs (offline capable).
// - Image / recognizeOnly / explicit "requires AI" fallback: use edge function
//   ONLY if online. Otherwise return an offline-friendly response.
export const invokeSolveMath = async (
  payload: SolveMathPayload,
  options?: { maxRetries?: number; signal?: AbortSignal }
): Promise<SolveMathResponse> => {
  // Text-only path → use the local engine when it can answer confidently.
  // Advanced/theory/word problems fall through to cloud AI when online.
  if (!payload.image && !payload.recognizeOnly && typeof payload.text === "string") {
    const r = solveLocally(payload.text);
    const needsCloud = r.result.startsWith("⚠") || r.result.startsWith("❌");
    if (!needsCloud || !isOnline()) {
      return { expression: r.expression, steps: r.steps, result: r.result, offline: !isOnline() };
    }
  }

  // Image / OCR path — needs cloud AI
  if (!isOnline()) {
    return {
      offline: true,
      expression: payload.text || "",
      steps: [],
      result: payload.recognizeOnly
        ? ""
        : "📷 Photo & handwriting solving needs internet. Please connect and try again, or type your question.",
      recognizedText: "",
    };
  }

  if (options?.signal?.aborted) {
    return { offline: false, expression: "", steps: [], result: "", recognizedText: "" };
  }

  try {
    // Race the network call against explicit user cancellation so Clear/Cancel
    // instantly frees the UI even if the edge function is slow.
    const invokePromise = supabase.functions.invoke("solve-math", { body: payload });
    const raced = options?.signal
      ? await Promise.race([
          invokePromise,
          new Promise<{ data: null; error: Error }>((resolve) => {
            options.signal?.addEventListener(
              "abort",
              () => resolve({ data: null, error: new Error("aborted") }),
              { once: true }
            );
          }),
        ])
      : await invokePromise;

    const { data, error } = raced as { data: unknown; error: Error | null };
    if (error) throw error;
    return (data ?? {}) as SolveMathResponse;
  } catch (err: unknown) {
    const msg = (err as Error)?.message || "";
    if (msg === "aborted" || options?.signal?.aborted) {
      return { offline: false, expression: "", steps: [], result: "", recognizedText: "" };
    }
    return {
      offline: true,
      expression: payload.text || "",
      steps: [],
      result: "⚠ Couldn't reach the AI service. Try again, or type your question for offline solving.",
      recognizedText: "",
    };
  }
};

