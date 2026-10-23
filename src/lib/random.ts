import "server-only";
import { randomInt } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// 22 base62 chars from a CSPRNG (~131 bits). Used for public keys and slugs.
export function randomBase62(length = 22) {
  let out = "";
  for (let i = 0; i < length; i++) out += BASE62[randomInt(BASE62.length)];
  return out;
}
