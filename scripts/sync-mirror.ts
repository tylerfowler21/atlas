/// Copies the website's taxonomy over the app's, preserving the app copy's
/// header comment. The counterpart to check-mirror.
import { readFileSync, writeFileSync } from "node:fs";

const PAIRS = [
  ["src/lib/taxonomy.ts", "mobile/src/lib/taxonomy.ts"],
  ["src/lib/report-reasons.ts", "mobile/src/lib/report-reasons.ts"],
  ["src/lib/place-name.ts", "mobile/src/lib/place-name.ts"],
  ["src/lib/use-place-search.ts", "mobile/src/lib/use-place-search.ts"],
] as const;

for (const [source, mirror] of PAIRS) {
  const from = readFileSync(source, "utf8");
  const existing = readFileSync(mirror, "utf8");
  const bodyStart = from.search(/^(import|export) /m);
  const headerEnd = existing.search(/^(import|export) /m);
  if (headerEnd === -1) throw new Error(`${mirror} has no header to preserve`);
  writeFileSync(mirror, existing.slice(0, headerEnd) + from.slice(bodyStart));
  console.log(`Copied ${source} into ${mirror}`);
}
