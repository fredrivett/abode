import { describe, expect, test } from "vitest";
import { getAdminNotificationEmail } from "./templates";

describe("getAdminNotificationEmail — waitlist_signup", () => {
  test("email address is a pre-filled mailto invite link", () => {
    const { html } = getAdminNotificationEmail({
      type: "waitlist_signup",
      email: "person@example.com",
      position: 42,
    });

    // clickable mailto to the signup's address
    expect(html).toContain('href="mailto:person@example.com?');
    // pre-filled invite subject + body (url-encoded)
    expect(html).toContain(
      `subject=${encodeURIComponent("just sent you abode access")}`,
    );
    expect(html).toContain(encodeURIComponent("hey [name],"));
    expect(html).toContain(
      encodeURIComponent("thanks for signing up for early access to abode!"),
    );
    // link text is the plain email address
    expect(html).toContain(">person@example.com</a>");
  });

  test("text version still lists the plain email and position", () => {
    const { subject, text } = getAdminNotificationEmail({
      type: "waitlist_signup",
      email: "person@example.com",
      position: 42,
    });

    expect(subject).toBe("[abode] waitlist signup: person@example.com");
    expect(text).toContain("email: person@example.com");
    expect(text).toContain("position: #42");
  });
});
