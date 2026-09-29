import { describe, expect, test } from "vitest";
import {
  getAdminNotificationEmail,
  getDataExportReadyEmail,
} from "./templates";

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

describe("getDataExportReadyEmail", () => {
  const email = getDataExportReadyEmail({
    itemCount: 12,
    expiresAt: new Date("2026-10-05T14:30:00.000Z"),
  });

  test("links to the export page, never to the archive itself", () => {
    expect(email.text).toContain("/settings/export");
    expect(email.html).toContain("/settings/export");
    expect(email.text).not.toMatch(/\.zip|storage/);
  });

  test("gives the exact expiry, with time and zone", () => {
    expect(email.text).toContain("5 October 2026 at 14:30 UTC");
    expect(email.text).toContain("12 items");
  });

  test("uses the singular for one item", () => {
    const one = getDataExportReadyEmail({
      itemCount: 1,
      expiresAt: new Date(),
    });
    expect(one.text).toContain("1 item,");
  });
});
