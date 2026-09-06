import { test, expect } from "@playwright/test";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, deleteUser } from "firebase/auth";
import { firebaseConfig } from "../src/firebase-config.js";

// End-to-end smoke test against the REAL Firebase project (homie-f7172).
// It proves two things that can only be verified against the live backend:
//   1. Email/Password sign-in is actually enabled in the Firebase console.
//   2. Firestore exists and its rules let a signed-in user read the house doc.
// The account it creates deletes itself at the end of the test.

const password = "homie-e2e-pass-123";

test("sign up, reach the app, then sign in again", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@homie-test.dev`;

  const authErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") authErrors.push(m.text());
  });

  await page.goto("/");

  // --- Sign up -----------------------------------------------------------
  await page.getByText("New here? Create an account").click();
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Landing on the identity picker means Firebase accepted the new account —
  // i.e. the Email/Password provider is enabled. If the form reports an error
  // instead, surface it: the message says exactly what the backend rejected,
  // which is far more useful than a locator timeout.
  const identityGate = page.getByText("WHO'S OPENING THE APP?");
  const formError = page.getByTestId("auth-error");
  await Promise.race([
    identityGate.waitFor({ timeout: 60_000 }).catch(() => {}),
    formError.waitFor({ timeout: 60_000 }).catch(() => {}),
  ]);
  if (await formError.isVisible()) {
    throw new Error(
      `Sign-up rejected: "${await formError.textContent()}"\n` +
        `Firebase errors logged by the page: ${authErrors.join(" | ") || "(none)"}`
    );
  }
  await expect(identityGate).toBeVisible({ timeout: 30_000 });

  // --- Firestore ---------------------------------------------------------
  // Picking an identity renders the app only once the household snapshot
  // arrives, so reaching the Home tab proves the Firestore read succeeded.
  await page.getByRole("button", { name: "Putter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Putter" })).toBeVisible({ timeout: 30_000 });

  // --- Sign out and sign back in ----------------------------------------
  await page.getByRole("button", { name: "Profile" }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page.getByPlaceholder("Email")).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The identity choice lives in localStorage, so this goes straight back into
  // the app — on the tab it was left on (Profile), not Home.
  await expect(page.getByRole("button", { name: "Home" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Home" }).click();
  await expect(page.getByRole("heading", { name: "Putter" })).toBeVisible({ timeout: 30_000 });

  const permissionErrors = authErrors.filter((e) => /permission|insufficient/i.test(e));
  expect(permissionErrors, "Firestore rules rejected a request").toEqual([]);

  // --- Clean up ----------------------------------------------------------
  // Delete the throwaway account so CI runs don't pile up users. A signed-in
  // user can delete itself, so this needs no admin credentials.
  const node = initializeApp(firebaseConfig, `cleanup-${Date.now()}`);
  const cred = await signInWithEmailAndPassword(getAuth(node), email, password);
  await deleteUser(cred.user);
});
