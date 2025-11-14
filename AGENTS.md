# Agent Guidelines for Project World

## General Principles

- Be concise. Preserve important meaning but remove fluff, sacrifice grammar for the sake of concision.
- Understand that multiple agents may be working at once, so don't revert if you find changes you didn't make.

## Development Server Management

**IMPORTANT**: Do NOT run `npm run build` during development sessions when the user is watching the dev server. This breaks the running development environment.

The user typically has the development server running via `npm run dev` and is actively watching changes. Running build commands interrupts this workflow.

## Code Formatting

- Lean towards self-documenting code, but add comments where necessary.
- When refactoring code don't leave behind a comment (e.g. "// This code now lives in ...").
- When adding comments, if it's a simple one-liner, use inline comments with no full stop.
- Prefer single line returns when the line is less than our max line length.
- You can run `bun run fix` across the project to format/lint files; no need to ask for confirmation first.

## Component Usage

### Button Component

Use the `Button` component from `@/components/ui/button` instead of hardcoded anchor/button elements. Use `asChild` prop for link functionality:

```tsx
<Button asChild size="lg">
  <a href="/login">Get Started</a>
</Button>
```

- Buttons already manage spacing between children. When adding icons, rely on the button's layout instead of adding extra margin classes to the icon.

### Loading States

Use the shared `IsLoading` component from `@/components/ui/is-loading` for any loading indicator in buttons or displays instead of hardcoded ellipses (`...`).

## Testing Changes

When making styling changes, the user will see them in real-time via the dev server. No need to run build commands to verify changes work.

## Database Migrations

IMPORTANT: This section must be followed strictly.

- Never edit previously generated migrations, assume they have already been ran.
- Always generate schema changes with Prisma using `prisma migrate dev` (example: `bunx prisma migrate dev --name add_feature_x`).
- Never run `prisma db push`, `prisma migrate reset`, or any other destructive Prisma commands unless the user explicitly instructs you to.
