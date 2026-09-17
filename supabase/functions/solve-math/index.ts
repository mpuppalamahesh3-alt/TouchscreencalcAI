import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const parseJsonFromModel = (content: string) => {
  const cleaned = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const raw = match ? match[0] : cleaned;
  try {
    return JSON.parse(raw);
  } catch {
    // Escape stray backslashes (e.g. \sqrt -> \\sqrt) that break JSON
    const fixed = raw.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    return JSON.parse(fixed);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, text, recognizeOnly } = await req.json();

    if (!image && !text) {
      return new Response(JSON.stringify({ error: "No input provided" }), { status: 400, headers: jsonHeaders });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let messages: any[] = [];

    // Detect if the question likely needs a long/complex answer
    const t = (text || "").toString();
    const isLong = t.length > 80 ||
      /\b(prove|derive|explain|why|how|table|list|steps?|integrate|differentiate|matrix|theorem|all\s+\w+|formul[ae])\b/i.test(t);

    if (recognizeOnly) {
      const userContent: any[] = [];
      if (image) userContent.push({ type: "image_url", image_url: { url: image } });
      userContent.push({
        type: "text",
        text: "Transcribe the complete handwritten math question exactly as visible. Preserve every operator, number, variable, bracket, exponent and equality sign (for example: 2^2, √x, x/y, +, −, =). Do not correct, rewrite, simplify, or solve it. Random strokes or content without a coherent math question must be empty. Respond ONLY JSON: {\"recognizedText\":\"...\"}.",
      });
      messages = [
        { role: "system", content: "Transcribe handwritten math accurately and quickly." },
        { role: "user", content: userContent },
      ];
    } else {
      const userContent: any[] = [];
      if (image) userContent.push({ type: "image_url", image_url: { url: image } });
      userContent.push({
        type: "text",
        text: text
          ? `Read the image carefully and solve only the coherent math problem actually visible. A preliminary transcription hint is: ${text}. The hint may contain recognition mistakes, so the image is the source of truth. Return the exact question as visible in "expression" without rewriting it.`
          : "Read every visible symbol in the image carefully, identify the complete problem, solve it, and verify the final answer.",
      });
      messages = [
        {
          role: "system",
          content: `You are InkCalc — an advanced, hyper-accurate math, science & engineering solver. You handle all levels: school, Intermediate (11th/12th), Diploma, and B.Tech engineering (Engineering Mathematics I-IV, Calculus, Linear Algebra, Differential Equations, Complex Analysis, Probability & Statistics, Numerical Methods, Discrete Math, Transforms — Laplace/Fourier/Z, Vector Calculus, PDEs, Physics, Chemistry, Mechanics, EMFT, Signals, Circuits, Thermodynamics). Behave like a precise calculator + expert tutor.

Strict rules:
1. Pure arithmetic / simple math: return ONLY the exact final answer in "result", steps=[]. Instant, no explanation.
2. Multi-step problems (algebra, calculus, ODE/PDE, matrices, integrals, series, physics, chemistry, engineering): concise numbered steps in "steps" (max 6, one line each) + final answer in "result". Verify each step.
3. Theory / definition / "what is" / "explain" / "state": clear complete answer in "result", steps=[]. Include key formula if relevant.
4. Formula requests ("formula of / for X", "list formulas of chapter Y"): put every relevant formula in "result" separated by newlines. If a specific value is also asked, solve it too.
5. Tables ("table of N"): full multiplication table in "result" with newlines. steps=[].
6. Image/handwritten input: read carefully, then apply rules 1-5 based on problem type.
7. Off-topic, nonsense, random scribbles, unusual/non-academic input, or anything that is not a coherent math/science/engineering question: reply EXACTLY {"expression":"Invalid","steps":[],"result":"❌ Invalid question"} — nothing more.
8. NEVER guess or fabricate missing symbols. If the image or handwriting is unreadable, ambiguous, incomplete, or not a coherent question, use the exact Invalid response from rule 7.
9. Preserve the user's question exactly in "expression". Do not paraphrase, normalize, simplify, translate, or replace their wording or notation.
10. ALWAYS valid JSON ONLY: {"expression":"<exact user question>","steps":["..."],"result":"<answer>"}
11. No markdown, no code fences, NO LaTeX commands (no \\sqrt, \\frac, \\int). Use plain unicode: √, ∫, ∑, ∏, ÷, ×, ², ³, π, θ, ∞, ≈, ≤, ≥, ∂. Inside JSON strings, escape any backslash as \\\\.`,
        },
        { role: "user", content: image ? userContent : `Solve: ${text}` },
      ];
    }

    // Pick model by task: fast lite for OCR & simple text, stronger flash for images & complex problems
    const model = recognizeOnly
      ? "google/gemini-3.1-flash-lite"
      : (image || isLong)
        ? "google/gemini-3.5-flash"
        : "google/gemini-3.1-flash-lite";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: recognizeOnly ? 160 : (image || isLong ? 1200 : 320),
        temperature: 0,
        top_p: 0.9,
        reasoning: { effort: "none" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        // Tell client to retry quickly and silently
        return new Response(
          JSON.stringify({
            expression: text || "",
            steps: [],
            result: "",
            recognizedText: "",
            rateLimited: true,
            retryAfterMs: 1500,
            error: "Busy, retrying...",
          }),
          { headers: jsonHeaders }
        );
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: jsonHeaders });
      }
      const msg = await response.text();
      console.error("AI error:", response.status, msg);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const parsed = parseJsonFromModel(content);
      if (recognizeOnly) {
        return new Response(JSON.stringify({ recognizedText: String(parsed.recognizedText || parsed.expression || parsed.result || "").trim() }), { headers: jsonHeaders });
      }
      const rawResult = String(parsed.result || "").trim();
      const invalid = /(?:could not read|cannot read|unreadable|unclear|ambiguous|invalid question|not (?:a )?(?:valid|math)|no (?:valid|coherent) (?:problem|question))/i.test(rawResult);
      const result = invalid ? "❌ Invalid question" : rawResult;
      if (!result) {
        return new Response(JSON.stringify({
          expression: parsed.expression || text || "Image input",
          steps: [],
          result: "❌ Invalid question",
        }), { headers: jsonHeaders });
      }
      return new Response(JSON.stringify({
        expression: parsed.expression || text || "Image input",
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        result,
      }), { headers: jsonHeaders });
    } catch {
      if (recognizeOnly) return new Response(JSON.stringify({ recognizedText: content.trim() }), { headers: jsonHeaders });
      return new Response(JSON.stringify({ expression: text || "Image input", steps: [], result: content.trim() }), { headers: jsonHeaders });
    }
  } catch (error) {
    console.error("solve-math error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: jsonHeaders });
  }
});
