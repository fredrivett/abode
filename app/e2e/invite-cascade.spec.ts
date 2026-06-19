import { expect, test } from "@playwright/test";
import { createAndLogin } from "./helpers/auth";
import { disconnectE2EPrisma, getE2EPrisma } from "./helpers/db";
import {
  deleteAccountViaUI,
  getInviteTokenFromDB,
  sendInviteViaUI,
  signupViaInvite,
} from "./helpers/invite";
import { createUser } from "./helpers/user";

const DEFAULT_PASSWORD = "test-password-123!";

test.afterAll(async () => {
  await disconnectE2EPrisma();
});

test.describe("Invite Cascade Deletion Behavior", () => {
  test.describe.configure({ timeout: 120_000 });

  test("used invite accepted, others marked joined_elsewhere", async ({
    browser,
  }) => {
    // Create two inviters
    const inviterA = await createUser({
      email: "t1-inviter-a@test.local",
      username: "t1_inviter_a",
    });
    const inviterB = await createUser({
      email: "t1-inviter-b@test.local",
      username: "t1_inviter_b",
    });

    const inviteeEmail = "t1-invitee@test.local";

    // Both inviters send invite to the same email
    const { context: ctxA, page: pageA } = await createAndLogin(
      browser,
      inviterA,
    );
    await sendInviteViaUI(pageA, inviteeEmail);

    const { context: ctxB, page: pageB } = await createAndLogin(
      browser,
      inviterB,
    );
    await sendInviteViaUI(pageB, inviteeEmail);

    // Get inviterA's token and sign up via that invite
    const tokenA = await getInviteTokenFromDB(inviterA.id, inviteeEmail);

    const inviteeCtx = await browser.newContext();
    const inviteePage = await inviteeCtx.newPage();
    await signupViaInvite(inviteePage, tokenA, {
      email: inviteeEmail,
      username: "t1_invitee",
      password: DEFAULT_PASSWORD,
    });

    // Verify inviterA sees "accepted" status
    await pageA.goto("/settings/invites");
    await expect(pageA.getByText("@t1_invitee")).toBeVisible();
    await expect(pageA.getByText(/joined .+ ago/)).toBeVisible();

    // Verify inviterB sees "joined_elsewhere"
    await pageB.goto("/settings/invites");
    await expect(pageB.getByText("Joined via another invite")).toBeVisible();

    // Verify inviterB's invites remaining haven't decreased
    await expect(pageB.getByTestId("invites-remaining")).toHaveText("3");

    await ctxA.close();
    await ctxB.close();
    await inviteeCtx.close();
  });

  test("inviter deletes account - invite still works", async ({ browser }) => {
    const inviter = await createUser({
      email: "t2-inviter@test.local",
      username: "t2_inviter",
    });
    const inviteeEmail = "t2-invitee@test.local";

    // Inviter sends invite then deletes their account
    const { context: inviterCtx, page: inviterPage } = await createAndLogin(
      browser,
      inviter,
    );
    await sendInviteViaUI(inviterPage, inviteeEmail);
    const token = await getInviteTokenFromDB(inviter.id, inviteeEmail);

    await deleteAccountViaUI(inviterPage, inviter.password);
    await inviterCtx.close();

    // New user signs up via the invite (inviter is gone)
    const inviteeCtx = await browser.newContext();
    const inviteePage = await inviteeCtx.newPage();

    // The join page should still load (not show error)
    await inviteePage.goto(`/join?token=${token}`);
    await expect(
      inviteePage.getByRole("heading", { name: /create your account/i }),
    ).toBeVisible();

    // Complete signup
    await signupViaInvite(inviteePage, token, {
      email: inviteeEmail,
      username: "t2_invitee",
      password: DEFAULT_PASSWORD,
    });

    // Verify in DB: inviterId is null, status is accepted
    const prisma = getE2EPrisma();
    const invite = await prisma.invite.findUnique({ where: { token } });
    expect(invite).not.toBeNull();
    expect(invite?.inviterId).toBeNull();
    expect(invite?.status).toBe("accepted");

    await inviteeCtx.close();
  });

  test("invited user deletes account - shows User deleted", async ({
    browser,
  }) => {
    const inviter = await createUser({
      email: "t3-inviter@test.local",
      username: "t3_inviter",
    });
    const inviteeEmail = "t3-invitee@test.local";

    // Inviter sends invite
    const { context: inviterCtx, page: inviterPage } = await createAndLogin(
      browser,
      inviter,
    );
    await sendInviteViaUI(inviterPage, inviteeEmail);
    const token = await getInviteTokenFromDB(inviter.id, inviteeEmail);

    // Invitee signs up via invite
    const inviteeCtx = await browser.newContext();
    const inviteePage = await inviteeCtx.newPage();
    await signupViaInvite(inviteePage, token, {
      email: inviteeEmail,
      username: "t3_invitee",
      password: DEFAULT_PASSWORD,
    });

    // Invitee deletes their account
    await deleteAccountViaUI(inviteePage, DEFAULT_PASSWORD);
    await inviteeCtx.close();

    // Inviter checks their sent invites
    await inviterPage.goto("/settings/invites");
    await expect(inviterPage.getByText("User deleted")).toBeVisible();

    await inviterCtx.close();
  });

  test("multiple inviters + invited user deletes", async ({ browser }) => {
    const inviterA = await createUser({
      email: "t4-inviter-a@test.local",
      username: "t4_inviter_a",
    });
    const inviterB = await createUser({
      email: "t4-inviter-b@test.local",
      username: "t4_inviter_b",
    });
    const inviteeEmail = "t4-invitee@test.local";

    // Both inviters send invite to same email
    const { context: ctxA, page: pageA } = await createAndLogin(
      browser,
      inviterA,
    );
    await sendInviteViaUI(pageA, inviteeEmail);

    const { context: ctxB, page: pageB } = await createAndLogin(
      browser,
      inviterB,
    );
    await sendInviteViaUI(pageB, inviteeEmail);

    // Invitee signs up via inviterA's invite
    const tokenA = await getInviteTokenFromDB(inviterA.id, inviteeEmail);
    const inviteeCtx = await browser.newContext();
    const inviteePage = await inviteeCtx.newPage();
    await signupViaInvite(inviteePage, tokenA, {
      email: inviteeEmail,
      username: "t4_invitee",
      password: DEFAULT_PASSWORD,
    });

    // Invitee deletes their account
    await deleteAccountViaUI(inviteePage, DEFAULT_PASSWORD);
    await inviteeCtx.close();

    // InviterA sees: accepted + "User deleted"
    await pageA.goto("/settings/invites");
    await expect(pageA.getByText("User deleted")).toBeVisible();

    // InviterB sees: joined_elsewhere + "Joined (now deleted)"
    await pageB.goto("/settings/invites");
    await expect(pageB.getByText("Joined (now deleted)")).toBeVisible();

    await ctxA.close();
    await ctxB.close();
  });

  test("pending invite stays pending", async ({ browser }) => {
    const inviter = await createUser({
      email: "t5-inviter@test.local",
      username: "t5_inviter",
    });
    const inviteeEmail = "t5-pending@test.local";

    const { context, page } = await createAndLogin(browser, inviter);
    await sendInviteViaUI(page, inviteeEmail);

    // Verify the invite shows as pending
    await page.goto("/settings/invites");
    await expect(page.getByText(inviteeEmail)).toBeVisible();
    await expect(page.getByText(/expires/)).toBeVisible();

    await context.close();
  });

  test("invite count accuracy with joined_elsewhere", async ({ browser }) => {
    const inviterA = await createUser({
      email: "t6-inviter-a@test.local",
      username: "t6_inviter_a",
    });
    const inviterB = await createUser({
      email: "t6-inviter-b@test.local",
      username: "t6_inviter_b",
    });

    const email1 = "t6-invitee-1@test.local";
    const email2 = "t6-invitee-2@test.local";
    const email3 = "t6-invitee-3@test.local";

    // InviterA sends 3 invites (exhausting allocation)
    const { context: ctxA, page: pageA } = await createAndLogin(
      browser,
      inviterA,
    );
    await sendInviteViaUI(pageA, email1);
    await sendInviteViaUI(pageA, email2);
    await sendInviteViaUI(pageA, email3);

    // Verify remaining = 0
    await expect(pageA.getByTestId("invites-remaining")).toHaveText("0");

    // InviterB also invites email2
    const { context: ctxB, page: pageB } = await createAndLogin(
      browser,
      inviterB,
    );
    await sendInviteViaUI(pageB, email2);

    // New user signs up via inviterB's invite for email2
    const tokenB = await getInviteTokenFromDB(inviterB.id, email2);
    const inviteeCtx = await browser.newContext();
    const inviteePage = await inviteeCtx.newPage();
    await signupViaInvite(inviteePage, tokenB, {
      email: email2,
      username: "t6_invitee_2",
      password: DEFAULT_PASSWORD,
    });
    await inviteeCtx.close();

    // InviterA reloads — should now have 1 invite remaining
    // (joined_elsewhere doesn't count toward allocation)
    await pageA.goto("/settings/invites");
    await expect(pageA.getByTestId("invites-remaining")).toHaveText("1");

    // Verify inviterA can send a new invite
    await expect(
      pageA.getByRole("button", { name: /send invite/i }),
    ).toBeVisible();

    await ctxA.close();
    await ctxB.close();
  });

  test("inviter deleted during signup flow", async ({ browser }) => {
    const inviter = await createUser({
      email: "t7-inviter@test.local",
      username: "t7_inviter",
    });
    const inviteeEmail = "t7-invitee@test.local";

    // Inviter sends invite
    const { context: inviterCtx, page: inviterPage } = await createAndLogin(
      browser,
      inviter,
    );
    await sendInviteViaUI(inviterPage, inviteeEmail);
    const token = await getInviteTokenFromDB(inviter.id, inviteeEmail);

    // Invitee starts signup (submits form, email sent) but doesn't confirm yet
    const { clearMailbox } = await import("./helpers/mailpit");
    await clearMailbox(inviteeEmail);

    const inviteeCtx = await browser.newContext();
    const inviteePage = await inviteeCtx.newPage();
    await inviteePage.goto(`/join?token=${token}`);
    await expect(inviteePage.getByLabel(/email/i)).toBeVisible({
      timeout: 10000,
    });

    const usernameInput = inviteePage.getByLabel(/username/i);
    await usernameInput.clear();
    await usernameInput.fill("t7_invitee");
    await expect(inviteePage.getByText("available")).toBeVisible({
      timeout: 5000,
    });
    await inviteePage.getByLabel(/password/i).fill(DEFAULT_PASSWORD);
    await inviteePage.getByRole("button", { name: /create account/i }).click();
    await expect(
      inviteePage.getByRole("heading", { name: /check your email/i }),
    ).toBeVisible({
      timeout: 10000,
    });

    // Now delete the inviter while the invitee hasn't confirmed yet
    await deleteAccountViaUI(inviterPage, inviter.password);
    await inviterCtx.close();

    // Invitee clicks confirmation link
    const { getConfirmationPath } = await import("./helpers/mailpit");
    const confirmPath = await getConfirmationPath(inviteeEmail);
    await inviteePage.goto(confirmPath);

    // Should complete signup successfully
    await expect(inviteePage).toHaveURL("/dashboard", { timeout: 20000 });

    // Verify in DB: inviterId is null, status is accepted
    const prisma = getE2EPrisma();
    const invite = await prisma.invite.findUnique({ where: { token } });
    expect(invite).not.toBeNull();
    expect(invite?.inviterId).toBeNull();
    expect(invite?.status).toBe("accepted");

    await inviteeCtx.close();
  });

  test("revoked invite no longer works", async ({ browser }) => {
    const inviter = await createUser({
      email: "t8-inviter@test.local",
      username: "t8_inviter",
    });
    const inviteeEmail = "t8-revoked@test.local";

    const { context: inviterCtx, page: inviterPage } = await createAndLogin(
      browser,
      inviter,
    );
    await sendInviteViaUI(inviterPage, inviteeEmail);
    const token = await getInviteTokenFromDB(inviter.id, inviteeEmail);

    // Revoke the invite via UI (click trash → confirm)
    await inviterPage.goto("/settings/invites");
    await expect(inviterPage.getByText(inviteeEmail)).toBeVisible();
    // Click the trash icon button on the invite row
    const inviteRow = inviterPage
      .locator("div", {
        hasText: inviteeEmail,
      })
      .first();
    await inviteRow.getByRole("button").last().click();
    // Wait for confirm text to appear, then click the same button again
    await expect(
      inviterPage.getByRole("button", { name: /confirm revoke invite/i }),
    ).toBeVisible();
    await inviterPage
      .getByRole("button", { name: /confirm revoke invite/i })
      .click();
    await expect(inviterPage.getByText("Invite revoked")).toBeVisible({
      timeout: 10000,
    });

    // Verify invite is gone from the list
    await expect(inviterPage.getByText(inviteeEmail)).not.toBeVisible();

    // Try to use the revoked token
    const inviteeCtx = await browser.newContext();
    const inviteePage = await inviteeCtx.newPage();
    await inviteePage.goto(`/join?token=${token}`);

    // Should show invalid invite error
    await expect(
      inviteePage.getByRole("heading", { name: /invalid invite/i }),
    ).toBeVisible();
    await expect(
      inviteePage.getByText(/this invite link is invalid or doesn't exist/i),
    ).toBeVisible();

    await inviterCtx.close();
    await inviteeCtx.close();
  });

  test("UI displays all status types correctly", async ({ browser }) => {
    const inviterA = await createUser({
      email: "t9-inviter-a@test.local",
      username: "t9_inviter_a",
    });
    const inviterB = await createUser({
      email: "t9-inviter-b@test.local",
      username: "t9_inviter_b",
    });

    const emailAccepted = "t9-accepted@test.local";
    const emailJoinedElsewhere = "t9-elsewhere@test.local";
    const emailPending = "t9-pending@test.local";
    const emailExpired = "t9-expired@test.local";

    // InviterA sends 4 invites
    const { context: ctxA, page: pageA } = await createAndLogin(
      browser,
      inviterA,
    );
    // Need extra invite allocation for 4 invites
    const prisma = getE2EPrisma();
    await prisma.user.update({
      where: { id: inviterA.id },
      data: { inviteAllocation: 5 },
    });

    await sendInviteViaUI(pageA, emailAccepted);
    await sendInviteViaUI(pageA, emailJoinedElsewhere);
    await sendInviteViaUI(pageA, emailPending);
    await sendInviteViaUI(pageA, emailExpired);

    // User 1 signs up via inviterA's invite → "accepted"
    const tokenAccepted = await getInviteTokenFromDB(
      inviterA.id,
      emailAccepted,
    );
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await signupViaInvite(page1, tokenAccepted, {
      email: emailAccepted,
      username: "t9_accepted",
      password: DEFAULT_PASSWORD,
    });
    await ctx1.close();

    // InviterB invites emailJoinedElsewhere, user 2 signs up via inviterB → inviterA's becomes "joined_elsewhere"
    const { context: ctxB, page: pageB } = await createAndLogin(
      browser,
      inviterB,
    );
    await sendInviteViaUI(pageB, emailJoinedElsewhere);
    const tokenB = await getInviteTokenFromDB(
      inviterB.id,
      emailJoinedElsewhere,
    );
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await signupViaInvite(page2, tokenB, {
      email: emailJoinedElsewhere,
      username: "t9_elsewhere",
      password: DEFAULT_PASSWORD,
    });
    await ctx2.close();
    await ctxB.close();

    // Set emailExpired invite to past expiry via Prisma
    await prisma.invite.updateMany({
      where: { inviterId: inviterA.id, email: emailExpired },
      data: { expiresAt: new Date("2020-01-01") },
    });

    // Navigate to inviterA's invites page
    await pageA.goto("/settings/invites");

    // Verify "accepted" invite: shows username
    await expect(pageA.getByText("@t9_accepted")).toBeVisible();

    // Verify "joined_elsewhere" invite: shows "Joined via another invite"
    await expect(pageA.getByText("Joined via another invite")).toBeVisible();

    // Verify "pending" invite: shows the email address
    await expect(pageA.getByText(emailPending)).toBeVisible();
    await expect(pageA.getByText(/expires/)).toBeVisible();

    // Verify "expired" invite: shows email and "expired" text
    await expect(pageA.getByText(emailExpired)).toBeVisible();
    await expect(pageA.getByText("expired", { exact: true })).toBeVisible();

    await ctxA.close();
  });
});
