var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { createHandler } from "../http.js";
let DemoModule = class DemoModule {
};
DemoModule = __decorate([
    Module({})
], DemoModule);
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
    if (!address || typeof address === "string")
        throw new Error("server address unavailable");
    return {
        fetch: (path, init) => fetch(`http://127.0.0.1:${address.port}${path}`, init),
        [Symbol.asyncDispose]: async () => app.close()
    };
};
