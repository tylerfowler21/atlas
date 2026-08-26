# Roava for iOS

Expo SDK 57. The website it talks to is the parent directory.

## Working on it day to day

    npx eas-cli build --platform ios --profile development

Once, per device. Installs an app carrying the real bundle identifier — so Sign
in with Apple works — with the Metro client embedded. After that:

    npx expo start

Open Roava on the phone and it connects over Wi-Fi. JavaScript changes appear in
seconds: colours, icons, screens, logic. A new build is only needed when a
native dependency is added or app.json changes.

Expo Go cannot be used. It runs under its own bundle identifier, so Apple
refuses to sign anyone in, and the app stops at its first screen.

## Builds

| Profile | What it is |
| --- | --- |
| `development` | Metro client embedded. For iterating. |
| `preview` | Release build, installed by link. For trying the real thing, and for handing to someone else. |
| `production` | For the App Store. |

The API URL is set per profile rather than defaulting: a build silently pointing
at a development server looks broken to everyone who installs it.

## Shared with the website

`src/lib/taxonomy.ts` is mirrored from the website's copy; `npm run
check:mirror` in the parent fails if they drift. The navigation icons are
generated from the same SVGs by `npm run build:native-icons`.
