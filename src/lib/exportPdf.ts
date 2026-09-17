// Handwriting-style PDF export.
// Renders the solution onto ruled-paper canvases with the app's handwriting
// font, then packs the pages into an A4 PDF. Canvas rendering (instead of
// DOM screenshotting) guarantees identical output in every browser.

const PAPER = "#fdfdf7";
const RULE = "#c9dcf5";
const MARGIN_LINE = "#e5808f";
const INK = "#1b3a8f";
const PENCIL = "#41506b";

// A4 at ~110dpi — plenty sharp for text, ~2x faster to rasterise/encode
// than the previous 150dpi sheet, which makes the download near-instant.
const S = 0.66;
const W = Math.round(1240 * S);
const H = Math.round(1754 * S);
const LEFT = Math.round(150 * S);
const RIGHT = Math.round(90 * S);
const TOP = Math.round(140 * S);
const LINE_H = Math.round(56 * S);

export interface HandwritingPdfInput {
  question: string;
  steps: string[];
  answer: string;
  inkImage?: string | null;
}

type Block = { text: string; big?: boolean; muted?: boolean };

const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
};

const newPage = () => {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { alpha: false })!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1.5;
  for (let y = TOP; y < H - 60 * S; y += LINE_H) {
    ctx.beginPath();
    ctx.moveTo(60 * S, y + 8 * S);
    ctx.lineTo(W - RIGHT + 20 * S, y + 8 * S);
    ctx.stroke();
  }
  ctx.strokeStyle = MARGIN_LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(LEFT - 40 * S, 40 * S);
  ctx.lineTo(LEFT - 40 * S, H - 40 * S);
  ctx.stroke();
  return { canvas: c, ctx };
};

const font = (size: number, bold = false) =>
  `${bold ? "700" : "400"} ${Math.round(size * S)}px Kalam, Caveat, cursive`;

// jsPDF is fetched once and cached so repeat downloads skip the module load.
let jsPdfPromise: Promise<typeof import("jspdf")> | null = null;
const loadJsPdf = () => (jsPdfPromise ??= import("jspdf"));

// The handwriting webfont only needs to be resolved once per session.
let fontPromise: Promise<unknown> | null = null;
const loadFont = () =>
  (fontPromise ??= (async () => {
    try {
      await (document as any).fonts?.load?.("400 34px Kalam");
      await (document as any).fonts?.load?.("700 34px Kalam");
    } catch {
      /* font fallback is fine */
    }
  })());

export const exportHandwritingPdf = async (input: HandwritingPdfInput) => {
  // Kick off the PDF library download while fonts resolve — they are independent.
  const jsPdfReady = loadJsPdf();
  await loadFont();

  const maxWidth = W - LEFT - RIGHT;
  const pages: HTMLCanvasElement[] = [];
  let page = newPage();
  let y = TOP;
  pages.push(page.canvas);

  const nextLine = (h = LINE_H) => {
    y += h;
    if (y > H - 130 * S) {
      page = newPage();
      pages.push(page.canvas);
      y = TOP;
    }
  };

  const draw = (text: string, size: number, color: string, bold = false) => {
    page.ctx.font = font(size, bold);
    const lines = wrap(page.ctx, text, maxWidth);
    for (const line of lines) {
      page.ctx.font = font(size, bold);
      page.ctx.fillStyle = color;
      page.ctx.fillText(line, LEFT, y);
      nextLine();
    }
  };

  // Title
  page.ctx.font = font(38, true);
  page.ctx.fillStyle = PENCIL;
  page.ctx.fillText("InkCalc — Solution", LEFT, y);
  nextLine();

  draw(`Question: ${input.question || "—"}`, 34, PENCIL);

  // Optional handwriting snapshot of the drawn question
  if (input.inkImage) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = input.inkImage as string;
      });
      const drawW = maxWidth;
      const drawH = Math.min(520 * S, (img.height / img.width) * drawW);
      if (y + drawH > H - 130 * S) {
        page = newPage();
        pages.push(page.canvas);
        y = TOP;
      }
      page.ctx.drawImage(img, LEFT, y - 30 * S, drawW, drawH);
      y += drawH + LINE_H;
    } catch {
      /* skip snapshot */
    }
  }

  const blocks: Block[] = [
    ...input.steps.map((s) => ({ text: s })),
    ...input.answer
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l, i, arr) => ({ text: l, big: i === arr.length - 1 && l.length <= 70 })),
  ];

  for (const b of blocks) {
    if (b.big) {
      const label = /^(ans|answer)\b/i.test(b.text) ? b.text : `Ans = ${b.text}`;
      draw(label, 44, INK, true);
      page.ctx.strokeStyle = INK;
      page.ctx.lineWidth = 3;
      const wpx = Math.min(maxWidth, page.ctx.measureText(label).width);
      page.ctx.beginPath();
      page.ctx.moveTo(LEFT, y - LINE_H + 12 * S);
      page.ctx.lineTo(LEFT + wpx, y - LINE_H + 12 * S);
      page.ctx.stroke();
    } else {
      draw(b.text, 34, INK);
    }
  }

  const { default: jsPDF } = await jsPdfReady;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  pages.forEach((c, i) => {
    if (i > 0) pdf.addPage();
    pdf.addImage(c, "JPEG", 0, 0, pw, ph, undefined, "FAST");
  });
  pdf.save(`inkcalc-solution-${new Date().toISOString().slice(0, 10)}.pdf`);
};
