import { describe, expect, it } from "vitest";
import { CORE_PACKAGE_SMOKE } from "./index.js";

describe("phase 0 pipeline smoke", () => {
  it("module loads and exports", () => {
    expect(CORE_PACKAGE_SMOKE).toBe(true);
  });
});
