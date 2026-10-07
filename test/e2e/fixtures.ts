import { test as base, expect, request, type APIRequestContext } from "@playwright/test";
import { createPublicServer } from "../../src/server.js";

type Fixtures = { appUrl: string; api: APIRequestContext };

export const test = base.extend<Fixtures>({
  appUrl: async ({}, use) => {
    const remote = process.env.E2E_BASE_URL;
    if (remote) return use(remote.replace(/\/$/, ""));
    await using server = await createPublicServer({ port: 0, host: "127.0.0.1" });
    await use(server.url);
  },
  page: async ({ browser, appUrl }, use) => {
    const context = await browser.newContext({ baseURL: appUrl });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  api: async ({ appUrl }, use) => {
    const context = await request.newContext({ baseURL: appUrl });
    await use(context);
    await context.dispose();
  }
});

export { expect };
