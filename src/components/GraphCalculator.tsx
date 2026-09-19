import { useState } from "react";

export default function GraphCalculator() {
  const [equation, setEquation] = useState("x^2");
  const [equation2, setEquation2] = useState("");
  const [zoom, setZoom] = useState(1);

  const width = 700;
  const height = 400;

  const range = 10 / zoom;

  const xMin = -range;
  const xMax = range;
  const yMin = -range;
  const yMax = range;

  const calculateY = (equationToCalculate: string, x: number) => {
    try {
      if (!equationToCalculate.trim()) {
        return NaN;
      }

      let expression = equationToCalculate
        .toLowerCase()
        .replace(/\^/g, "**")
        .replace(/π/g, "Math.PI")
        .replace(/sin/g, "Math.sin")
        .replace(/cos/g, "Math.cos")
        .replace(/tan/g, "Math.tan")
        .replace(/sqrt/g, "Math.sqrt")
        .replace(/log/g, "Math.log10")
        .replace(/ln/g, "Math.log");

      if (!/^[0-9x+\-*/().\s*a-zA-Z]+$/.test(expression)) {
        return NaN;
      }

      const fn = new Function("x", `return ${expression}`);
      const y = Number(fn(x));

      return Number.isFinite(y) ? y : NaN;
    } catch {
      return NaN;
    }
  };

  const createGraphPoints = (equationToPlot: string) => {
    const points: string[] = [];

    for (let i = 0; i <= 400; i++) {
      const x = xMin + (i / 400) * (xMax - xMin);
      const y = calculateY(equationToPlot, x);

      if (Number.isFinite(y) && y >= yMin && y <= yMax) {
        const svgX =
          ((x - xMin) / (xMax - xMin)) * width;

        const svgY =
          height -
          ((y - yMin) / (yMax - yMin)) * height;

        points.push(`${svgX},${svgY}`);
      }
    }

    return points;
  };

  const graphPoints1 = createGraphPoints(equation);
  const graphPoints2 = createGraphPoints(equation2);

  const xAxisY =
    height - ((0 - yMin) / (yMax - yMin)) * height;

  const yAxisX =
    ((0 - xMin) / (xMax - xMin)) * width;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 rounded-2xl bg-background border-2 border-border shadow-lg">

      <h2 className="text-2xl font-bold text-center mb-6 text-foreground">
        Graph Calculator
      </h2>

      {/* Equation 1 */}
      <input
        type="text"
        value={equation}
        onChange={(e) => setEquation(e.target.value)}
        placeholder="Enter equation 1, e.g. x^2"
        className="w-full p-3 mb-3 rounded-lg border-2 border-border bg-background text-foreground"
      />

      {/* Equation 2 */}
      <input
        type="text"
        value={equation2}
        onChange={(e) => setEquation2(e.target.value)}
        placeholder="Enter equation 2 (optional)"
        className="w-full p-3 mb-4 rounded-lg border-2 border-border bg-background text-foreground"
      />

      <p className="text-sm text-muted-foreground mb-4">
        Examples: x^2, x^3, 2*x+3, sin(x), cos(x), sqrt(x)
      </p>

      {/* Zoom Controls */}
      <div className="flex justify-center gap-3 mb-5 flex-wrap">

        <button
          onClick={() =>
            setZoom((z) => Math.max(0.5, z / 1.5))
          }
          className="px-5 py-2 rounded-lg border-2 border-border font-bold text-foreground"
        >
          − Zoom Out
        </button>

        <button
          onClick={() => setZoom(1)}
          className="px-5 py-2 rounded-lg border-2 border-border font-bold text-foreground"
        >
          Reset
        </button>

        <button
          onClick={() =>
            setZoom((z) => Math.min(10, z * 1.5))
          }
          className="px-5 py-2 rounded-lg border-2 border-border font-bold text-foreground"
        >
          + Zoom In
        </button>

      </div>

      {/* Graph */}
      <div className="w-full overflow-x-auto">

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[600px] border-2 border-border rounded-lg bg-background"
        >

          {/* Vertical Grid */}
          {Array.from({ length: 21 }).map((_, i) => {
            const x = (i / 20) * width;

            return (
              <line
                key={`vertical-${i}`}
                x1={x}
                y1={0}
                x2={x}
                y2={height}
                stroke="currentColor"
                opacity="0.12"
              />
            );
          })}

          {/* Horizontal Grid */}
          {Array.from({ length: 21 }).map((_, i) => {
            const y = (i / 20) * height;

            return (
              <line
                key={`horizontal-${i}`}
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke="currentColor"
                opacity="0.12"
              />
            );
          })}

          {/* X Axis */}
          <line
            x1={0}
            y1={xAxisY}
            x2={width}
            y2={xAxisY}
            stroke="currentColor"
            strokeWidth="2"
          />

          {/* Y Axis */}
          <line
            x1={yAxisX}
            y1={0}
            x2={yAxisX}
            y2={height}
            stroke="currentColor"
            strokeWidth="2"
          />

          {/* X Axis Numbers */}
          {Array.from({ length: 21 }).map((_, i) => {
            const value = i - 10;

            const x =
              ((value - xMin) / (xMax - xMin)) * width;

            return (
              <text
                key={`x-number-${value}`}
                x={x}
                y={xAxisY + 18}
                textAnchor="middle"
                fontSize="12"
                fill="currentColor"
                opacity="0.8"
              >
                {value}
              </text>
            );
          })}

          {/* Y Axis Numbers */}
          {Array.from({ length: 21 }).map((_, i) => {
            const value = 10 - i;

            const y =
              height -
              ((value - yMin) / (yMax - yMin)) * height;

            if (value === 0) {
              return null;
            }

            return (
              <text
                key={`y-number-${value}`}
                x={yAxisX - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="currentColor"
                opacity="0.8"
              >
                {value}
              </text>
            );
          })}

          {/* Equation 1 Graph */}
          <polyline
            points={graphPoints1.join(" ")}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
          />

          {/* Equation 2 Graph */}
          {equation2.trim() && (
            <polyline
              points={graphPoints2.join(" ")}
              fill="none"
              stroke="#ef4444"
              strokeWidth="3"
            />
          )}

        </svg>

      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap justify-center gap-6 text-sm font-semibold">

        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: "#3b82f6" }}
          />

          <span className="text-foreground">
            y = {equation}
          </span>
        </div>

        {equation2.trim() && (
          <div className="flex items-center gap-2">

            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: "#ef4444" }}
            />

            <span className="text-foreground">
              y = {equation2}
            </span>

          </div>
        )}

      </div>

    </div>
  );
}