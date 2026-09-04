/// Builds every icon the web app and the iOS app need from one source file.
///
/// The source is a rounded square with transparent corners — how an icon looks
/// once a platform has masked it, not how a platform wants to be given one.
/// iOS applies its own mask, so a rounded source gets rounded twice and the
/// transparent corners render black; App Review rejects icons with an alpha
/// channel outright. So the iOS icon is flattened onto the brand green, corner
/// to corner, with the artwork scaled to sit inside where the rounding was.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SOURCE = "brand/roava-icon-source.png";

/// How far inside the trimmed tile to crop, as a fraction of its width.
///
/// Filling the transparent corners with a sampled colour left a visible seam:
/// the tile carries a soft shadow and slight shading, so a flat fill never
/// quite matches it. Cutting inside the corner radius avoids the problem
/// instead of trying to disguise it — every pixel of the result is then the
/// tile's own background. The radius looks to be about a fifth of the width,
/// and a square inscribed in that needs roughly 6%; 9% leaves margin for the
/// shadow.
const INSET = 0.09;

/// The mark on its own, with the icon's tile keyed out.
async function cutTileAway(source: string) {
  const { data, info } = await sharp(source)
    .trim()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const DARKEST_MARK = 110;
  const BRIGHTEST_TILE = 60;

  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const brightness = Math.max(data[i]!, data[i + 1]!, data[i + 2]!);
    const opacity = Math.max(
      0,
      Math.min(1, (brightness - BRIGHTEST_TILE) / (DARKEST_MARK - BRIGHTEST_TILE)),
    );

    out[i] = data[i]!;
    out[i + 1] = data[i + 1]!;
    out[i + 2] = data[i + 2]!;
    out[i + 3] = Math.round(Math.min(data[i + 3]!, opacity * 255));
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function main() {
  await mkdir("public/brand", { recursive: true });
  await mkdir("mobile/assets/images", { recursive: true });

  // Trim the transparent margin down to the tile, then cut a square from
  // inside its rounded corners.
  const tile = await sharp(SOURCE).trim().toBuffer({ resolveWithObject: true });
  const side = Math.min(tile.info.width, tile.info.height);
  const inset = Math.round(side * INSET);
  const size = side - inset * 2;

  const flattenedSquare = await sharp(tile.data)
    .extract({
      left: Math.round((tile.info.width - side) / 2) + inset,
      top: Math.round((tile.info.height - side) / 2) + inset,
      width: size,
      height: size,
    })
    // Removes the alpha channel entirely — App Review rejects icons that have
    // one, even when nothing in the image is transparent.
    .flatten()
    .png()
    .toBuffer();

  const icon = await sharp(flattenedSquare).resize(1024, 1024).png().toBuffer();

  await sharp(icon).toFile("mobile/assets/images/icon.png");
  await sharp(icon).resize(512, 512).toFile("public/brand/icon-512.png");
  await sharp(icon).resize(192, 192).toFile("public/brand/icon-192.png");

  // The splash screen's mark, trimmed and transparent.
  //
  // It used to reuse the app icon, which cannot have an alpha channel — App
  // Review rejects icons that do — so the splash drew a solid square of the
  // icon's own green over the splash's green. The two were one value apart,
  // #102D27 against #112D27, which is invisible as a colour and perfectly
  // visible as an edge: a tile floating on a background, which is not what a
  // splash screen should look like.
  //
  // Transparent, so there is no edge to notice at any background colour.
  //
  // The tile has to be cut out rather than trimmed away: the source artwork is
  // the icon, so trimming only removes the transparent margin and leaves the
  // rounded green tile sitting in the middle of the splash. And the tile is a
  // gradient — #15372E at the top, #081C18 at the bottom — so no single
  // background colour could ever hide it.
  //
  // Brightness separates the two cleanly. Every part of the tile is darker than
  // 60; the cream and the orange sun are far brighter. The ramp between 60 and
  // 110 keeps the mark's antialiased edges soft instead of leaving a cut-out
  // line around it.
  await sharp(await cutTileAway(SOURCE))
    .trim()
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile("mobile/assets/images/splash.png");

  // The web mark keeps its transparency: it is placed on the page's own
  // background, which is not the icon's green.
  await sharp(SOURCE).resize(256, 256).png().toFile("public/brand/mark.png");
  await sharp(SOURCE).resize(64, 64).png().toFile("public/brand/mark-64.png");

  // Favicons. 32px is what a browser tab actually shows.
  await sharp(icon).resize(32, 32).png().toFile("public/brand/favicon-32.png");
  await sharp(icon).resize(180, 180).png().toFile("public/apple-touch-icon.png");

  const check = await sharp("mobile/assets/images/icon.png").metadata();
  console.log(
    `  iOS icon: ${check.width}x${check.height}, alpha: ${check.hasAlpha} (must be false)`,
  );
  console.log("  wrote public/brand/{mark,mark-64,icon-512,icon-192,favicon-32}.png");
  console.log("  wrote public/apple-touch-icon.png and mobile/assets/images/icon.png");
}

main();
