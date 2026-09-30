import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { normalizeLabel } from "./ui-labels-module";

// Attributes whose literal values are UI copy that autocapture can record
const LABEL_ATTRIBUTES = new Set(["aria-label", "title", "label"]);

const MAX_LABEL_LENGTH = 60;

function isUsableLabel(text: string): boolean {
  return (
    text.length > 0 && text.length <= MAX_LABEL_LENGTH && /\p{L}/u.test(text)
  );
}

/** String literals an expression can evaluate to (`a ? "x" : "y"`, `c && "x"`) */
function literalBranches(node: ts.Expression): string[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [node.text];
  }
  if (ts.isParenthesizedExpression(node))
    return literalBranches(node.expression);
  if (ts.isConditionalExpression(node)) {
    return [
      ...literalBranches(node.whenTrue),
      ...literalBranches(node.whenFalse),
    ];
  }
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  ) {
    return literalBranches(node.right);
  }
  return [];
}

/**
 * Every piece of UI copy written literally in a TSX source: JSX text, string
 * literals rendered as JSX children, and literal aria-label/title/label
 * values. It's in the public source, so recording it reveals nothing a user
 * wrote — unlike text rendered from data, which never appears here.
 */
export function extractLabelsFromSource(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    "file.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const labels: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      labels.push(node.text);
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      labels.push(...literalBranches(node.expression));
    } else if (
      ts.isJsxAttribute(node) &&
      LABEL_ATTRIBUTES.has(node.name.getText(sourceFile)) &&
      node.initializer
    ) {
      if (ts.isStringLiteral(node.initializer)) {
        labels.push(node.initializer.text);
      } else if (
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression
      ) {
        labels.push(...literalBranches(node.initializer.expression));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return labels.map(normalizeLabel).filter(isUsableLabel);
}

const EXCLUDED_FILE = /\.(test|stories)\.tsx$/;

function listTsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listTsxFiles(path);
    return entry.name.endsWith(".tsx") && !EXCLUDED_FILE.test(entry.name)
      ? [path]
      : [];
  });
}

/** Sorted, de-duplicated UI labels across every component under `srcDir` */
export function extractUiLabels(srcDir: string): string[] {
  const labels = new Set<string>();
  for (const file of listTsxFiles(srcDir).sort()) {
    // Dev-only tooling never ships to users
    if (relative(srcDir, file).startsWith(join("app", "(dev)"))) continue;
    for (const label of extractLabelsFromSource(readFileSync(file, "utf8"))) {
      labels.add(label);
    }
  }
  return [...labels].sort();
}
