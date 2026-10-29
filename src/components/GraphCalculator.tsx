
import { useMemo, useState } from "react";
import { evaluate } from "mathjs";

export default function GraphCalculator() {
  const [equation, setEquation] = useState("x^2");
  const [equation2, setEquation2] = useState("");
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");

  const width = 700;
  const height = 400;
  const range = 10 / zoom;

  const xMin = -range;
  const xMax = range;
  const yMin = -range;
  const yMax = range;

  const gridSize = 120;

  const safeEvaluate = (
    expression: string,
    x: number,
    y = 0
  ): number => {
    try {
      const result = evaluate(expression, {
        x,
        y,
        pi: Math.PI,
        e: Math.E,
      });

      return typeof result === "number" && Number.isFinite(result)
        ? result
        : NaN;
    } catch {
      return NaN;
    }
  };

  const normalize = (input: string) => {
    let text = input.trim().toLowerCase();
    text = text.replace(/π/g, "pi");
    text = text.replace(/×/g, "*").replace(/÷/g, "/");
    text = text.replace(/\bln\(/g, "log(");
    return text;
  };

  const toScreenX = (x: number) =>
    ((x - xMin) / (xMax - xMin)) * width;

  const toScreenY = (y: number) =>
    height - ((y - yMin) / (yMax - yMin)) * height;

  const makeExplicitPath = (input: string) => {
    let expression = normalize(input);
    if (!expression) return "";

    if (expression.includes("=")) {
      const parts = expression.split("=");
      if (parts.length !== 2) return "";

      const left = parts[0].trim();
      const right = parts[1].trim();

      if (left === "y") {
        expression = right;
      } else if (right === "y") {
        expression = left;
      } else {
        return "";
      }
    }

    if (!expression.includes("x") &&
        !/^(sin|cos|tan|sqrt|log|abs|exp)\(/.test(expression)) {
      // Constant expressions are valid horizontal lines.
    }

    const segments: string[] = [];
    let current: string[] = [];

    for (let i = 0; i <= 1400; i++) {
      const x = xMin + (i / 1400) * (xMax - xMin);
      const y = safeEvaluate(expression, x);

      if (Number.isFinite(y) && y >= yMin && y <= yMax) {
        current.push(`${toScreenX(x)},${toScreenY(y)}`);
      } else {
        if (current.length > 1) {
          segments.push(`M ${current.join(" L ")}`);
        }
        current = [];
      }
    }

    if (current.length > 1) {
      segments.push(`M ${current.join(" L ")}`);
    }

    return segments.join(" ");
  };

  // Draw implicit equations such as x^2 + y^2 = 25
  // using numerical contour sampling.
  const makeImplicitPath = (input: string) => {
    const parts = normalize(input).split("=");

    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      return "";
    }

    const left = parts[0].trim();
    const right = parts[1].trim();

    const field = (x: number, y: number) => {
      const a = safeEvaluate(left, x, y);
      const b = safeEvaluate(right, x, y);
      return Number.isFinite(a) && Number.isFinite(b)
        ? a - b
        : NaN;
    };

    const segments: string[] = [];
    const stepX = (xMax - xMin) / gridSize;
    const stepY = (yMax - yMin) / gridSize;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x0 = xMin + col * stepX;
        const x1 = x0 + stepX;
        const y0 = yMax - row * stepY;
        const y1 = y0 - stepY;

        const corners = [
          { x: x0, y: y0, v: field(x0, y0) },
          { x: x1, y: y0, v: field(x1, y0) },
          { x: x1, y: y1, v: field(x1, y1) },
          { x: x0, y: y1, v: field(x0, y1) },
        ];

        const crossings: { x: number; y: number }[] = [];

        for (let i = 0; i < 4; i++) {
          const a = corners[i];
          const b = corners[(i + 1) % 4];

          if (!Number.isFinite(a.v) || !Number.isFinite(b.v)) {
            continue;
          }

          if ((a.v < 0 && b.v >= 0) ||
              (a.v >= 0 && b.v < 0)) {
            const t = a.v / (a.v - b.v);
            crossings.push({
              x: a.x + t * (b.x - a.x),
              y: a.y + t * (b.y - a.y),
            });
          }
        }

        for (let i = 0; i + 1 < crossings.length; i += 2) {
          const a = crossings[i];
          const b = crossings[i + 1];

          segments.push(
            `M ${toScreenX(a.x)} ${toScreenY(a.y)} ` +
            `L ${toScreenX(b.x)} ${toScreenY(b.y)}`
          );
        }
      }
    }

    return segments.join(" ");
  };

  const createPath = (input: string) => {
    const text = normalize(input);
    if (!text) return "";

    if (text.includes("=")) {
      const parts = text.split("=");
      if (parts.length !== 2) return "";
      if (parts[0].trim() === "y" || parts[1].trim() === "y") {
        return makeExplicitPath(text);
      }
      return makeImplicitPath(text);
    }

    return makeExplicitPath(text);
  };

  const graph1 = useMemo(
    () => createPath(equation),
    [equation, zoom]
  );

  const graph2 = useMemo(
    () => (equation2.trim() ? createPath(equation2) : ""),
    [equation2, zoom]
  );

  const axisX = toScreenX(0);
  const axisY = toScreenY(0);

  const ticks = useMemo(
    () => Array.from({ length: 21 }, (_, i) => -range + (i / 10) * range),
    [range]
  );

  const plotExample = (value: string) => {
    setEquation(value);
    setError("");
  };

  const checkInput = () => {
    if (!equation.trim()) {
      setError("Enter an equation first.");
      return;
    }

    try {
      const test = normalize(equation);
      if (test.includes("=")) {
        const parts = test.split("=");
        if (parts.length !== 2) throw new Error("Invalid equation");
      } else {
        safeEvaluate(test, 1);
      }

      setError(
        graph1
          ? ""
          : "No visible curve found. Check the equation and graph range."
      );
    } catch {
      setError("Invalid equation. Check your symbols and brackets.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl rounded-2xl border-2 border-border bg-background p-4 text-foreground shadow-lg sm:p-6">
      <h2 className="mb-5 text-center text-2xl font-bold">
        Advanced Graph Calculator
      </h2>

      <label className="mb-2 block font-semibold">
        Equation 1
      </label>
      <input
        value={equation}
        onChange={(e) => {
          setEquation(e.target.value);
          setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") checkInput();
        }}
        placeholder="x^2 or x^2 + y^2 = 25"
        className="mb-4 w-full rounded-lg border-2 border-border bg-background p-3 text-foreground"
      />

      <label className="mb-2 block font-semibold">
        Equation 2 (optional)
      </label>
      <input
        value={equation2}
        onChange={(e) => {
          setEquation2(e.target.value);
          setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") checkInput();
        }}
        placeholder="y = 2*x + 1"
        className="mb-4 w-full rounded-lg border-2 border-border bg-background p-3 text-foreground"
      />

      <p className="mb-3 text-sm text-muted-foreground">
        Use * for multiplication, ^ for powers, and parentheses
        where needed. Trigonometric functions use radians.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          "x^2",
          "x^3 - 2*x",
          "sin(x) + cos(2*x)",
          "x^2 + y^2 = 25",
          "x^2 - y^2 = 4",
          "x*y = 4",
        ].map((example) => (
          <button
            key={example}
            onClick={() => plotExample(example)}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => setZoom((z) => Math.max(0.25, z / 1.5))}
          className="rounded-lg border-2 border-border px-4 py-2 font-semibold"
        >
          − Zoom Out
        </button>
        <button
          onClick={() => setZoom(1)}
          className="rounded-lg border-2 border-border px-4 py-2 font-semibold"
        >
          Reset Zoom
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(10, z * 1.5))}
          className="rounded-lg border-2 border-border px-4 py-2 font-semibold"
        >
          + Zoom In
        </button>
        <button
          onClick={checkInput}
          className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white"
        >
          Plot Graph
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-100 p-3 text-red-700">
          {error}
        </p>
      )}

      <div className="w-full overflow-x-auto rounded-lg border-2 border-border">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full min-w-[600px] bg-background"
          role="img"
          aria-label="Equation graph"
        >
          {ticks.map((value, i) => (
            <g key={`grid-${i}`}>
              <line
                x1={toScreenX(value)}
                y1={0}
                x2={toScreenX(value)}
                y2={height}
                stroke="currentColor"
                opacity="0.12"
              />
              <line
                x1={0}
                y1={toScreenY(value)}
                x2={width}
                y2={toScreenY(value)}
                stroke="currentColor"
                opacity="0.12"
              />
              <text
                x={toScreenX(value)}
                y={Math.max(12, Math.min(height - 5, axisY + 17))}
                fontSize="10"
                fill="currentColor"
                textAnchor="middle"
              >
                {Number(value.toFixed(2))}
              </text>
              {Math.abs(value) > 0.0001 && (
                <text
                  x={Math.max(15, Math.min(width - 15, axisX - 7))}
                  y={toScreenY(value) - 4}
                  fontSize="10"
                  fill="currentColor"
                  textAnchor="end"
                >
                  {Number(value.toFixed(2))}
                </text>
              )}
            </g>
          ))}

          <line
            x1={0}
            y1={axisY}
            x2={width}
            y2={axisY}
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1={axisX}
            y1={0}
            x2={axisX}
            y2={height}
            stroke="currentColor"
            strokeWidth="2"
          />

          <text x={width - 18} y={axisY - 8} fill="currentColor" fontSize="13">
            X
          </text>
          <text x={axisX + 8} y={15} fill="currentColor" fontSize="13">
            Y
          </text>

          <path
            d={graph1}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {equation2.trim() && (
            <path
              d={graph2}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-5 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded bg-blue-500" />
          Equation 1: {equation}
        </span>
        {equation2.trim() && (
          <span className="flex items-center gap-2">
            <span className="h-3 w-5 rounded bg-red-500" />
            Equation 2: {equation2}
          </span>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Implicit curves are numerical approximations. Very narrow features,
        singularities, and some complicated intersections may need finer
        sampling. Only two equations can be entered at a time in this version.
      </p>
    </div>
  );
}
