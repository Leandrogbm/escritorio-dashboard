import React from "react";
import { COLORS } from "../lib/theme.js";

export default function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-lg p-5 ${className}`}
      style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, ...style }}
    >
      {children}
    </div>
  );
}
