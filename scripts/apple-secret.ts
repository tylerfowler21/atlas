/// Generates the Apple client secret.
///
/// Apple is the only provider here whose "secret" is not a secret you are
/// given but a JWT you sign yourself, with a key Apple lets you download
/// exactly once. Apple rejects one dated more than six months out, so this has
/// to be run again roughly twice a year — /admin shows the expiry, and the
/// server warns for the last two weeks before it lapses.
///
///     npm run apple:secret -- --team ABCDE12345 \
///                             --key-id XYZ9876543 \
///                             --services-id com.example.roava.web \
///                             --p8 ~/Downloads/AuthKey_XYZ9876543.p8
///
/// The .p8 is the private half of a signing key: keep it out of the repo, and
/// nowhere it can be pasted by accident. Only the JWT this prints needs to
/// reach the server.
import { readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i === -1 ? undefined : process.argv[i + 1];
  if (!value || value.startsWith("--")) {
    console.error(`Missing --${name}. See the comment at the top of this file.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const teamId = arg("team");
  const keyId = arg("key-id");
  const servicesId = arg("services-id");
  const p8Path = arg("p8").replace(/^~/, process.env.HOME ?? "~");

  const pkcs8 = readFileSync(p8Path, "utf8");
  if (!pkcs8.includes("BEGIN PRIVATE KEY")) {
    console.error(
      `${p8Path} does not look like a .p8 key — expected a PEM block beginning "-----BEGIN PRIVATE KEY-----".`,
    );
    process.exit(1);
  }

  // Six months is Apple's ceiling; a day under it avoids arguing about
  // rounding at the boundary.
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 180 - 60;

  const secret = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setAudience("https://appleid.apple.com")
    .setSubject(servicesId)
    .sign(await importPKCS8(pkcs8, "ES256"));

  console.log(`\nAUTH_APPLE_ID=${servicesId}`);
  console.log(`AUTH_APPLE_SECRET=${secret}`);
  console.log(
    `\nExpires ${new Date(exp * 1000).toDateString()}. Put both in .env locally and in the Vercel dashboard for production.\n`,
  );
}

main();
