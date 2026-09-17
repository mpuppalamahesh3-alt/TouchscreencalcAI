export interface QuickSolveResult {
  expression: string;
  steps: string[];
  result: string;
}

const LEADING_PROMPT_PATTERN = /^(what is|calculate|solve|evaluate|find|answer)\s*[:\-]?\s*/i;
const SIMPLE_INPUT_PATTERN = /^[\d\s()+\-*/^.,%√xX÷×=?:]+$/;
const NATIVE_INPUT_PATTERN = /^[\d\s()+\-*/.^%]+$/;

const normalizeExpression = (input: string) => {
  const trimmed = input.trim().replace(/\?+$/, "").replace(LEADING_PROMPT_PATTERN, "").trim();

  if (!trimmed || !/\d/.test(trimmed) || !SIMPLE_INPUT_PATTERN.test(trimmed)) {
    return null;
  }

  const normalized = trimmed
    .replace(/[−–]/g, "-")
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[√]/g, "sqrt")
    .replace(/(\d|\))\s*[xX]\s*(?=\d|\()/g, "$1*")
    .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)")
    .replace(/,/g, ".")
    .replace(/=+$/g, "")
    .trim();

  if (!normalized || /[a-z]/i.test(normalized.replace(/sqrt/gi, ""))) {
    return null;
  }

  return normalized;
};

const toDisplayExpression = (expression: string) =>
  expression.replace(/\*/g, "×").replace(/\//g, "÷");

const toNativeExpression = (expression: string) => expression.replace(/\^/g, "**");

const formatResult = (value: number) => {
  if (!Number.isFinite(value)) return null;
  const normalized = Number(value.toPrecision(14));
  return Number.isInteger(normalized) ? String(normalized) : String(normalized);
};

export const tryQuickSolve = (input: string): QuickSolveResult | null => {
  const normalized = normalizeExpression(input);
  if (!normalized || !NATIVE_INPUT_PATTERN.test(normalized)) return null;

  try {
    const nativeExpression = toNativeExpression(normalized);
    const evaluated = Function(`"use strict"; return (${nativeExpression});`)();
    const numericValue = typeof evaluated === "number" ? evaluated : Number(evaluated);
    const formatted = formatResult(numericValue);

    if (!formatted) {
      return null;
    }

    return {
      expression: toDisplayExpression(normalized),
      steps: [],
      result: formatted,
    };
  } catch {
    return null;
  }
};