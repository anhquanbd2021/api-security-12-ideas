import { createExpressServer } from "../../src/express/app.js";
import { createNestServer } from "../../src/nest/app.js";

export type RunningApp = {
  fetch(path: string, init?: RequestInit): Promise<Response>;
  [Symbol.asyncDispose](): Promise<void>;
};

export const testImplementations: ReadonlyArray<{ name: string; start(): Promise<RunningApp> }> = [
  { name: "Express", start: createExpressServer },
  { name: "NestJS", start: createNestServer }
];
