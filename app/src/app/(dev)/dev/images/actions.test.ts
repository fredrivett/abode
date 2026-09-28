import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDesign,
  deleteDesign,
  exportDesignImage,
  saveDesign,
} from "./actions";
import { defaultDesign } from "./design";
import * as files from "./design-files";

vi.mock("./design-files", () => ({
  listDesigns: vi.fn(),
  writeDesign: vi.fn(),
  deleteDesign: vi.fn(),
}));

const design = defaultDesign({
  name: "X header",
  format: "x-header",
  width: 1500,
  height: 500,
});

beforeEach(() => {
  vi.mocked(files.listDesigns).mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("image studio actions", () => {
  it("refuse to run outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const devOnly = { error: "Only available in development" };
    expect(await saveDesign("x-header", design)).toEqual(devOnly);
    expect(await createDesign(design)).toEqual(devOnly);
    expect(await deleteDesign("x-header")).toEqual(devOnly);
    expect(await exportDesignImage("x-header", design, 1)).toEqual(devOnly);
    expect(files.writeDesign).not.toHaveBeenCalled();
    expect(files.deleteDesign).not.toHaveBeenCalled();
  });

  it("reject bad slugs and designs before touching disk", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await saveDesign("../evil", design)).toEqual({
      error: "Invalid design slug",
    });
    expect(await deleteDesign("../evil")).toEqual({
      error: "Invalid design slug",
    });
    expect(await saveDesign("x-header", { name: "x" })).toEqual({
      error: "Invalid design",
    });
    expect(await exportDesignImage("x-header", { name: "x" }, 1)).toEqual({
      error: "Invalid design",
    });
    expect(files.writeDesign).not.toHaveBeenCalled();
    expect(files.deleteDesign).not.toHaveBeenCalled();
  });

  it("saves a valid design", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await saveDesign("x-header", design)).toEqual({ success: true });
    expect(files.writeDesign).toHaveBeenCalledWith({
      slug: "x-header",
      design,
    });
  });

  it("creates under a unique slug derived from the name", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(files.listDesigns).mockResolvedValue([
      { slug: "x-header", design },
    ]);
    expect(await createDesign(design)).toEqual({ slug: "x-header-2" });
    expect(files.writeDesign).toHaveBeenCalledWith({
      slug: "x-header-2",
      design,
    });
  });
});
