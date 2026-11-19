/**
 * Static brand mark: a stylized "node-graph cube" — an isometric cube whose
 * edges terminate in cream nodes, referencing the tRPC → MCP hop.
 * Used in the nav, footer, and as the reduced-motion / no-WebGL fallback
 * for the 3D logo.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" role="presentation">
      <polygon points="32,10 51,21 32,32 13,21" fill="#E4314B" />
      <polygon points="13,21 32,32 32,54 13,43" fill="#C8102E" />
      <polygon points="51,21 51,43 32,54 32,32" fill="#8E0B20" />
      <path
        d="M13 21 L32 32 L51 21 M32 32 L32 54"
        stroke="#FFF8EE"
        strokeWidth="1.5"
        fill="none"
        opacity="0.85"
      />
      <circle cx="32" cy="10" r="3.2" fill="#FFF8EE" />
      <circle cx="51" cy="43" r="3.2" fill="#FFF8EE" />
      <circle cx="13" cy="43" r="3.2" fill="#FFF8EE" />
      <circle cx="32" cy="32" r="2.2" fill="#FFF8EE" />
    </svg>
  );
}
