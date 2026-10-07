import express from "express";
import { createServer } from "node:http";
import { createHandler } from "../http.js";
export const createExpressApp = () => {
    const app = express();
    app.disable("x-powered-by");
    app.use(createHandler());
    return app;
};
export const createExpressServer = async () => {
    const app = createExpressApp();
    const server = createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string")
        throw new Error("server address unavailable");
    return {
        fetch: (path, init) => fetch(`http://127.0.0.1:${address.port}${path}`, init),
        [Symbol.asyncDispose]: async () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    };
};
