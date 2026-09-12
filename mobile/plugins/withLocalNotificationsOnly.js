const { withEntitlementsPlist } = require("expo/config-plugins");

/// Takes the push entitlement back off the app.
///
/// expo-notifications ships an auto-applied config plugin, so simply depending
/// on it adds `aps-environment` — the entitlement for remote push through
/// Apple's servers. Roava's reminders are local: the phone is told about a
/// booking deadline once and does the rest by itself, with no token, no
/// server and nothing to receive. Local notifications need no entitlement.
///
/// Leaving it in is not free. An entitlement the provisioning profile does not
/// carry fails the build at signing — which is exactly how this was found —
/// and enabling the capability to satisfy it would have the app asking Apple
/// for a push token it never uses.
///
/// If real push ever arrives, delete this file and enable Push Notifications
/// on the App ID; everything else is already in place.
module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["aps-environment"];
    return cfg;
  });
};
