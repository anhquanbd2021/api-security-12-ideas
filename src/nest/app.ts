import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { createHandler } from "../http.js";

@Module({})
class DemoModule {}

export const createNestApp = async () => {
  const app = await NestFactory.create(DemoModule, { logger: false });
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  app.getHttpAdapter().getInstance().use(createHandler());
  await app.init();
  return app;
};

export const createNestServer = async () => {
  const app = await createNestApp();
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return {
    fetch: (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${address.port}${path}`, init),
    [Symbol.asyncDispose]: async () => app.close()
  };
};
