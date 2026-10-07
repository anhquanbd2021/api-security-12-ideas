import { expect, test } from "./fixtures.js";

const frameworks = ["Express", "NestJS"] as const;
const select = async (page: import("@playwright/test").Page, framework: string, identity: string, scenario: string) => {
  await page.locator("#framework").selectOption({ label: framework });
  await page.locator("#identity").selectOption({ label: identity });
  await page.locator("#scenario").selectOption({ label: scenario });
  await page.getByRole("button", { name: "Run scenario" }).click();
  await expect(page.locator("#output")).not.toHaveText("Running security checks…");
  return page.locator("#output").innerText();
};

test.describe("public browser demo", () => {
  test("@smoke renders controls and static assets", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("API Security Lab");
    await expect(page.getByText("Educational simulator.")).toBeVisible();
    await expect(page.locator("#framework")).toHaveValue("express");
    await expect(page.locator("#identity")).toContainText("Alice");
    await expect(page.locator("#identity")).toContainText("Expired token");
    await expect(page.locator("#scenario")).toContainText("Replay payment");
    await expect(page.locator("#case-catalog option")).toHaveCount(35);
    await expect(page.locator("#output")).toContainText("accepts valid tokens and rejects expired or revoked tokens");
    await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Source and tests on GitHub" })).toBeVisible();
  });

  test("@smoke guide filters controls and deep-links to a lab preset", async ({ page }) => {
    await page.goto("/guide.html");
    await expect(page).toHaveTitle("API Security Guide");
    await expect(page.locator(".control")).toHaveCount(12);
    await expect(page.locator(".control:visible")).toHaveCount(12);

    await page.getByRole("button", { name: "Identity" }).click();
    await expect(page.locator(".control:visible")).toHaveCount(3);
    await page.getByLabel("Search controls").fill("authorization");
    await expect(page.locator(".control:visible")).toHaveCount(1);
    await expect(page.getByText("1 of 12 controls shown")).toBeVisible();

    await page.getByRole("link", { name: "Try authorization failure" }).click();
    await expect(page).toHaveURL(/framework=express.*identity=alice-token.*scenario=foreign/);
    await expect(page.locator("#framework")).toHaveValue("express");
    await expect(page.locator("#identity")).toHaveValue("alice-token");
    await expect(page.locator("#scenario")).toHaveValue("foreign");
  });

  for (const framework of frameworks) {
    test(`${framework} owned and foreign document scenarios`, async ({ page }) => {
      await page.goto("/");
      const owned = await select(page, framework, "Alice", "Read Alice document");
      expect(owned).toMatch(/^200 OK[\s\S]*Alice notes/);
      const foreign = await select(page, framework, "Alice", "Read Bob document as selected user");
      expect(foreign).toMatch(/^404 Not Found[\s\S]*not_found/);
      const bob = await select(page, framework, "Bob", "Read Bob document as selected user");
      expect(bob).toMatch(/^200 OK[\s\S]*Bob notes/);
    });

    test(`${framework} validates invalid documents and safe failures`, async ({ page }) => {
      await page.goto("/");
      const invalid = await select(page, framework, "Alice", "Create invalid document");
      expect(invalid).toMatch(/^400 Bad Request[\s\S]*Invalid document/);
      const failure = await select(page, framework, "Admin", "Trigger safe error");
      expect(failure).toMatch(/^500 Internal Server Error[\s\S]*Internal server error/);
      expect(failure).not.toMatch(/password|internal-host|stack/i);
    });

    test(`${framework} rejects missing and expired identity`, async ({ page }) => {
      await page.goto("/");
      expect(await select(page, framework, "No token", "Read Alice document")).toMatch(/^401 Unauthorized/);
      expect(await select(page, framework, "Expired token", "Read Alice document")).toMatch(/^401 Unauthorized/);
    });
  }

  test("visualizes every test mode accessibly at narrow width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.locator("#case-catalog").selectOption("sim.identity.timeout");
    await expect(page.locator("#case-mode")).toHaveText("replay");
    await expect(page.locator("#output")).toContainText("Deterministic isolated replay");
    await expect(page.locator("#flow li.blocked")).toHaveCount(1);
    await expect(page.locator("#flow-state")).toHaveText("Blocked safely");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });


  test("replays payment safely", async ({ page }) => {
    await page.goto("/");
    const first = await select(page, "Express", "Alice", "Replay payment");
    expect(first).toMatch(/^201 Created[\s\S]*payment-/);
    const second = await select(page, "Express", "Alice", "Replay payment");
    expect(second).toMatch(/^200 OK[\s\S]*payment-/);
  });
});
