import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Formula {
  name: string;
  formula: string;
}

interface Category {
  title: string;
  icon: string;
  formulas: Formula[];
}

const CATEGORIES: Category[] = [
  {
    title: "Algebra Basics",
    icon: "🔢",
    formulas: [
      { name: "(a+b)²", formula: "a² + 2ab + b²" },
      { name: "(a−b)²", formula: "a² − 2ab + b²" },
      { name: "a² − b²", formula: "(a+b)(a−b)" },
      { name: "(a+b)³", formula: "a³ + 3a²b + 3ab² + b³" },
      { name: "a³ + b³", formula: "(a+b)(a²−ab+b²)" },
      { name: "a³ − b³", formula: "(a−b)(a²+ab+b²)" },
      { name: "Quadratic", formula: "x = (−b ± √(b²−4ac)) / 2a" },
    ],
  },
  {
    title: "Trigonometry",
    icon: "📐",
    formulas: [
      { name: "sin²θ + cos²θ", formula: "= 1" },
      { name: "1 + tan²θ", formula: "= sec²θ" },
      { name: "1 + cot²θ", formula: "= csc²θ" },
      { name: "tan θ", formula: "= sin θ ÷ cos θ" },
      { name: "cot θ", formula: "= cos θ ÷ sin θ" },
      { name: "sec θ", formula: "= 1 ÷ cos θ" },
      { name: "csc θ", formula: "= 1 ÷ sin θ" },
      { name: "sin(A+B)", formula: "= sinA cosB + cosA sinB" },
      { name: "sin(A−B)", formula: "= sinA cosB − cosA sinB" },
      { name: "cos(A+B)", formula: "= cosA cosB − sinA sinB" },
      { name: "cos(A−B)", formula: "= cosA cosB + sinA sinB" },
      { name: "tan(A+B)", formula: "= (tanA + tanB) ÷ (1 − tanA tanB)" },
      { name: "sin 2θ", formula: "= 2 sinθ cosθ" },
      { name: "cos 2θ", formula: "= cos²θ − sin²θ" },
      { name: "tan 2θ", formula: "= 2tanθ ÷ (1 − tan²θ)" },
      { name: "sin(0°)", formula: "= 0" },
      { name: "sin(30°)", formula: "= 1/2" },
      { name: "sin(45°)", formula: "= √2/2" },
      { name: "sin(60°)", formula: "= √3/2" },
      { name: "sin(90°)", formula: "= 1" },
      { name: "cos(30°)", formula: "= √3/2" },
      { name: "cos(45°)", formula: "= √2/2" },
      { name: "cos(60°)", formula: "= 1/2" },
      { name: "tan(30°)", formula: "= 1/√3" },
      { name: "tan(45°)", formula: "= 1" },
      { name: "tan(60°)", formula: "= √3" },
      { name: "Sine Rule", formula: "a/sinA = b/sinB = c/sinC" },
      { name: "Cosine Rule", formula: "c² = a² + b² − 2ab·cosC" },
    ],
  },
  {
    title: "Geometry",
    icon: "📏",
    formulas: [
      { name: "Square Area", formula: "A = a²" },
      { name: "Square Perimeter", formula: "P = 4a" },
      { name: "Rectangle Area", formula: "A = l × b" },
      { name: "Rectangle Perimeter", formula: "P = 2(l + b)" },
      { name: "Triangle Area", formula: "A = ½ × b × h" },
      { name: "Equilateral Triangle", formula: "A = (√3/4)a²" },
      { name: "Circle Area", formula: "A = πr²" },
      { name: "Circle Circumference", formula: "C = 2πr" },
      { name: "Pythagorean", formula: "a² + b² = c²" },
      { name: "Sphere Volume", formula: "V = (4/3)πr³" },
      { name: "Sphere Surface", formula: "S = 4πr²" },
      { name: "Cylinder Volume", formula: "V = πr²h" },
      { name: "Cone Volume", formula: "V = (1/3)πr²h" },
      { name: "Cube Volume", formula: "V = a³" },
    ],
  },
  {
    title: "Calculus",
    icon: "∫",
    formulas: [
      { name: "d/dx (xⁿ)", formula: "= n·xⁿ⁻¹" },
      { name: "d/dx (sin x)", formula: "= cos x" },
      { name: "d/dx (cos x)", formula: "= −sin x" },
      { name: "d/dx (tan x)", formula: "= sec²x" },
      { name: "d/dx (eˣ)", formula: "= eˣ" },
      { name: "d/dx (ln x)", formula: "= 1/x" },
      { name: "∫ xⁿ dx", formula: "= xⁿ⁺¹/(n+1) + C" },
      { name: "∫ sin x dx", formula: "= −cos x + C" },
      { name: "∫ cos x dx", formula: "= sin x + C" },
      { name: "∫ eˣ dx", formula: "= eˣ + C" },
      { name: "∫ 1/x dx", formula: "= ln|x| + C" },
    ],
  },
  {
    title: "Physics",
    icon: "⚛️",
    formulas: [
      { name: "Speed", formula: "v = d/t" },
      { name: "Acceleration", formula: "a = (v−u)/t" },
      { name: "Force", formula: "F = ma" },
      { name: "Momentum", formula: "p = mv" },
      { name: "Kinetic Energy", formula: "KE = ½mv²" },
      { name: "Potential Energy", formula: "PE = mgh" },
      { name: "Work", formula: "W = F·d" },
      { name: "Power", formula: "P = W/t" },
      { name: "Ohm's Law", formula: "V = IR" },
      { name: "Einstein's", formula: "E = mc²" },
    ],
  },
  {
    title: "Multiplication Tables (1-20)",
    icon: "✖️",
    formulas: Array.from({ length: 20 }, (_, i) => {
      const n = i + 1;
      const rows = Array.from({ length: 10 }, (_, j) => `${n} × ${j + 1} = ${n * (j + 1)}`).join("  •  ");
      return { name: `Table of ${n}`, formula: rows };
    }),
  },
];

const FormulaLibrary = () => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const { toast } = useToast();

  const copyFormula = (formula: string) => {
    navigator.clipboard.writeText(formula);
    toast({ title: "Copied!", description: formula });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen size={18} className="text-primary" />
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Formula Library</h2>
      </div>

      {CATEGORIES.map((cat) => (
        <div key={cat.title} className="rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setExpandedCategory(expandedCategory === cat.title ? null : cat.title)}
            className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span>{cat.icon}</span>
              {cat.title}
              <span className="text-[10px] text-muted-foreground font-normal">({cat.formulas.length})</span>
            </span>
            {expandedCategory === cat.title ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {expandedCategory === cat.title && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="p-2 space-y-1 max-h-96 overflow-y-auto scrollbar-none">
                  {cat.formulas.map((f) => {
                    const isLong = f.formula.length > 60;
                    return (
                      <div key={f.name} className={`px-3 py-2.5 rounded-lg bg-background/50 hover:bg-background transition-colors group ${isLong ? "flex flex-col gap-1.5" : "flex items-center justify-between"}`}>
                        <div className={`flex ${isLong ? "items-center justify-between" : "items-center gap-3 flex-1 min-w-0"}`}>
                          <span className={`text-xs font-bold text-primary shrink-0 ${isLong ? "" : "w-28 truncate"}`}>{f.name}</span>
                          {!isLong && (
                            <span className="text-sm font-mono font-semibold text-foreground truncate flex-1">{f.formula}</span>
                          )}
                          {isLong && (
                            <button onClick={() => copyFormula(f.formula)} className="p-1 rounded-lg hover:bg-secondary transition-all">
                              <Copy size={14} className="text-muted-foreground" />
                            </button>
                          )}
                        </div>
                        {isLong && (
                          <div className="text-sm font-mono text-foreground leading-relaxed flex flex-wrap gap-x-3 gap-y-1">
                            {f.formula.split("  •  ").map((row, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-secondary/50 text-xs">{row}</span>
                            ))}
                          </div>
                        )}
                        {!isLong && (
                          <button onClick={() => copyFormula(f.formula)} className="p-1.5 rounded-lg opacity-60 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-secondary transition-all">
                            <Copy size={14} className="text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

export default FormulaLibrary;
