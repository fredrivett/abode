/**
 * markdown-to-jsx `input` override for rendered (read-only) note markdown.
 *
 * A checklist item (`- [ ] …`) renders as a native checkbox, which would be
 * clickable — and invalid inside the card's <button>. Swap it for an inert box
 * styled like the editor's checkbox (see `.note-prose` in globals.css), so the
 * card, the detail placeholder and the editor all draw checklists the same.
 * Any other raw-HTML input in a note renders nothing.
 */
export function TaskCheckbox({
  type,
  checked,
}: {
  type?: string;
  checked?: boolean;
}) {
  if (type !== "checkbox") return null;
  return (
    <span aria-hidden data-task-checkbox data-checked={Boolean(checked)} />
  );
}
