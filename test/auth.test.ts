import { describe, it, expect } from "vitest";
import { authorize } from "../src/auth.js";

const TOKEN = "s3cret-token";

describe("authorize", () => {
  it("accepts a correct Bearer token", () => {
    expect(authorize(`Bearer ${TOKEN}`, TOKEN)).toEqual({ ok: true });
  });

  it("rejects a missing Authorization header", () => {
    const r = authorize(undefined, TOKEN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("rejects a wrong token", () => {
    const r = authorize("Bearer nope", TOKEN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("rejects a non-Bearer scheme", () => {
    const r = authorize(`Basic ${TOKEN}`, TOKEN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("fails closed when the server has no token configured", () => {
    // An empty expected token must never authorize anyone.
    const r = authorize(`Bearer `, "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("rejects a token that is a prefix of the expected token", () => {
    const r = authorize(`Bearer ${TOKEN.slice(0, -1)}`, TOKEN);
    expect(r.ok).toBe(false);
  });
});
