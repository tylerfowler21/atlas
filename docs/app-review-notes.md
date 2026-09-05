# App Review notes — Roava Travel

Paste sections 2–6 into **App Store Connect → App Review Information → Notes**, and
send the same text as the reply to the Guideline 2.1 message. Item 1 is a screen
recording you have to capture yourself.

---

## 1. Screen recording (record this on your iPhone)

Settings → Control Centre → add **Screen Recording**, then record in one take.
Apple named three things they want to see, so film them in this order:

1. **Launch** — start from the Home Screen and tap the icon. Do not cut the
   splash; they want the app opening cold.
2. **Sign in** — tap *Continue with Apple* and complete it. This is the
   registration and login flow in one, since an unrecognised Apple ID becomes a
   new account.
3. **The main flow** — search a place on the Map tab and save it; open Trips,
   create a trip, add a stop to a day; show the calendar and tap a date; open
   the Bookings tab and tick something as booked.
4. **User-generated content and moderation** — Discover → Feed, press
   **Report** on a published trip and show the reason list. Then Discover →
   People, press the ⋯ on a person and show **Report** and **Block**.
5. **Account deletion** — Account tab → scroll to *Delete account* → type the
   username → show the confirmation dialog. You can cancel at the last step;
   they need to see the flow exists and is reachable, not the deletion itself.

Upload it to the reply, or put it somewhere with a public link (YouTube
unlisted is fine) and paste the link.

---

## 2. Purpose and target audience

Roava is a personal travel map and trip planner.

People keep their travel notes in three or four places at once — a Notes list of
restaurants somebody recommended, a spreadsheet for the itinerary, screenshots
in a group chat, a folder of confirmation emails. None of it is on a map, and
none of it is together. Roava puts it in one place: you save places you have
been and places you want to go, they appear as pins on your own map, and you can
build a trip day by day out of them.

The audience is ordinary travellers who plan their own trips — the people who
already keep a spreadsheet and would rather not. It is a single-user personal
tool first; the social features (following someone, publishing a trip) are
secondary and entirely optional.

There are no in-app purchases and no paid content. Every feature is free.

## 3. Setting up and accessing the app

No demo account is needed and none can be supplied, because the app has no
email-and-password sign-in. Sign in is **Sign in with Apple** or **Sign in with
Google** only.

Tap **Continue with Apple** on the sign-in screen and you are in. There is no
invite code, waiting list, or allowlist — any Apple ID gets a full account
immediately, with every feature available. (Hiding the email with Apple's
private relay works fine.)

Getting to the main features from a fresh account:

- **Map tab** — type a place into the search bar at the top, tap a result, save
  it. It becomes a pin. The 📍 button bottom-right centres the map on you, which
  asks for location permission the first time.
- **Trips tab** — *+ New trip*, give it a name and dates. Inside the trip,
  *Add a stop* searches for places; the calendar shows which days the trip
  covers; the **Bookings** tab collects anything you have ticked as needing a
  booking; **Before you go** is a checklist for apps, passes and documents.
- **Journal tab** — write a dated entry, optionally attached to a trip.
- **Discover tab** — *People* lists other users you can follow; *Feed* shows
  trips they have published, which you can copy into your own trips.
- **Account tab** — profile, sign out, and delete account.

No sample files are needed. The app works with an empty account.

## 4. External services used

- **Vercel** — hosts the web API this app talks to (https://www.roava.co).
- **Neon** — PostgreSQL database, holding the account and its saved places,
  trips and journal entries.
- **Vercel Blob** — storage for photos a user attaches to journal entries.
- **Sign in with Apple** and **Google Sign-In** — the only two ways to
  authenticate. Handled by Auth.js; we never see or store a password.
- **Apple MapKit** — the map itself, via react-native-maps on iOS.
- **Nominatim (OpenStreetMap Foundation)** and **Photon (Komoot)** — place
  search and geocoding, i.e. turning "Husk, Charleston" into a point on a map.
  Both are public services covering the whole world.
- **Anthropic (Claude API)** — used by one optional feature, "Plan one for me",
  which drafts a suggested itinerary from a destination and a number of days.
  Only the text the user types on that screen is sent. Every place it suggests
  is then checked against the geocoders above and shown to the user for
  confirmation before anything is saved; nothing is added to a map on the
  model's say-so. The feature is free and capped per day.
- **Expo Application Services (EAS Update)** — delivers JavaScript updates to
  the installed build.

No advertising, analytics or tracking SDKs are present. The app does not
collect data for tracking as defined by App Tracking Transparency, and shows no
ATT prompt.

## 5. Regional differences

There are none. The app behaves identically in every region: the same features,
the same content, no geographic restrictions and no region-locked functionality.
Maps and place search cover the whole world through the services above. Dates
and place names are shown using the device's own locale settings, which is the
only thing that varies, and no feature is added or removed anywhere.

## 6. Regulated industry / third-party material

Roava does not operate in a regulated industry. It is not a booking agent, does
not sell travel, does not process payments, and holds no licence-requiring
role — the "Bookings" feature is a personal checklist of things the user has
booked elsewhere, with a field for their own confirmation number. Nothing is
booked through the app.

The app hosts no protected third-party material. Content is either the user's
own, or map data used under the licences of the providers named above:
Apple MapKit under Apple's terms, and OpenStreetMap-derived geocoding under the
Open Database Licence, attributed in the app.
