/**
 * Encodes a {@link ShareBundle} to (and from) the plugin's copy-safe string:
 *
 *   ShareBundle → JSON → gzip → URL-safe Base64 (no padding), prefixed "GPSHARE1:"
 *
 * Byte-for-byte compatible with the plugin's `com.goalplanner.share.ShareCodec`.
 * The "GPSHARE<v>:" marker is a magic prefix + schema version; decode locates it
 * anywhere in the input (so a code embedded in a sentence still works) and reads
 * the base64url run that follows.
 */
import { gzipSync, gunzipSync } from "node:zlib";
import {
  type ShareBundle,
  SCHEMA_VERSION,
  SCHEMA_VERSION_V1,
  effectiveSections,
  needsV2,
} from "./bundle.js";

export const PREFIX = `GPSHARE${SCHEMA_VERSION_V1}:`;
export const PREFIX_V2 = `GPSHARE${SCHEMA_VERSION}:`;

export class ShareFormatError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ShareFormatError";
  }
}

/**
 * Encode a bundle to a prefixed, gzipped, URL-safe-Base64 string. The wire
 * version follows the content (mirrors the plugin's normalizeForWire): plain
 * single-section bundles stay on the v1 wire so older plugin builds import
 * them; multi-section or default-target bundles emit GPSHARE2.
 */
export function encode(bundle: ShareBundle): string {
  if (!bundle) {
    throw new ShareFormatError("nothing to share");
  }
  const secs = effectiveSections(bundle);
  let wire: ShareBundle;
  let prefix: string;
  if (needsV2(bundle)) {
    wire = {
      v: SCHEMA_VERSION,
      kind: "GOALS",
      sectionColorRgb: -1,
      goals: [],
      sections: secs,
    };
    if (bundle.sharedBy) wire.sharedBy = bundle.sharedBy;
    prefix = PREFIX_V2;
  } else {
    const only = secs[0]!;
    wire = {
      v: SCHEMA_VERSION_V1,
      kind: only.name !== undefined ? "SECTION" : "GOALS",
      sectionColorRgb: only.colorRgb ?? -1,
      goals: only.goals,
    };
    if (only.name !== undefined) wire.sectionName = only.name;
    if (bundle.sharedBy) wire.sharedBy = bundle.sharedBy;
    prefix = PREFIX;
  }
  const json = Buffer.from(JSON.stringify(wire), "utf8");
  const gz = gzipSync(json);
  return prefix + gz.toString("base64url");
}

const isBase64Url = (c: string): boolean =>
  (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "-" || c === "_";

/**
 * Decode a string produced by {@link encode}. Tolerant of surrounding text:
 * finds the PREFIX marker and reads the base64url token after it.
 *
 * @throws ShareFormatError on empty input, missing/wrong-version marker, or corruption.
 */
export function decode(text: string): ShareBundle {
  if (text == null || text.trim() === "") {
    throw new ShareFormatError("empty share code");
  }
  // v2 first; both decode.
  let prefix = PREFIX_V2;
  let marker = text.indexOf(PREFIX_V2);
  if (marker < 0) {
    prefix = PREFIX;
    marker = text.indexOf(PREFIX);
  }
  if (marker < 0) {
    throw new ShareFormatError("unrecognised or wrong-version share code");
  }
  let end = marker + prefix.length;
  const start = end;
  while (end < text.length && isBase64Url(text[end]!)) {
    end++;
  }
  const b64 = text.slice(start, end);
  if (b64 === "") {
    throw new ShareFormatError("corrupt share code");
  }

  let json: string;
  try {
    json = gunzipSync(Buffer.from(b64, "base64url")).toString("utf8");
  } catch (e) {
    throw new ShareFormatError("corrupt share code", { cause: e });
  }

  let bundle: ShareBundle;
  try {
    bundle = JSON.parse(json) as ShareBundle;
  } catch (e) {
    throw new ShareFormatError("invalid share payload", { cause: e });
  }
  if (!bundle) {
    throw new ShareFormatError("empty share payload");
  }
  const expected = prefix === PREFIX_V2 ? SCHEMA_VERSION : SCHEMA_VERSION_V1;
  if (bundle.v !== expected) {
    throw new ShareFormatError(`share code is from an incompatible plugin version (v${bundle.v})`);
  }
  if (expected === SCHEMA_VERSION) {
    if (!Array.isArray(bundle.sections) || bundle.sections.length === 0) {
      throw new ShareFormatError("empty share payload");
    }
    for (const s of bundle.sections) {
      if (!s || !Array.isArray(s.goals)) {
        throw new ShareFormatError("invalid share payload");
      }
    }
    // The Java encoder omits the legacy fields on the v2 wire — normalize so
    // downstream code can rely on them existing.
    bundle.goals ??= [];
    bundle.kind ??= "GOALS";
    bundle.sectionColorRgb ??= -1;
  } else if (!Array.isArray(bundle.goals)) {
    throw new ShareFormatError("empty share payload");
  }
  return bundle;
}
