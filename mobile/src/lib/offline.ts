import { Directory, File, Paths } from "expo-file-system";

/// The last good answer to each request, kept on the phone.
///
/// A travel app is used where there is no signal: on the plane, coming out of
/// a metro in a city whose network your phone does not know, in a restaurant
/// basement checking what time something closes. Until now every screen was a
/// live fetch and every one of those moments was a spinner and then an error —
/// the app worked beautifully at home and not at all where it was for.
///
/// Deliberately not a sync engine. Nothing is written back, nothing is merged,
/// nothing is queued: what is here is the last thing the server said, shown
/// when the server cannot be reached, with the time it was said. Editing
/// offline is a much harder problem and a different feature — seeing the plan
/// is the one that matters.

const FOLDER = "offline";

/// A request path is not a filename. Everything that is not a letter or a
/// number becomes an underscore, which collides only for paths that differ by
/// punctuation alone — and those would be the same request anyway.
function nameFor(path: string) {
  return `${path.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 120)}.json`;
}

function folder() {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/// Worth keeping offline, or not.
///
/// Anything with a query string is a search or a filter — an answer to a
/// question somebody is in the middle of asking, not something they will want
/// back on a plane. Keeping those would fill the phone with half-typed names.
export function worthKeeping(path: string) {
  return path.startsWith("/api/") && !path.includes("?");
}

export type Remembered<T> = { data: T; at: Date };

export function remember(path: string, data: unknown) {
  if (!worthKeeping(path)) return;
  try {
    const file = new File(folder(), nameFor(path));
    file.write(JSON.stringify({ at: new Date().toISOString(), data }));
  } catch {
    // A cache that cannot be written is a cache that is not there. Whatever
    // was being fetched has already arrived, so nothing here is worth failing
    // a screen over.
  }
}

export function recall<T>(path: string): Remembered<T> | null {
  if (!worthKeeping(path)) return null;
  try {
    const file = new File(folder(), nameFor(path));
    if (!file.exists) return null;
    const saved = JSON.parse(file.textSync()) as { at: string; data: T };
    return { data: saved.data, at: new Date(saved.at) };
  } catch {
    // A half-written or unreadable file is no worse than no file.
    return null;
  }
}

/// Everything, gone. Called when somebody signs out: the next person to hold
/// this phone should not find the last one's itinerary in it.
export function forgetEverything() {
  try {
    const dir = new Directory(Paths.document, FOLDER);
    if (dir.exists) dir.delete();
  } catch {
    // Nothing to be done about it here, and nothing that makes signing out
    // worth failing.
  }
}
