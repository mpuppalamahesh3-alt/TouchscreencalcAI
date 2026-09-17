import { useCallback, useEffect, useRef, useState } from "react";
import getStroke from "perfect-freehand";
import { Maximize2, Minimize2, Undo2, Trash2 } from "lucide-react";
import { exportCanvasForRecognition } from "@/lib/handwriting";

interface DrawingCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onInkChange?: (image: string | null) => void;
  active?: boolean;
  onClear?: () => void;
}

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  points: StrokePoint[];
  tone: string;
  size: number;
  thinning: number;
  smoothing: number;
  streamline: number;
}

const PEN_PRESETS = [
  { label: "Black", tone: "--ink-graphite", size: 4.6, thinning: 0.08, smoothing: 0.6, streamline: 0.42 },
  { label: "Blue", tone: "--ink-blue", size: 4.6, thinning: 0.08, smoothing: 0.6, streamline: 0.42 },
] as const;

const MIN_STROKE_DISTANCE = 2;
// Touch intent: a finger scrolls unless it is clearly writing (held still, or moving sideways).
const TOUCH_HOLD_TO_DRAW_MS = 180;
const TOUCH_SCROLL_SLOP = 6;
const TOUCH_DRAW_SLOP = 7;

const getStrokePath = (points: number[][]) => {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  let path = `M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
  for (let i = 0; i < rest.length; i += 1) {
    const current = rest[i];
    const next = rest[i + 1] ?? first;
    const midX = (current[0] + next[0]) / 2;
    const midY = (current[1] + next[1]) / 2;
    path += ` Q ${current[0].toFixed(2)} ${current[1].toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
  }
  return `${path} Z`;
};

const DrawingCanvas = ({ canvasRef, onInkChange, active = true, onClear }: DrawingCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentStroke = useRef<StrokePoint[]>([]);
  const pointerIdRef = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const strokeCacheRef = useRef<ImageData | null>(null);
  const touchIntentRef = useRef<"idle" | "pending" | "draw" | "scroll">("idle");
  const touchStartRef = useRef({ x: 0, y: 0, at: 0 });
  const touchLastYRef = useRef(0);
  const touchLastTimeRef = useRef(0);
  const touchVelocityRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const momentumRef = useRef<number | null>(null);
  const pendingTouchPointsRef = useRef<StrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activePen, setActivePen] = useState(0);
  const [isMaximized, setIsMaximized] = useState(false);

  const resolveTone = useCallback((token: string) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    return `hsl(${value})`;
  }, []);

  const getPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pressure > 0 ? event.pressure : 0.5,
    };
  }, [canvasRef]);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.beginPath();
      ctx.fillStyle = resolveTone(stroke.tone);
      ctx.arc(p.x, p.y, stroke.size / 4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const outline = getStroke(
      stroke.points.map((p) => [p.x, p.y, p.pressure] as [number, number, number]),
      {
        size: stroke.size,
        thinning: stroke.thinning,
        smoothing: stroke.smoothing,
        streamline: stroke.streamline,
        simulatePressure: false,
        easing: (t) => t * (2 - t),
        start: { taper: 6, cap: true },
        end: { taper: 12, cap: true },
        last: true,
      }
    );

    if (outline.length === 0) return;
    const path = new Path2D(getStrokePath(outline as number[][]));
    ctx.fillStyle = resolveTone(stroke.tone);
    ctx.fill(path);
  }, [resolveTone]);

  const redrawAll = useCallback((allStrokes: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    allStrokes.forEach((stroke) => drawStroke(ctx, stroke));
    strokeCacheRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [canvasRef, drawStroke]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawAll(strokes);
  }, [canvasRef, redrawAll, strokes]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    // Resize after maximize/minimize transition
    const t = window.setTimeout(() => resizeCanvas(), 50);
    return () => window.clearTimeout(t);
  }, [isMaximized, resizeCanvas]);

  // Lock body scroll when maximized
  useEffect(() => {
    if (isMaximized) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [isMaximized]);

  useEffect(() => {
    redrawAll(strokes);
    const canvas = canvasRef.current;
    if (!onInkChange) return;
    onInkChange(strokes.length > 0 && canvas ? exportCanvasForRecognition(canvas) : null);
  }, [canvasRef, onInkChange, redrawAll, strokes]);

  const previewStroke = useCallback((points: StrokePoint[]) => {
    const pen = PEN_PRESETS[activePen];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    if (strokeCacheRef.current) {
      ctx.putImageData(strokeCacheRef.current, 0, 0);
    } else {
      redrawAll(strokes);
    }
    drawStroke(ctx, { points, tone: pen.tone, size: pen.size, thinning: pen.thinning, smoothing: pen.smoothing, streamline: pen.streamline });
  }, [activePen, canvasRef, drawStroke, redrawAll, strokes]);

  const beginStroke = (pointerId: number, point: StrokePoint, target: HTMLCanvasElement) => {
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = pointerId;
    distanceRef.current = 0;
    currentStroke.current = [point];
    try { target.setPointerCapture(pointerId); } catch {}
    setIsDrawing(true);
  };

  const stopMomentum = useCallback(() => {
    if (momentumRef.current !== null) {
      cancelAnimationFrame(momentumRef.current);
      momentumRef.current = null;
    }
  }, []);

  const scrollPage = useCallback((delta: number) => {
    if (delta === 0) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const next = Math.max(0, Math.min(max, window.scrollY + delta));
    window.scrollTo({ top: next, behavior: "instant" as ScrollBehavior });
  }, []);

  const startMomentum = useCallback(() => {
    let velocity = touchVelocityRef.current; // px per ms
    if (Math.abs(velocity) < 0.05) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      scrollPage(velocity * dt);
      velocity *= Math.pow(0.9975, dt * 1.6);
      if (Math.abs(velocity) > 0.02) {
        momentumRef.current = requestAnimationFrame(step);
      } else {
        momentumRef.current = null;
      }
    };
    momentumRef.current = requestAnimationFrame(step);
  }, [scrollPage]);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const commitTouchToDraw = () => {
    clearHoldTimer();
    touchIntentRef.current = "draw";
    currentStroke.current = pendingTouchPointsRef.current;
    pendingTouchPointsRef.current = [];
    distanceRef.current = 0;
    for (let i = 1; i < currentStroke.current.length; i += 1) {
      const a = currentStroke.current[i - 1];
      const b = currentStroke.current[i];
      distanceRef.current += Math.hypot(b.x - a.x, b.y - a.y);
    }
    setIsDrawing(true);
    previewStroke(currentStroke.current);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    if (event.pointerType === "mouse" && event.buttons !== 1) return;
    event.preventDefault();
    stopMomentum();
    const point = getPoint(event);
    if (event.pointerType === "touch" && !isMaximized) {
      if (pointerIdRef.current !== null) return;
      pointerIdRef.current = event.pointerId;
      touchIntentRef.current = "pending";
      touchStartRef.current = { x: event.clientX, y: event.clientY, at: performance.now() };
      touchLastYRef.current = event.clientY;
      touchLastTimeRef.current = performance.now();
      touchVelocityRef.current = 0;
      pendingTouchPointsRef.current = [point];
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
      clearHoldTimer();
      // Hold still briefly => the finger is writing, not swiping.
      holdTimerRef.current = window.setTimeout(() => {
        if (touchIntentRef.current === "pending") commitTouchToDraw();
      }, TOUCH_HOLD_TO_DRAW_MS);
      return;
    }
    beginStroke(event.pointerId, point, event.currentTarget);
    previewStroke(currentStroke.current);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    if (pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    const native = event.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
    const raw = native.getCoalescedEvents?.() ?? [];
    const samples = raw.length > 0 ? raw : [native];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (event.pointerType === "touch" && !isMaximized) {
      const latest = samples[samples.length - 1] ?? native;
      const start = touchStartRef.current;
      const dx = latest.clientX - start.x;
      const dy = latest.clientY - start.y;

      if (touchIntentRef.current === "pending") {
        for (const sample of samples) {
          pendingTouchPointsRef.current.push({
            x: sample.clientX - rect.left,
            y: sample.clientY - rect.top,
            pressure: sample.pressure > 0 ? sample.pressure : 0.5,
          });
        }
        if (Math.abs(dy) >= TOUCH_SCROLL_SLOP && Math.abs(dy) > Math.abs(dx)) {
          // Vertical swipe => page scroll, no ink at all.
          clearHoldTimer();
          touchIntentRef.current = "scroll";
          pendingTouchPointsRef.current = [];
        } else if (Math.abs(dx) >= TOUCH_DRAW_SLOP) {
          commitTouchToDraw();
          return;
        }
      }

      if (touchIntentRef.current === "scroll") {
        const now = performance.now();
        const dt = Math.max(1, now - touchLastTimeRef.current);
        const deltaY = touchLastYRef.current - latest.clientY;
        scrollPage(deltaY);
        const instant = deltaY / dt;
        touchVelocityRef.current = touchVelocityRef.current * 0.7 + instant * 0.3;
        touchLastYRef.current = latest.clientY;
        touchLastTimeRef.current = now;
        return;
      }
      if (touchIntentRef.current === "pending") return;
    }
    if (currentStroke.current.length === 0) return;
    let moved = false;
    for (const sample of samples) {
      const nextPoint = {
        x: sample.clientX - rect.left,
        y: sample.clientY - rect.top,
        pressure: sample.pressure > 0 ? sample.pressure : 0.5,
      };
      const prev = currentStroke.current[currentStroke.current.length - 1];
      const dist = Math.hypot(nextPoint.x - prev.x, nextPoint.y - prev.y);
      if (dist < 0.35) continue;
      distanceRef.current += dist;
      currentStroke.current.push(nextPoint);
      moved = true;
    }
    if (moved) previewStroke(currentStroke.current);
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    if (pointerIdRef.current !== event.pointerId) return;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    clearHoldTimer();
    if (touchIntentRef.current === "pending" || touchIntentRef.current === "scroll") {
      const wasScrolling = touchIntentRef.current === "scroll";
      pointerIdRef.current = null;
      touchIntentRef.current = "idle";
      pendingTouchPointsRef.current = [];
      currentStroke.current = [];
      distanceRef.current = 0;
      setIsDrawing(false);
      if (wasScrolling) startMomentum();
      return;
    }
    touchIntentRef.current = "idle";
    const pen = PEN_PRESETS[activePen];
    const nextStroke = currentStroke.current;
    pointerIdRef.current = null;
    currentStroke.current = [];
    setIsDrawing(false);

    if (distanceRef.current < MIN_STROKE_DISTANCE && nextStroke.length < 2) {
      distanceRef.current = 0;
      redrawAll(strokes);
      return;
    }

    distanceRef.current = 0;
    setStrokes((prev) => [...prev, { points: nextStroke, tone: pen.tone, size: pen.size, thinning: pen.thinning, smoothing: pen.smoothing, streamline: pen.streamline }]);
  };

  const handleUndo = () => setStrokes((prev) => prev.slice(0, -1));
  const handleClear = () => { clearHoldTimer(); stopMomentum(); pointerIdRef.current = null; touchIntentRef.current = "idle"; pendingTouchPointsRef.current = []; currentStroke.current = []; distanceRef.current = 0; setIsDrawing(false); setStrokes([]); onClear?.(); };

  useEffect(() => () => { stopMomentum(); clearHoldTimer(); }, [stopMomentum]);

  return (
    <div className={isMaximized ? "fixed inset-0 z-[300] bg-background flex flex-col gap-2 p-3 pt-[max(env(safe-area-inset-top),0.75rem)]" : "flex flex-col gap-1.5"}>
      <div className="flex w-full items-center gap-1 flex-nowrap overflow-hidden rounded-xl border-2 border-foreground/70 bg-card p-1">
        {PEN_PRESETS.map((pen, index) => (
          <button
            key={pen.label}
            type="button"
            onClick={() => setActivePen(index)}
            aria-label={pen.label}
            title={pen.label}
            className={`flex shrink-0 items-center justify-center h-8 w-8 rounded-lg border-2 transition-all active:scale-95 ${
              activePen === index
                ? "border-foreground bg-foreground shadow-md"
                : "border-border bg-secondary"
            }`}
          >
            <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/40" style={{ backgroundColor: `hsl(var(${pen.tone}))` }} />
          </button>
        ))}

        <span className="mx-0.5 h-6 w-px shrink-0 bg-gradient-to-b from-foreground to-primary" />

        <button
          type="button"
          onClick={() => setIsMaximized((m) => !m)}
          aria-label={isMaximized ? "Minimize" : "Maximize"}
          title={isMaximized ? "Minimize" : "Maximize"}
          className="flex shrink-0 items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground border-2 border-primary active:scale-90 transition-all"
        >
          {isMaximized ? <Minimize2 size={13} strokeWidth={3} /> : <Maximize2 size={13} strokeWidth={3} />}
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            aria-label="Undo"
            title="Undo"
            className="flex shrink-0 items-center gap-1 h-8 px-2 rounded-lg bg-secondary text-foreground border-2 border-border active:scale-95 transition-all text-[10px] font-bold disabled:opacity-30"
          >
            <Undo2 size={13} strokeWidth={3} />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={strokes.length === 0}
            aria-label="Clear"
            title="Clear"
            className="flex shrink-0 items-center gap-1 h-8 px-2 rounded-lg bg-destructive text-destructive-foreground border-2 border-destructive active:scale-95 transition-all text-[10px] font-bold disabled:opacity-30"
          >
            <Trash2 size={13} strokeWidth={3} />
            <span>Clear</span>
          </button>
        </div>
      </div>


      <div className="flex gap-1.5 w-full" style={isMaximized ? { flex: 1, minHeight: 0 } : undefined}>
        <div
          ref={containerRef}
          className="relative flex-1 min-w-0 overflow-hidden rounded-2xl border-2 border-border canvas-paper input-glow"
          style={isMaximized ? { minHeight: 0 } : { minHeight: "calc(100svh - 290px)", height: "100%" }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair will-change-transform" style={{ touchAction: "none", pointerEvents: active ? "auto" : "none" }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishStroke} onPointerCancel={finishStroke} />
          {strokes.length === 0 && !isDrawing && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-15">
              <span className="text-3xl">✍️</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DrawingCanvas;
