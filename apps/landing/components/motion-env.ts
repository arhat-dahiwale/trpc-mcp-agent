/**
 * True when the page should render its fully static variant (single shader
 * frame, SVG logo, no animation loops). Honored via `?motion=static` —
 * used for crawlers, screenshots, and automated visual testing.
 */
export function prefersStaticMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("motion") === "static";
  } catch {
    return false;
  }
}
