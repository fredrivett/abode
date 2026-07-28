import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it } from "vitest";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// A component file is a .tsx that isn't a story or a colocated test
function isComponentFile(name: string): boolean {
  return (
    name.endsWith(".tsx") &&
    !name.endsWith(".stories.tsx") &&
    !name.endsWith(".test.tsx")
  );
}

function getUiComponentAndStoryFiles() {
  const uiDir = path.join(dirname, "..");
  const files = fs.readdirSync(uiDir, { withFileTypes: true });

  const componentFiles: string[] = [];
  const storyFiles: string[] = [];

  files.forEach((file) => {
    if (file.isDirectory()) {
      const subDir = path.join(uiDir, file.name);
      const subFiles = fs.readdirSync(subDir);

      subFiles.forEach((subFile) => {
        if (isComponentFile(subFile)) {
          componentFiles.push(`${file.name}/${subFile}`);
        } else if (subFile.endsWith(".stories.tsx")) {
          storyFiles.push(`${file.name}/${subFile}`);
        }
      });

      return;
    }

    if (isComponentFile(file.name)) {
      componentFiles.push(file.name);
      return;
    }

    if (file.name.endsWith(".stories.tsx")) {
      storyFiles.push(file.name);
    }
  });

  return { componentFiles, storyFiles };
}

describe("Storybook Story Coverage", () => {
  it("should have a story file for every UI component", () => {
    const { componentFiles, storyFiles } = getUiComponentAndStoryFiles();

    const missingStories: string[] = [];

    componentFiles.forEach((componentFile) => {
      const expectedStoryFile = componentFile.replace(".tsx", ".stories.tsx");

      if (!storyFiles.includes(expectedStoryFile)) {
        missingStories.push(componentFile);
      }
    });

    if (missingStories.length > 0) {
      const errorMessage = [
        `Found ${missingStories.length} UI component(s) without corresponding story files:`,
        "",
        ...missingStories.map(
          (file) =>
            `  - ${file} (expected: ${file.replace(".tsx", ".stories.tsx")})`,
        ),
        "",
        "Please create story files for these components to maintain complete Storybook coverage.",
      ].join("\n");

      throw new Error(errorMessage);
    }
  });

  it("should not have orphaned story files", () => {
    const { componentFiles, storyFiles } = getUiComponentAndStoryFiles();

    const orphanedStories: string[] = [];

    storyFiles.forEach((storyFile) => {
      const expectedComponentFile = storyFile.replace(".stories.tsx", ".tsx");

      if (!componentFiles.includes(expectedComponentFile)) {
        orphanedStories.push(storyFile);
      }
    });

    if (orphanedStories.length > 0) {
      const errorMessage = [
        `Found ${orphanedStories.length} orphaned story file(s) without corresponding components:`,
        "",
        ...orphanedStories.map(
          (file) =>
            `  - ${file} (expected component: ${file.replace(".stories.tsx", ".tsx")})`,
        ),
        "",
        "Please remove these story files or create the corresponding components.",
      ].join("\n");

      throw new Error(errorMessage);
    }
  });
});
