import { describe, it, expect } from "vitest";
import { gunzipSync } from "node:zlib";
import { encode, decode, PREFIX, ShareFormatError } from "../src/codec.js";
import { type ShareBundle, SCHEMA_VERSION_V1 } from "../src/bundle.js";

const sample: ShareBundle = {
  v: SCHEMA_VERSION_V1,
  kind: "SECTION",
  sectionName: "Inferno prep",
  sectionColorRgb: -1,
  goals: [
    { ref: 0, type: "SKILL", name: "Ranged 90", skillName: "RANGED", targetValue: 5346332 },
    { ref: 1, type: "CUSTOM", name: "Watch a guide", requires: [0] },
  ],
};

describe("codec", () => {
  it("encodes with the GPSHARE1: prefix and a base64url body", () => {
    const code = encode(sample);
    expect(code.startsWith(PREFIX)).toBe(true);
    expect(code.slice(PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/); // url-safe, no padding
  });

  it("round-trips encode → decode", () => {
    expect(decode(encode(sample))).toEqual(sample);
  });

  it("payload is gzipped JSON with the exact Java field names", () => {
    const code = encode(sample);
    const json = JSON.parse(gunzipSync(Buffer.from(code.slice(PREFIX.length), "base64url")).toString("utf8"));
    expect(json.v).toBe(1);
    expect(json.kind).toBe("SECTION");
    expect(json.goals[0]).toMatchObject({ ref: 0, type: "SKILL", skillName: "RANGED", targetValue: 5346332 });
    expect(json.goals[1].requires).toEqual([0]);
  });

  it("decodes a code embedded in surrounding text", () => {
    const code = encode(sample);
    expect(decode(`hey import this into the plugin: ${code} thanks!`)).toEqual(sample);
  });

  it("rejects empty, unmarked, and corrupt input", () => {
    expect(() => decode("")).toThrow(ShareFormatError);
    expect(() => decode("no marker here")).toThrow(/unrecognised/);
    expect(() => decode(`${PREFIX}!!!!`)).toThrow(/corrupt/); // '!' stops the base64url run → empty token
    expect(() => decode(`${PREFIX}AAAA`)).toThrow(/corrupt/); // valid base64url but not gzip
  });

  it("rejects an incompatible schema version", () => {
    // encode() normalizes the version from the bundle shape, so a forged
    // version has to be smuggled in as a hand-built wire payload.
    const { gzipSync } = require("node:zlib") as typeof import("node:zlib");
    const forged = gzipSync(Buffer.from(JSON.stringify({ ...sample, v: 999 }), "utf8")).toString("base64url");
    expect(() => decode("GPSHARE1:" + forged)).toThrow(/incompatible/);
  });
});
