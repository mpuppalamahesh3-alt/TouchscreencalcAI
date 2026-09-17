// Fully offline math solver powered by mathjs.
// Handles arithmetic, algebra, calculus (derivative/integral), matrices,
// complex numbers, unit conversion, equation solving, statistics.

import { create, all, type MathJsInstance } from "mathjs";

const math: MathJsInstance = create(all, {});

export interface LocalResult {
  expression: string;
  steps: string[];
  result: string;
}

const LEADING = /^(what\s+is|calculate|solve|evaluate|find|answer|compute|simplify)\s*[:\-]?\s*/i;

const clean = (s: string) =>
  s
    .trim()
    .replace(/\?+$/, "")
    .replace(LEADING, "")
    .replace(/[×✕✖]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/\^/g, "^")
    .trim();

const formatValue = (v: unknown): string => {
  try {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return String(v);
      const n = Number(v.toPrecision(12));
      return Number.isInteger(n) ? String(n) : String(n);
    }
    if (typeof v === "string") return v;
    if (typeof v === "boolean") return v ? "true" : "false";
    // mathjs types: Fraction, Complex, BigNumber, Matrix, Unit
    return math.format(v as never, { precision: 12 });
  } catch {
    return String(v);
  }
};

// Try to detect an "solve ... = ..." or "solve for x" style problem.
const trySolveEquation = (raw: string): LocalResult | null => {
  const eqMatch = raw.match(/^(?:solve\s+(?:for\s+([a-zA-Z]))?\s*[:\-]?\s*)?(.+?)\s*=\s*(.+)$/i);
  if (!eqMatch) return null;
  const variable = (eqMatch[1] || "x").trim();
  const left = eqMatch[2].trim();
  const right = eqMatch[3].trim();
  try {
    // Move right to left: left - (right) = 0, then symbolic solve via derivative-free numeric.
    const expr = `(${left}) - (${right})`;
    // Try symbolic simplify first
    const simplified = math.simplify(expr).toString();
    // Numeric root search over a range for single-variable equations
    const f = math.compile(simplified);
    const scope: Record<string, number> = {};
    const samples: number[] = [];
    for (let x = -50; x <= 50; x += 0.5) {
      scope[variable] = x;
      try {
        const y = f.evaluate(scope);
        if (typeof y === "number" && Number.isFinite(y)) samples.push(y);
        else samples.push(NaN);
      } catch {
        samples.push(NaN);
      }
    }
    const roots: number[] = [];
    const xs: number[] = [];
    for (let i = -50, k = 0; i <= 50; i += 0.5, k++) xs.push(i);
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i], b = samples[i + 1];
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (a === 0) roots.push(xs[i]);
      else if (a * b < 0) {
        // bisection
        let lo = xs[i], hi = xs[i + 1], flo = a;
        for (let it = 0; it < 60; it++) {
          const mid = (lo + hi) / 2;
          scope[variable] = mid;
          const fm = f.evaluate(scope) as number;
          if (!Number.isFinite(fm)) break;
          if (flo * fm <= 0) { hi = mid; } else { lo = mid; flo = fm; }
        }
        roots.push((lo + hi) / 2);
      }
    }
    // Dedupe close roots
    const unique = roots
      .map((r) => Number(r.toFixed(6)))
      .filter((v, i, a) => a.findIndex((x) => Math.abs(x - v) < 1e-4) === i);
    if (unique.length === 0) return null;
    const rounded = unique.map((r) => {
      const near = Math.round(r);
      return Math.abs(r - near) < 1e-4 ? String(near) : String(Number(r.toPrecision(8)));
    });
    return {
      expression: `${left} = ${right}`,
      steps: [
        `Rearrange: ${simplified} = 0`,
        `Solve for ${variable}`,
      ],
      result: `${variable} = ${rounded.join(", ")}`,
    };
  } catch {
    return null;
  }
};

// Detect calculus keywords
const tryCalculus = (raw: string): LocalResult | null => {
  const dm = raw.match(/^(?:differentiate|derivative\s+of|d\/dx)\s+(.+?)(?:\s+with\s+respect\s+to\s+([a-zA-Z]))?$/i);
  if (dm) {
    const expr = dm[1].trim();
    const v = (dm[2] || "x").trim();
    try {
      const d = math.derivative(expr, v).toString();
      return {
        expression: `d/d${v} [ ${expr} ]`,
        steps: [],
        result: d,
      };
    } catch { /* fallthrough */ }
  }
  const im = raw.match(/^(?:integrate|integral\s+of|∫)\s+(.+?)(?:\s+d([a-zA-Z]))?$/i);
  if (im) {
    // mathjs has no symbolic integrator; do numerical only if bounds given
    // Try definite: "integrate <expr> from A to B"
    const dm2 = raw.match(/^(?:integrate|integral\s+of|∫)\s+(.+?)\s+from\s+(-?\d+\.?\d*)\s+to\s+(-?\d+\.?\d*)(?:\s+d([a-zA-Z]))?$/i);
    if (dm2) {
      try {
        const expr = dm2[1];
        const a = parseFloat(dm2[2]);
        const b = parseFloat(dm2[3]);
        const v = (dm2[4] || "x").trim();
        const f = math.compile(expr);
        // Simpson's rule
        const n = 1000;
        const h = (b - a) / n;
        const scope: Record<string, number> = {};
        let sum = 0;
        for (let i = 0; i <= n; i++) {
          const x = a + i * h;
          scope[v] = x;
          const y = f.evaluate(scope) as number;
          const w = i === 0 || i === n ? 1 : i % 2 === 0 ? 2 : 4;
          sum += w * y;
        }
        const val = (h / 3) * sum;
        return {
          expression: `∫ from ${a} to ${b} of (${expr}) d${v}`,
          steps: [`Numerical integration (Simpson's rule, n=1000)`],
          result: formatValue(Number(val.toPrecision(10))),
        };
      } catch { /* fallthrough */ }
    }
    return {
      expression: raw,
      steps: [],
      result: "Symbolic indefinite integration is not available offline. Provide bounds: 'integrate x^2 from 0 to 2'.",
    };
  }
  const sm = raw.match(/^simplify\s+(.+)$/i);
  if (sm) {
    try {
      const s = math.simplify(sm[1]).toString();
      return { expression: sm[1], steps: [], result: s };
    } catch { /* fallthrough */ }
  }
  return null;
};

const NON_MATH_HINTS = /\b(who|when|where|history|meaning|definition|explain|why|prove|derive|theorem|state|difference|law|principle|write|essay)\b/i;

export const solveLocally = (input: string): LocalResult => {
  const raw = input.trim();
  if (!raw) {
    return { expression: "", steps: [], result: "" };
  }

  const stripped = clean(raw);

  // 1) Direct evaluation (arithmetic, powers, matrices, units, complex)
  try {
    const value = math.evaluate(stripped);
    const out = formatValue(value);
    if (out !== "" && out !== "undefined") {
      return { expression: stripped, steps: [], result: out };
    }
  } catch { /* try other strategies */ }

  // 2) Calculus keywords
  const calc = tryCalculus(stripped);
  if (calc) return calc;

  // 3) Equation solve
  const eq = trySolveEquation(stripped);
  if (eq) return eq;

  // 4) Simplify as a fallback for symbolic expressions
  try {
    const s = math.simplify(stripped).toString();
    if (s && s !== stripped) {
      return { expression: stripped, steps: ["Simplified expression"], result: s };
    }
  } catch { /* ignore */ }

  // 5) Theory/word question — not solvable offline
  if (NON_MATH_HINTS.test(raw)) {
    return {
      expression: raw,
      steps: [],
      result: "⚠ Needs internet AI",
    };
  }

  return {
    expression: raw,
    steps: [],
    result: "❌ Invalid question",
  };
};
