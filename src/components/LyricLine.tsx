import { memo } from "react";
import type { Theme } from "../types";

interface LyricLineProps {
  text: string;
  isActive: boolean;
  distance: number;
  theme: Theme;
  fontSize: number;
  lineRef: (el: HTMLDivElement | null) => void;
}

/** Memoized lyric line — only re-renders when props change */
const LyricLine = memo(function LyricLine({
  text,
  isActive,
  distance,
  theme,
  fontSize,
  lineRef,
}: LyricLineProps) {
  const lineOpacity = isActive ? 1 : Math.max(0.25, 1 - distance * 0.15);

  return (
    <div
      ref={lineRef}
      className={`lyra-line ${isActive ? "active" : ""}`}
      style={{
        color: isActive ? theme.highlightColor : theme.textColor,
        fontFamily: theme.fontFamily,
        fontSize: isActive ? fontSize : fontSize * 0.85,
        fontWeight: isActive ? "700" : theme.fontWeight,
        opacity: lineOpacity,
        textShadow: isActive ? theme.textShadow : "none",
        transform: isActive ? "scale(1.05)" : "scale(1)",
        transition: "all 0.35s ease-out",
      }}
    >
      {text || "♪"}
    </div>
  );
});

export default LyricLine;
