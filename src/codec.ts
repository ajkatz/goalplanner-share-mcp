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
import { type ShareBundle, SCHEMA_VERSION } from "./bundle.js";

export const PREFIX = `GPSHARE${SCHEMA_VERSION}:`;

export class ShareFormatError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ShareFormatError";
  }
}

/** Encode a bundle to a prefixed, gzipped, URL-safe-Base64 string. */
export function encode(bundle: ShareBundle): string {
  if (!bundle) {
    throw new ShareFormatError("nothing to share");
  }
  const json = Buffer.from(JSON.stringify(bundle), "utf8");
  const gz = gzipSync(json);
  return PREFIX + gz.toString("base64url");
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
  const marker = text.indexOf(PREFIX);
  if (marker < 0) {
    throw new ShareFormatError("unrecognised or wrong-version share code");
  }
  let end = marker + PREFIX.length;
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
  if (!bundle || !Array.isArray(bundle.goals)) {
    throw new ShareFormatError("empty share payload");
  }
  if (bundle.v !== SCHEMA_VERSION) {
    throw new ShareFormatError(`share code is from an incompatible plugin version (v${bundle.v})`);
  }
  return bundle;
}
