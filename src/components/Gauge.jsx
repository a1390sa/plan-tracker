import React from "react";

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx, cy, r, fromAngle, toAngle) {
  const start = polarPoint(cx, cy, r, fromAngle);
  const end = polarPoint(cx, cy, r, toAngle);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
}

export default function Gauge({ value, size = 160 }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const stroke = size * 0.12;
  const r = size / 2 - stroke / 2 - 2;
  const cx = size / 2;
  const cy = size / 2 + stroke / 2;
  const valueAngle = 180 - (v / 100) * 180;
  const color = v >= 90 ? "var(--teal)" : v >= 60 ? "var(--sand)" : "var(--red)";
  const pointer = polarPoint(cx, cy, r, valueAngle);
  const height = cy + stroke;

  return (
    <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
      <path d={arcPath(cx, cy, r, 180, 0)} stroke="#EEF1F0" strokeWidth={stroke} fill="none" strokeLinecap="round" />
      {v > 0 && <path d={arcPath(cx, cy, r, 180, valueAngle)} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" />}
      <circle cx={pointer.x} cy={pointer.y} r={stroke * 0.45} fill={color} stroke="#fff" strokeWidth={2} />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={size * 0.2} fontWeight="700" fill={color}>{Math.round(v)}%</text>
    </svg>
  );
}
