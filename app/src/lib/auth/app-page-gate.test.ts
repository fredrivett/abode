import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * `(app)` pages are the signed-in, invite-only app, and a layout can't gate
 * them: Next renders a page without the layouts above it when the client's
 * router state says it already has them. So each page awaits
 * requireCompletedSignup() itself, as the first thing its component and its
 * generateMetadata (which runs its own queries) do.
 */
const APP_DIR = join(process.cwd(), "src", "app", "(app)");

// `(app)` pages that don't call requireCompletedSignup, on purpose. The whole
// admin subtree is gated by the stricter requireAdmin (which redirects a
// non-admin — including an incomplete-signup account — to /dashboard) and is
// covered by admin-page-gate.test.ts.
const EXCEPTIONS: Record<string, string> = {
  "dev/colors/page.tsx":
    "a client component (can't await a server gate); dev-only static color swatches with no user data, and its layout notFounds in production",
};

// Prefixes whose pages are excepted wholesale, with the reason.
const EXCEPTED_PREFIXES: Record<string, string> = {
  "admin/": "gated by the stricter requireAdmin; see admin-page-gate.test.ts",
};

function isExcepted(page: string): boolean {
  if (page in EXCEPTIONS) return true;
  return Object.keys(EXCEPTED_PREFIXES).some((prefix) =>
    page.startsWith(prefix),
  );
}

const GATE = "requireCompletedSignup";
const GATE_MODULE = "@/lib/auth/require-completed-signup";

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false)
  );
}

// `import { requireCompletedSignup } from "@/lib/auth/require-completed-signup"`, not aliased
function importsGate(file: ts.SourceFile): boolean {
  return file.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement)) return false;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) return false;
    if (statement.moduleSpecifier.text !== GATE_MODULE) return false;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return false;
    return bindings.elements.some(
      (element) => !element.propertyName && element.name.text === GATE,
    );
  });
}

// The body opens with exactly `await requireCompletedSignup();`
function opensWithGate(fn: ts.FunctionDeclaration): boolean {
  const first = fn.body?.statements[0];
  if (!first || !ts.isExpressionStatement(first)) return false;
  if (!ts.isAwaitExpression(first.expression)) return false;
  const call = first.expression.expression;
  return (
    ts.isCallExpression(call) &&
    ts.isIdentifier(call.expression) &&
    call.expression.text === GATE &&
    call.arguments.length === 0
  );
}

/** What stops a page's source from being gated; empty when it is. */
function gateProblems(source: string): string[] {
  const file = ts.createSourceFile(
    "page.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const problems: string[] = [];
  if (!importsGate(file)) {
    problems.push(`doesn't import { ${GATE} } from "${GATE_MODULE}"`);
  }

  let hasDefaultExport = false;
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
      const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
      const name = isDefault ? "default export" : statement.name?.text;
      if (!isDefault && name !== "generateMetadata") continue;
      hasDefaultExport ||= isDefault;
      if (!opensWithGate(statement)) {
        problems.push(`${name} doesn't start with \`await ${GATE}()\``);
      }
    } else if (
      ts.isVariableStatement(statement) &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "generateMetadata",
      )
    ) {
      // An arrow function can skip the gate in ways this scan doesn't read
      problems.push("generateMetadata isn't a function declaration");
    } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      // `export { load as generateMetadata }` and `export * from` can export an
      // entry point without the `export function` this scan reads
      problems.push("exports through an export list or re-export");
    }
  }
  if (!hasDefaultExport) {
    problems.push("default export isn't a function declaration");
  }
  return problems;
}

const pages = readdirSync(APP_DIR, { recursive: true, encoding: "utf8" })
  // Every extension Next accepts for a page, so one can't skip the scan
  .filter((path) => /(^|[\\/])page\.(js|jsx|ts|tsx)$/.test(path))
  .map((path) => path.split(sep).join("/"))
  .sort();

describe("(app) pages", () => {
  it("finds the app pages", () => {
    expect(pages.length).toBeGreaterThan(10);
    expect(pages).toContain("dashboard/page.tsx");
    expect(pages).toContain("settings/account/page.tsx");
  });

  it("only excepts pages that exist", () => {
    expect(pages).toEqual(expect.arrayContaining(Object.keys(EXCEPTIONS)));
    for (const prefix of Object.keys(EXCEPTED_PREFIXES)) {
      expect(pages.some((page) => page.startsWith(prefix))).toBe(true);
    }
  });

  it.each(pages.filter((page) => !isExcepted(page)))(
    "%s gates itself with requireCompletedSignup before doing anything else",
    (page) => {
      const source = readFileSync(join(APP_DIR, page), "utf8");
      expect(gateProblems(source)).toEqual([]);
    },
  );
});

describe("gateProblems", () => {
  const IMPORT = `import { requireCompletedSignup } from "@/lib/auth/require-completed-signup";`;

  it("accepts a page and generateMetadata that both open with the gate", () => {
    const source = `${IMPORT}
      export async function generateMetadata() {
        await requireCompletedSignup();
        return { title: await loadTitle() };
      }
      export default async function Page() {
        await requireCompletedSignup();
        return <List rows={await loadRows()} />;
      }`;
    expect(gateProblems(source)).toEqual([]);
  });

  it.each([
    [
      "no gate at all",
      "export default async function Page() { return <List rows={await loadRows()} />; }",
    ],
    [
      "the gate after a query",
      `${IMPORT}
       export default async function Page() {
         const rows = await loadRows();
         await requireCompletedSignup();
         return <List rows={rows} />;
       }`,
    ],
    [
      "a gate that isn't awaited",
      `${IMPORT}
       export default async function Page() {
         requireCompletedSignup();
         return <List rows={await loadRows()} />;
       }`,
    ],
    [
      "a gated page with an ungated generateMetadata",
      `${IMPORT}
       export async function generateMetadata() {
         return { title: await loadTitle() };
       }
       export default async function Page() {
         await requireCompletedSignup();
         return null;
       }`,
    ],
    [
      "a gate that is some other function",
      `import { somethingElse as requireCompletedSignup } from "@/lib/other";
       export default async function Page() {
         await requireCompletedSignup();
         return null;
       }`,
    ],
    [
      "a generateMetadata exported through an export list",
      `${IMPORT}
       async function generateMetadata() {
         return { title: await loadTitle() };
       }
       export { generateMetadata };
       export default async function Page() {
         await requireCompletedSignup();
         return null;
       }`,
    ],
    [
      "a generateMetadata re-exported from another module",
      `${IMPORT}
       export * from "./metadata";
       export default async function Page() {
         await requireCompletedSignup();
         return null;
       }`,
    ],
    [
      "a default export the scan can't read",
      `${IMPORT}
       const Page = async () => <List rows={await loadRows()} />;
       export default Page;`,
    ],
  ])("rejects %s", (_, source) => {
    expect(gateProblems(source)).not.toEqual([]);
  });
});
