import { svgDataUrl } from "@/lib/utils";

export function createPlaceholderReference(label: string, subtitle: string, accent = "#b026ff") {
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#050507"/>
          <stop offset="100%" stop-color="#1c0828"/>
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="transparent"/>
          <stop offset="50%" stop-color="${accent}"/>
          <stop offset="100%" stop-color="transparent"/>
        </linearGradient>
      </defs>
      <rect width="720" height="1280" fill="url(#bg)" />
      <g opacity="0.45">
        <rect x="48" y="48" width="624" height="1184" rx="28" fill="none" stroke="rgba(255,255,255,0.1)" />
        <rect x="78" y="560" width="564" height="4" fill="url(#beam)" />
        <circle cx="360" cy="312" r="136" fill="none" stroke="${accent}" stroke-width="2" />
        <circle cx="360" cy="312" r="182" fill="none" stroke="rgba(255,255,255,0.12)" stroke-dasharray="14 18" />
      </g>
      <text x="70" y="880" fill="#ffffff" font-size="60" font-family="Arial, sans-serif" letter-spacing="8">${label}</text>
      <text x="70" y="960" fill="rgba(255,255,255,0.7)" font-size="28" font-family="Arial, sans-serif">${subtitle}</text>
    </svg>
  `);
}
