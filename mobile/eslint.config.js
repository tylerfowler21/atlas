// The website's flat config sits at the repo root and ignores this directory,
// so the app needs its own — otherwise `expo lint` finds the wrong one and
// reports every file as ignored.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".expo/*"] },
]);
