import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Admin pages read every user's data over the owner connection, and a layout
 * can't gate them: Next renders a page without the layouts above it when the
 * client's router state says it already has them. So each admin page awaits
 * requireAdmin() itself, as the first thing its component and its
 * generateMetadata (which runs its own queries) do.
 */
const ADMIN_DIR = join(process.cwd(), "src", "app", "(app)", "admin");

// Admin pages that don't call requireAdmin, on purpose
const EXCEPTIONS: Record<string, string> = {
  "verify/page.tsx":
    "the aal2 step-up that requireAdmin redirects to; checks admin itself and reads no admin data",
};

const GATE = "requireAdmin";
const GATE_MODULE = "@/lib/admin/require-admin";

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false)
  );
}

// `import { requireAdmin } from "@/lib/admin/require-admin"`, not aliased
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

// The body opens with exactly `await requireAdmin();`
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
    }
  }
  if (!hasDefaultExport) {
    problems.push("default export isn't a function declaration");
  }
  return problems;
}

const pages = readdirSync(ADMIN_DIR, { recursive: true, encoding: "utf8" })
  .filter((path) => path === "page.tsx" || path.endsWith(`${sep}page.tsx`))
  .map((path) => path.split(sep).join("/"))
  .sort();

describe("admin pages", () => {
  it("finds the admin pages", () => {
    expect(pages.length).toBeGreaterThan(5);
    expect(pages).toContain("(protected)/users/page.tsx");
  });

  it("only excepts pages that exist", () => {
    expect(pages).toEqual(expect.arrayContaining(Object.keys(EXCEPTIONS)));
  });

  it.each(pages.filter((page) => !(page in EXCEPTIONS)))(
    "%s gates itself with requireAdmin before doing anything else",
    (page) => {
      const source = readFileSync(join(ADMIN_DIR, page), "utf8");
      expect(gateProblems(source)).toEqual([]);
    },
  );
});

describe("gateProblems", () => {
  const IMPORT = `import { requireAdmin } from "@/lib/admin/require-admin";`;

  it("accepts a page and generateMetadata that both open with the gate", () => {
    const source = `${IMPORT}
      export async function generateMetadata() {
        await requireAdmin();
        return { title: await loadTitle() };
      }
      export default async function Page() {
        await requireAdmin();
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
         await requireAdmin();
         return <List rows={rows} />;
       }`,
    ],
    [
      "a gate that isn't awaited",
      `${IMPORT}
       export default async function Page() {
         requireAdmin();
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
         await requireAdmin();
         return null;
       }`,
    ],
    [
      "a gate that is some other function",
      `import { somethingElse as requireAdmin } from "@/lib/admin/auth";
       export default async function Page() {
         await requireAdmin();
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
