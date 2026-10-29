
/// <reference path="./deno.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const parseJsonFromModel = (content: string): any => {
  const cleaned = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  const raw = match ? match[0] : cleaned;

  try {
    return JSON.parse(raw);
  } catch {
    const fixed = raw.replace(
      /\\(?!["\\/bfnrtu])/g,
      "\\\\",
    );
    return JSON.parse(fixed);
  }
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, text, recognizeOnly } = await req.json();

    if (!image && !text) {
      return new Response(
        JSON.stringify({ error: "No input provided" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let messages: any[] = [];
    const t = (text || "").toString();

    const isLong =
      t.length > 80 ||
      /\b(prove|derive|explain|why|how|table|list|steps?|integrate|differentiate|matrix|theorem|all\s+\w+|formul[ae])\b/i.test(t);

    if (recognizeOnly) {
      const userContent: any[] = [];

      if (image) {
        userContent.push({
          type: "image_url",
          image_url: { url: image },
        });
      }

      userContent.push({
        type: "text",
        text: 'Transcribe the complete handwritten math question exactly as visible. Preserve operators, numbers, variables, brackets, exponents and equality signs. Do not solve or correct it. If no coherent math question is visible, return an empty recognizedText. Respond ONLY with JSON: {"recognizedText":"..."}.',
      });

      messages = [
        {
          role: "system",
          content: "Transcribe handwritten math accurately.",
        },
        { role: "user", content: userContent },
      ];
    } else {
      const userContent: any[] = [];

      if (image) {
        userContent.push({
          type: "image_url",
          image_url: { url: image },
        });
      }

      userContent.push({
        type: "text",
        text: text
          ? `Read the image carefully and solve only the coherent math problem actually visible. Preliminary transcription hint: ${text}. The image is the source of truth if the hint is incorrect. Preserve the exact question in "expression".`
          : "Read every visible symbol carefully, identify the complete problem, solve it, and verify the final answer.",
      });

      messages = [
        {
          role: "system",
          content: `You are Smart Calc, an accurate math, science and engineering solver.

Rules:
1. Simple arithmetic: return only the final answer in result and steps=[].
2. Multi-step problems: provide concise numbered steps (maximum 6) and the final answer.
3. Theory and definitions: provide a clear explanation in result and steps=[].
4. Formula requests: provide relevant formulas.
5. Multiplication table requests: provide the complete table.
6. Carefully read image and handwriting questions.
7. For incoherent or unrelated input, return exactly {"expression":"Invalid","steps":[],"result":"❌ Invalid question"}.
8. Never guess missing symbols. For unreadable or ambiguous questions, return the invalid response.
9. Preserve the user's question in expression.
10. Return valid JSON only, with expression, steps and result.
11. Do not use Markdown or code fences. Prefer Unicode math symbols such as √, ∫, ∑, ÷, ×, ², π, θ, ∞, ≈, ≤ and ≥.`,
        },
        {
          role: "user",
          content: image ? userContent : `Solve: ${text}`,
        },
      ];
    }

    const model = recognizeOnly
      ? "google/gemini-3.1-flash-lite"
      : image || isLong
        ? "google/gemini-3.5-flash"
        : "google/gemini-3.1-flash-lite";

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: recognizeOnly
            ? 160
            : image || isLong
              ? 1200
              : 320,
          temperature: 0,
          top_p: 0.9,
          reasoning: { effort: "none" },
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
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
          { status: 429, headers: jsonHeaders },
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: jsonHeaders },
        );
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
        return new Response(
          JSON.stringify({
            recognizedText: String(
              parsed.recognizedText ||
                parsed.expression ||
                parsed.result ||
                "",
            ).trim(),
          }),
          { headers: jsonHeaders },
        );
      }

      const rawResult = String(parsed.result || "").trim();

      const invalid =
        /(?:could not read|cannot read|unreadable|unclear|ambiguous|invalid question|not (?:a )?(?:valid|math)|no (?:valid|coherent) (?:problem|question))/i.test(rawResult);

      const result = invalid
        ? "❌ Invalid question"
        : rawResult;

      if (!result) {
        return new Response(
          JSON.stringify({
            expression: parsed.expression || text || "Image input",
            steps: [],
            result: "❌ Invalid question",
          }),
          { headers: jsonHeaders },
        );
      }

      return new Response(
        JSON.stringify({
          expression: parsed.expression || text || "Image input",
          steps: Array.isArray(parsed.steps) ? parsed.steps : [],
          result,
        }),
        { headers: jsonHeaders },
      );
    } catch {
      if (recognizeOnly) {
        return new Response(
          JSON.stringify({ recognizedText: content.trim() }),
          { headers: jsonHeaders },
        );
      }

      return new Response(
        JSON.stringify({
          expression: text || "Image input",
          steps: [],
          result: content.trim(),
        }),
        { headers: jsonHeaders },
      );
    }
  } catch (error) {
    console.error("solve-math error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error
          ? error.message
          : "Unknown error",
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
