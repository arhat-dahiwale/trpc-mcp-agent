import { describe, expect, it } from "vitest";
import { OTEL_PACKAGE_SMOKE } from "./index.js";

describe("phase 0 pipeline smoke", () => {
  it("module loads and exports", () => {
    expect(OTEL_PACKAGE_SMOKE).toBe(true);
  });
});
