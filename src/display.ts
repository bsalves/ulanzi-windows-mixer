import { toPercent } from "./volume.js";

export interface DisplayView {
  title: string;
  percent: number;
  muted: boolean;
  waiting: boolean;
  error?: string;
}

const TITLE_LIMIT = 12;

export function truncateLabel(label: string, limit = TITLE_LIMIT): string {
  const text = label.trim() || "Audio";
  if (text.length <= limit) return text.toUpperCase();
  return `${text.slice(0, limit - 1).toUpperCase()}…`;
}

export function formatPercent(volume: number): string {
  return `${toPercent(volume)}%`;
}

export function formatKeypadText(view: DisplayView): string {
  if (view.error) return "!";
  if (view.waiting) return "...";
  if (view.muted) return "MUTE";
  return formatPercent(view.percent / 100);
}

export function formatEncoderTitle(view: DisplayView): string {
  if (view.error) return view.error;
  if (view.waiting) return "Waiting...";
  if (view.muted) return "MUTED";
  return formatPercent(view.percent / 100);
}

export function volumeBar(percent: number, width = 10): string {
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

export function buildVolumeIconSvg(view: DisplayView): string {
  const label = escapeXml(truncateLabel(view.title));
  const bar = Math.round((Math.max(0, Math.min(100, view.percent)) / 100) * 76);
  const status = view.error
    ? escapeXml(view.error)
    : view.waiting
      ? "Waiting..."
      : view.muted
        ? "MUTED"
        : `${view.percent}%`;
  const barColor = view.muted || view.waiting || view.error ? "#5c6370" : "#00FFE6";
  const speaker = view.muted
    ? `<path d="M28 58 V46 H34 L46 36 V68 L34 58 Z" fill="#8b9099"/>
       <path d="M50 42 L62 62" stroke="#ff6b6b" stroke-width="4" stroke-linecap="round"/>
       <path d="M62 42 L50 62" stroke="#ff6b6b" stroke-width="4" stroke-linecap="round"/>`
    : `<path d="M28 58 V46 H34 L46 36 V68 L34 58 Z" fill="#00FFE6"/>
       <path d="M52 44 q8 6 0 16" fill="none" stroke="#00FFE6" stroke-width="3" stroke-linecap="round"/>
       <path d="M58 40 q12 10 0 24" fill="none" stroke="#00FFE6" stroke-width="3" stroke-linecap="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="14" fill="#14161b"/>
  <text x="50" y="20" text-anchor="middle" fill="#d8d8d8" font-size="11" font-family="Segoe UI, sans-serif" font-weight="700">${label}</text>
  <rect x="12" y="30" width="76" height="10" rx="5" fill="#2a2e36"/>
  <rect x="12" y="30" width="${bar}" height="10" rx="5" fill="${barColor}"/>
  <g transform="translate(10,8)">${speaker}</g>
  <text x="50" y="88" text-anchor="middle" fill="#ffffff" font-size="14" font-family="Segoe UI, sans-serif" font-weight="700">${escapeXml(status)}</text>
</svg>`;
}

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
