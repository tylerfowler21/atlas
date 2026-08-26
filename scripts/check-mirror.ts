/// Fails if the app's copy of the taxonomy has drifted from the website's.
///
/// Categories decide the emoji and the colour of every pin. If the two copies
/// disagree, the same saved place looks like two different places depending on
/// which screen you are looking at — a bug that is invisible in either codebase
/// on its own, which is exactly why it is worth a check.
import { readFileSync } from "node:fs";

const SOURCE = "src/lib/taxonomy.ts";
const MIRROR = "mobile/src/lib/taxonomy.ts";

/// The mirror carries an explanatory header the original does not. Everything
/// from the first import or export onwards has to match exactly.
function body(text: string) {
  const start = text.search(/^(import|export) /m);
  return start === -1 ? text : text.slice(start);
}

const source = body(readFileSync(SOURCE, "utf8"));
const mirror = body(readFileSync(MIRROR, "utf8"));

if (source !== mirror) {
  console.error(
    `${MIRROR} has drifted from ${SOURCE}.\n\n` +
      `Copy the website's version over the app's, keeping the header comment:\n` +
      `    npm run sync:mirror\n`,
  );
  process.exit(1);
}

console.log(`${MIRROR} matches ${SOURCE}`);
