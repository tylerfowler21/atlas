// Required by expo-share-extension: the share target is a second bundle, and
// Metro has to be told it exists.
const { getDefaultConfig } = require("expo/metro-config");
const { withShareExtension } = require("expo-share-extension/metro");

module.exports = withShareExtension(getDefaultConfig(__dirname));
