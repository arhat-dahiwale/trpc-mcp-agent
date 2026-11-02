/**
 * Minimal glob matcher for include/exclude patterns over dotted procedure
 * paths ("notes.search", "admin.users.delete").
 *
 * Supported syntax:
 * - `*` matches one path segment (no dots)
 * - `**` matches zero or more segments
 * - anything else is literal
 */

export function pathMatchesGlobs(path: string, globs: readonly string[]): boolean {
  return globs.some((glob) => pathMatchesGlob(path, glob));
}

export function pathMatchesGlob(path: string, glob: string): boolean {
  return globToRegExp(glob).test(path);
}

function globToRegExp(glob: string): RegExp {
  // Collapse consecutive "**" segments ("a.**.**.b" === "a.**.b").
  const segments = glob.split(".").reduce<string[]>((acc, segment) => {
    if (segment === "**" && acc[acc.length - 1] === "**") return acc;
    acc.push(segment);
    return acc;
  }, []);

  let pattern = "^";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i] ?? "";
    const isLast = i === segments.length - 1;

    if (segment === "**") {
      if (isLast) {
        // Trailing "**": zero or more dot-prefixed segments, so "health.**"
        // matches "health", "health.ping", "health.a.b".
        pattern += i === 0 ? ".*" : "(?:\\.[^.]+)*";
        continue;
      }
      if (i === 0) {
        // Leading "**": zero or more "segment + dot" runs, ending exactly
        // where the next segment body starts.
        pattern += "(?:[^.]+\\.)*";
        continue;
      }
      // Mid-path "**": consumes the dot that follows the previous literal,
      // then zero or more "segment + dot" runs.
      pattern += "\\.(?:[^.]+\\.)*";
      continue;
    }

    // Escape regex specials per literal part, then rejoin with wildcards.
    const escaped = segment
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[^.]*");
    // Segments carry their separator as a prefix, except the first and when
    // a mid-path "**" already consumed it.
    if (i > 0 && segments[i - 1] !== "**") pattern += "\\.";
    pattern += escaped;
  }
  return new RegExp(`${pattern}$`);
}
