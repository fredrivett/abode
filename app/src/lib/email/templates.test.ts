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
    // ampersand separators are html-escaped for the href attribute
    expect(html).toContain("&amp;body=");
    expect(html).not.toContain("&body=");
  });

  test("uri-significant chars in the recipient are encoded in the mailto", () => {
    const { html } = getAdminNotificationEmail({
      type: "waitlist_signup",
      email: "od#d%y@example.com",
      position: 1,
    });

    // # and % would otherwise break the mailto target / drop the body
    expect(html).toContain("mailto:od%23d%25y@example.com?");
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
