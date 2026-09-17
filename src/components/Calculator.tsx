import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calculator as CalcIcon, Delete, History, Trash2 } from "lucide-react";

// iPhone-style keypad layout
const BUTTONS = [
  ["C", "⌫", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["( )", "0", ".", "="],
] as const;

const OP_MAP: Record<string, string> = {
  "÷": "/",
  "×": "*",
  "−": "-",
  "+": "+",
  "^": "**",
};

const OPERATORS = "÷×−+";

const evaluate = (tokens: string): number => {
  const js = tokens
    .split("")
    .map((c) => OP_MAP[c] ?? c)
    .join("")
    .replace(/%/g, "/100");
  // eslint-disable-next-line no-new-func
  return Function('"use strict"; return (' + js + ")")();
};

const format = (value: number) =>
  Number.isFinite(value) ? String(parseFloat(value.toFixed(10))) : "Error";

const Calculator = () => {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<{ expr: string; result: string }[]>([]);

  const live = useMemo(() => {
    if (!expr || result !== null) return "";
    try {
      const value = evaluate(expr);
      return Number.isFinite(value) ? format(value) : "";
    } catch {
      return "";
    }
  }, [expr, result]);

  const press = (btn: string) => {
    if (btn === "C") {
      setExpr("");
      setResult(null);
      return;
    }

    if (btn === "⌫") {
      if (result !== null) {
        setResult(null);
        setExpr("");
        return;
      }
      setExpr((e) => e.slice(0, -1));
      return;
    }

    if (btn === "=") {
      if (!expr) return;
      try {
        const value = evaluate(expr);
        const formatted = format(value);
        setResult(formatted);
        setHistory((h) => [{ expr, result: formatted }, ...h].slice(0, 30));
      } catch {
        setResult("Error");
      }
      return;
    }

    const isOperator = OPERATORS.includes(btn) || btn === "%";

    setExpr((prev) => {
      // Starting fresh after a result: numbers replace it, operators continue from it.
      let base = prev;
      if (result !== null) {
        base = isOperator ? (result === "Error" ? "" : result) : "";
      }

      if (btn === "( )") {
        const open = (base.match(/\(/g) || []).length;
        const close = (base.match(/\)/g) || []).length;
        const lastChar = base.slice(-1);
        const needsClose = open > close && !!lastChar && !OPERATORS.includes(lastChar) && lastChar !== "(";
        return base + (needsClose ? ")" : "(");
      }

      if (isOperator) {
        if (!base) return btn === "−" ? "−" : base;
        const lastChar = base.slice(-1);
        if (OPERATORS.includes(lastChar)) return base.slice(0, -1) + btn;
        return base + btn;
      }

      if (btn === ".") {
        const tail = base.split(/[÷×−+()%]/).pop() ?? "";
        if (tail.includes(".")) return base;
        return base + (tail === "" ? "0." : ".");
      }

      return base + btn;
    });

    if (result !== null) setResult(null);
  };

  const keyClass = (btn: string) => {
    if (btn === "=") return "gradient-primary text-primary-foreground shadow-lg shadow-primary/30 text-3xl";
    if (OPERATORS.includes(btn) || btn === "%" || btn === "( )")
      return "bg-primary/15 text-primary hover:bg-primary/25 text-xl";
    if (btn === "C" || btn === "⌫")
      return "bg-destructive/10 text-destructive hover:bg-destructive/20 text-lg";
    return "bg-secondary/50 text-foreground hover:bg-secondary/80 text-xl";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <CalcIcon size={18} className="text-primary" />
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Calculator</h2>
      </div>

      <div className="rounded-2xl border-2 border-border glass overflow-hidden">
        <div className="px-5 py-5 text-right border-b border-border/60 bg-secondary/20">
          <p className="text-sm text-muted-foreground truncate h-6 font-mono">{expr || " "}</p>
          <p className="text-4xl font-bold text-foreground truncate mt-1 font-mono">
            {result !== null ? result : live || (expr ? "" : "0")}
          </p>
        </div>

        <div className="p-2.5 grid grid-cols-4 gap-2">
          {BUTTONS.flat().map((btn) => (
            <motion.button
              key={btn}
              whileTap={{ scale: 0.92 }}
              onClick={() => press(btn)}
              className={`py-4 rounded-2xl font-bold transition-all flex items-center justify-center leading-none ${keyClass(btn)}`}
            >
              {btn === "⌫" ? <Delete size={20} className="mx-auto" /> : btn}
            </motion.button>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div className="space-y-1.5 rounded-2xl border-2 border-border glass p-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <History size={13} /> History
            </p>
            <button
              type="button"
              onClick={() => setHistory([])}
              className="flex items-center gap-1 text-[11px] font-semibold text-destructive px-2 py-1 rounded-lg hover:bg-destructive/10"
            >
              <Trash2 size={12} /> Clear
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1 scrollbar-none">
            {history.map((h, i) => (
              <button
                key={`${h.expr}-${i}`}
                type="button"
                onClick={() => {
                  setExpr(h.expr);
                  setResult(null);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30 text-sm text-left hover:bg-secondary/60"
              >
                <span className="text-muted-foreground truncate flex-1 font-mono">{h.expr}</span>
                <span className="font-semibold text-foreground ml-2 font-mono">= {h.result}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Calculator;
