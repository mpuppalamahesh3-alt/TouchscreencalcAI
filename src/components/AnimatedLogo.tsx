import { motion } from "framer-motion";

interface AnimatedLogoProps {
  size?: number;
  className?: string;
}

/**
 * Animated InkCalc logo — a glowing calculator with an orbiting spark,
 * animated ink stroke underlining "∑", and subtle breathing halo.
 * Pure SVG + framer-motion, no network needed.
 */
const AnimatedLogo = ({ size = 56, className = "" }: AnimatedLogoProps) => {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      role="img"
      aria-label="InkCalc animated logo"
    >
      <defs>
        <linearGradient id="ic-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(215 90% 62%)" />
          <stop offset="100%" stopColor="hsl(195 92% 55%)" />
        </linearGradient>
        <linearGradient id="ic-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(230 30% 12%)" />
          <stop offset="100%" stopColor="hsl(230 40% 8%)" />
        </linearGradient>
        <radialGradient id="ic-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="hsl(215 90% 62%)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="hsl(215 90% 62%)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Breathing halo */}
      <motion.circle
        cx="32"
        cy="32"
        r="30"
        fill="url(#ic-glow)"
        animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Calculator body */}
      <motion.rect
        x="10"
        y="8"
        width="44"
        height="48"
        rx="9"
        fill="url(#ic-body)"
        stroke="hsl(215 90% 72%)"
        strokeWidth="0.8"
        animate={{ y: [8, 7, 8] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Screen */}
      <rect x="15" y="13" width="34" height="14" rx="3" fill="url(#ic-screen)" />

      {/* Animated ink stroke — draws sigma sign */}
      <motion.path
        d="M20 17 L30 17 L22 20 L30 23"
        stroke="hsl(45 95% 65%)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 0.75, 1] }}
      />
      <motion.circle
        cx="44"
        cy="21"
        r="1.5"
        fill="hsl(140 70% 55%)"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />

      {/* Keys grid 3x3 */}
      {Array.from({ length: 9 }).map((_, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = 20 + col * 12;
        const cy = 35 + row * 7;
        const isOp = i === 2 || i === 5 || i === 8;
        return (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r="2.6"
            fill={isOp ? "hsl(45 95% 65%)" : "hsl(230 20% 92%)"}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 2.2, delay: i * 0.12, repeat: Infinity, ease: "easeInOut" }}
          />
        );
      })}

      {/* Orbiting spark */}
      <motion.g
        style={{ originX: "32px", originY: "32px" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="32" cy="4" r="1.8" fill="hsl(45 95% 70%)">
          <animate attributeName="r" values="1.4;2.2;1.4" dur="1.6s" repeatCount="indefinite" />
        </circle>
      </motion.g>
    </motion.svg>
  );
};

export default AnimatedLogo;
