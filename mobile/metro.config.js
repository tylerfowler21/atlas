// The share extension is not in this build — its plugin is out of app.json
// until the App Group exists in the Apple developer console, and without the
// plugin there is no second target for withShareExtension to bundle for.
// Put both back together.
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
