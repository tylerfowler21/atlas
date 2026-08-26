/// Copies the website's taxonomy over the app's, preserving the app copy's
/// header comment. The counterpart to check-mirror.
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "src/lib/taxonomy.ts";
const MIRROR = "mobile/src/lib/taxonomy.ts";

const source = readFileSync(SOURCE, "utf8");
const existing = readFileSync(MIRROR, "utf8");

const bodyStart = source.search(/^(import|export) /m);
const headerEnd = existing.search(/^(import|export) /m);
if (headerEnd === -1) throw new Error(`${MIRROR} has no header to preserve`);

writeFileSync(MIRROR, existing.slice(0, headerEnd) + source.slice(bodyStart));
console.log(`Copied ${SOURCE} into ${MIRROR}`);
