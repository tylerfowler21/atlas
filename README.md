# Atlas

A travel map you can share. Save the places you want to go, plan trips day by
day, keep a map of everywhere you've been, and send friends a read-only link to
an itinerary.

- **Map** — search anywhere in the world (or drop a pin), save it with a
  category, notes and a rating, and see everything you've saved on one map.
- **Places** — your saved places grouped by city.
- **Trips** — day-by-day itineraries built from your saved places, with the
  selected day's stops numbered on the map and joined by a dashed route.
- **Been** — every place marked "Been there", with place/city/country counts.
- **Sharing** — each trip can publish a secret read-only link for friends.

## Stack

Next.js 16 (App Router), React 19, Prisma 7 + **Postgres**, Auth.js v5 with
Google sign-in, Tailwind 4, and MapLibre GL for the map.

**The map needs no API keys.** Basemap tiles come from CARTO's free
OpenStreetMap basemaps and place search from Nominatim, both used without an
account. Nominatim asks for at most one request per second and an identifying
User-Agent, so search is proxied through `/api/geocode`, which queues, spaces
and caches the calls (`src/lib/nominatim.ts`). Don't call Nominatim straight
from the browser — that's what the proxy is for.

## Running it locally

Nothing to install beyond npm — the local database is PGlite, which is Postgres
compiled to WebAssembly, served over the real Postgres wire protocol.

```bash
npm install
npm run db:dev      # local Postgres on 127.0.0.1:55432, leave running
```

Then in another terminal:

```bash
cp .env.example .env    # then fill in AUTH_SECRET
npm run db:migrate
npm run dev             # http://localhost:3100
```

Generate a secret with `openssl rand -base64 33`.

Data lives in `./.pgdata`; delete that directory to start completely clean.

### Changing the schema

`prisma migrate dev` is not usable here — it wants a shadow database, and the
local PGlite server can only serve one. Generate migrations by diffing the
running database against the schema instead:

```bash
DIR="prisma/migrations/$(date +%Y%m%d%H%M%S)_change" && mkdir -p "$DIR" && npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > "$DIR/migration.sql"
npm run db:migrate
```

### Signing in locally without Google

Set `ALLOW_DEV_LOGIN="true"` in `.env` and the sign-in page grows a
passwordless box: type any email and you're signed in as that account. It's how
you check multi-user behaviour — sign in as two different addresses and confirm
they can't see each other's places.

**This is development only.** It is gated on `NODE_ENV !== "production"`, so a
production build never even constructs the provider, but don't set the variable
on a deployed environment.

Optional demo data for an account:

```bash
npm run db:seed -- you@example.com
```

## Setting up Google sign-in

You need a Google Cloud project. This part can't be done from the code — it
needs your account.

1. Go to the [Google Cloud console](https://console.cloud.google.com/) and
   create a project (or pick an existing one).
2. **APIs & Services → OAuth consent screen.** Choose **External**, fill in an
   app name and your support email. While it's in "Testing" only accounts you
   add as test users can sign in, so **Publish** it when you want everyone to
   be able to use it.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   application type **Web application**.
4. Under **Authorised redirect URIs** add both:
   ```
   http://localhost:3100/api/auth/callback/google
   https://YOUR-DOMAIN/api/auth/callback/google
   ```
   The path is exact — Google rejects anything that doesn't match character for
   character.
5. Copy the client ID and client secret into `AUTH_GOOGLE_ID` and
   `AUTH_GOOGLE_SECRET`.

Atlas only asks for `openid email profile` — identity, nothing else.

If those two variables are missing the app still boots and shared links still
work; the sign-in page just tells you no method is configured.

## Deploying

**Step-by-step instructions with the clicking: [DEPLOY.md](DEPLOY.md).**

The short version. You need a hosted Postgres and a host. [Neon](https://neon.tech) and
[Vercel](https://vercel.com) both have free tiers and work well together.

1. Create a Postgres database and copy its connection string.
2. Push this repo to GitHub and import it in Vercel.
3. Set the environment variables on the host:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | your Postgres connection string, ending `?sslmode=verify-full` |
   | `AUTH_SECRET` | `openssl rand -base64 33` |
   | `AUTH_GOOGLE_ID` | from the OAuth client above |
   | `AUTH_GOOGLE_SECRET` | from the OAuth client above |

   Do **not** set `ALLOW_DEV_LOGIN`.

4. Apply the schema to the production database once, from your machine:

   ```bash
   DATABASE_URL="<production connection string>" npm run db:migrate
   ```

   Migrations are deliberately **not** run during the build. Preview
   deployments share the production database, so a migration in the build step
   would let an unreviewed branch alter live data.

5. Add your real domain to the Google OAuth redirect URIs (step 4 above).

On hosts other than Vercel, also set `AUTH_TRUST_HOST="true"` so Auth.js
accepts the forwarded host header.

`npm run preflight` checks an environment before you trust it — database
reachable, schema applied, every variable present — and prints the exact Google
redirect URI to register. Pass an origin to see its production form:
`npm run preflight -- https://your-domain.example`.

## Accounts and sharing

Sign-in is Google, via Auth.js v5 with JWT sessions — no database round trip per
request, which matters on serverless.

Everything is scoped by `userId`. The check lives in two places:

- `src/app/(app)/layout.tsx` calls `requireUser()`, so every page in the `(app)`
  group is private *by default* — a new page added there is protected without
  anyone remembering to protect it.
- every route handler in `src/app/api/` refuses anonymous callers with
  `unauthorized()`, and every lookup filters on the signed-in user, so asking
  for someone else's trip by id returns 404 rather than their data.

### Shared itineraries

"Share trip" mints a secret link at `/s/<token>`. Anyone holding it can read the
itinerary — day tabs, stops and the map — without an account, and cannot change
anything.

The token is the whole credential, so:

- it comes from the CSPRNG (24 random bytes, base64url), never from an id;
- there's one link per trip, and "Replace link" rotates the token, which
  instantly breaks every copy of the old URL — that's how you un-share
  something you've already sent;
- "Stop sharing" deletes the row, so old and bogus tokens both 404;
- the page is marked `noindex`.

The shared payload is an explicit allow-list (`PublicItemDTO` and friends in
`src/lib/types.ts`), not a copy of the private DTOs. A place's personal notes
and rating stay in your library, and the owner's name and email are never on
the page. The trip-specific notes on an itinerary item *are* shared, since
those are the point of sending someone a plan.

### Collaborative trips

"Who's on this trip" lets the owner invite people by email. Invitations are
addressed to an email rather than an account, so you can invite someone who
hasn't signed up; `TripCollaborator.userId` is filled in the first time they
open the trip signed in with that address.

Two roles, and the split is deliberate:

- **owner** — everything, including renaming, share links, inviting and deleting
- **editor** — the itinerary only: add, reorder, retime and remove stops

`tripAccess()` in `src/lib/trip-access.ts` is the single place that resolves a
role, and it returns null rather than throwing so callers answer 404 instead of
403 — an id can't be probed for existence.

Everyone adds stops from *their own* saved places, so an itinerary can reference
places belonging to several people while each library stays private.

Atlas doesn't send invitation emails — there's no mail provider wired up. Tell
the person yourself; the trip appears in their list as soon as they sign in.

## Following people

Pick a username at `/settings` and you get a profile at `/u/<username>`. Anyone
can follow anyone — there is no approval step, because following on its own
reveals nothing.

**Trips are private until published.** `Trip.publishedAt` is null by default and
nothing makes it non-null except the owner ticking "Publish to my profile".
Publishing puts a trip on your profile at `/u/<you>`, in your followers' feeds,
and at `/t/<id>` for anyone with the link.

A published trip exposes the same allow-list as a share link — the itinerary,
its stops and their locations. The owner's private notes and ratings on the
underlying places never cross the boundary, and neither does their email.

### Copying

Any published trip can be copied into your own account. The result is a plan,
not a memory:

- the itinerary comes across, including each stop's trip-specific notes
- the dates do not — those were their dates
- places land on your **wishlist**, not marked as somewhere you've been
- the copy is private until you publish it yourself
- `Trip.copiedFromId` records where it came from, for attribution

## Moving data between databases

```bash
npm run db:export                    # → atlas-export.json
npm run db:import -- you@example.com # onto one account
```

The export is gitignored; it's your personal data.

## Layout

```
src/app/(app)/      the owner's pages: /, /places, /trips, /trips/[id], /been
src/app/s/[token]/  the public read-only shared itinerary
src/app/signin/     sign-in
src/app/api/        route handlers, including Auth.js at /api/auth/*
src/auth.ts         Auth.js configuration (providers, session, callbacks)
src/components/     client components — MapCanvas is the MapLibre wrapper
src/lib/            prisma client, session helpers, zod schemas, taxonomy, geo
scripts/            dev Postgres, data export/import
prisma/schema.prisma  Auth.js tables + User, Place, Trip, ItineraryItem, TripShare
```

Categories (restaurant, café, bar, activity, sight, nature, stay, shop,
transport, other) and their colours and icons are defined once in
`src/lib/taxonomy.ts`; the map, the lists and the itinerary all read from it.

### Travel legs

An itinerary entry is one of two shapes, set by `ItineraryItem.kind`:

- **stop** — somewhere you were: `placeId` and `startTime`
- **travel** — a journey between two places: `placeId` → `toPlaceId`, with
  `startTime`/`endTime` as departure and arrival, and `mode` for train, bus,
  plane, ferry, car or walk

Getting from city to city is most of an international trip, and it is a leg
rather than a point. Both ends appear on the map joined by a solid line, which
reads differently from the dashed connector showing the order of a day. The
mode also picks the Apple Maps directions tab, so a train opens on transit
rather than offering to drive you.

The emoji picker searches by keyword (`src/lib/emoji-search.ts`). The list is
curated rather than taken from Unicode's own annotations, because those are
literal — 🌊 is "water wave" and nothing else — so searching "waterfall",
"hike" or "gondola" against them finds nothing despite good answers existing.
Search runs locally, so results appear as you type with no network call.

A stop's emoji resolves most-specific-first via `stopIcon()`: the stop's own
`ItineraryItem.emoji`, then its place's `Place.emoji`, then the category icon.
That is what lets a stop with no place — the plain entries for things the map
has never heard of — carry an emoji at all.

Any place can override its category's icon with its own emoji (`Place.emoji`).
Everything that draws a saved place goes through `placeIcon()` in the same file,
so a place looks the same on the map, in lists and in an itinerary. The
validator accepts pictographs *and* regional-indicator pairs, because a travel
app that rejected 🇨🇭 would be absurd, and rejects anything containing letters
or digits so a pin can never turn into text.
