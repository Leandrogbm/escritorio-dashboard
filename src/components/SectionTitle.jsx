import React from "react";
import { COLORS } from "../lib/theme.js";

export default function SectionTitle({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center rounded-full p-2.5 shrink-0"
          style={{ background: COLORS.ink }}
        >
          <Icon size={18} color={COLORS.paper} />
        </div>
        <div>
          <h2
            className="text-2xl leading-tight"
            style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600 }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm mt-0.5" style={{ color: COLORS.slate }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
