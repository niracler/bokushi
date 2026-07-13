import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

import { load, resolve } from "./extensionless-typescript-loader.mjs";

if (typeof nodeModule.registerHooks === "function") {
    nodeModule.registerHooks({ load, resolve });
} else {
    nodeModule.register("./extensionless-typescript-loader.mjs", import.meta.url);
}

const testEnv = {};
globalThis.__TEST_CLOUDFLARE_ENV__ = testEnv;

const { GET: githubCallback } = await import("../src/pages/api/auth/github/callback.ts");
const { POST: telegramCallback } = await import("../src/pages/api/auth/telegram/callback.ts");

function databaseWithFailedOAuthInsert(sensitiveValue) {
    return {
        prepare(statement) {
            return {
                bind() {
                    return this;
                },
                async first() {
                    return null;
                },
                async run() {
                    if (statement.includes("INSERT OR IGNORE INTO oauth_accounts")) {
                        return { success: false, sensitiveValue };
                    }
                    return { success: true };
                },
            };
        },
    };
}

async function signTelegramAuth(botToken, data) {
    const dataCheckString = Object.entries(data)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
    const encoder = new TextEncoder();
    const secret = await crypto.subtle.digest("SHA-256", encoder.encode(botToken));
    const key = await crypto.subtle.importKey(
        "raw",
        secret,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(dataCheckString));
    return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
    );
}

test("GitHub OAuth does not log the failed database result object", async () => {
    const originalFetch = globalThis.fetch;
    const originalConsoleError = console.error;
    const loggedErrors = [];
    const sensitiveValue = "private database diagnostic";

    Object.assign(testEnv, {
        ADMIN_GITHUB_ID: "999",
        COMMENTS_DB: databaseWithFailedOAuthInsert(sensitiveValue),
        GITHUB_CLIENT_ID: "client-id",
        GITHUB_CLIENT_SECRET: "client-secret",
        SESSIONS: {
            async delete() {},
            async get() {
                return "/";
            },
        },
    });

    globalThis.fetch = async (input) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes("github.com/login/oauth/access_token")) {
            return Response.json({
                access_token: "access-token",
                token_type: "bearer",
                scope: "",
            });
        }
        if (url === "https://api.github.com/user") {
            return Response.json({
                id: 123,
                login: "octocat",
                avatar_url: "https://example.com/avatar.png",
                name: "Octo Cat",
            });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };
    console.error = (...args) => loggedErrors.push(args);

    try {
        const response = await githubCallback({
            request: new Request(
                "https://example.com/api/auth/github/callback?code=code&state=state",
            ),
        });

        assert.equal(response.status, 302);
        assert.deepEqual(loggedErrors, [["Failed to insert GitHub oauth_account"]]);
        assert.doesNotMatch(JSON.stringify(loggedErrors), new RegExp(sensitiveValue));
    } finally {
        globalThis.fetch = originalFetch;
        console.error = originalConsoleError;
    }
});

test("Telegram OAuth does not log the failed database result object", async () => {
    const originalConsoleError = console.error;
    const loggedErrors = [];
    const sensitiveValue = "private Telegram database diagnostic";
    const botToken = "123456:test-token";
    const authData = {
        id: 456,
        first_name: "Test",
        username: "test-user",
        auth_date: Math.floor(Date.now() / 1000),
    };
    const hash = await signTelegramAuth(botToken, authData);

    Object.assign(testEnv, {
        COMMENTS_DB: databaseWithFailedOAuthInsert(sensitiveValue),
        SESSIONS: {},
        TELEGRAM_BOT_TOKEN: botToken,
    });
    console.error = (...args) => loggedErrors.push(args);

    try {
        const response = await telegramCallback({
            request: new Request("https://example.com/api/auth/telegram/callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...authData, hash }),
            }),
        });

        assert.equal(response.status, 500);
        assert.deepEqual(loggedErrors, [["Failed to insert Telegram oauth_account"]]);
        assert.doesNotMatch(JSON.stringify(loggedErrors), new RegExp(sensitiveValue));
    } finally {
        console.error = originalConsoleError;
    }
});
