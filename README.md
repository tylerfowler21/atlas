# Atlas

A personal travel map. Save the places you want to go, plan trips day by day,
and keep a running map of everywhere you've been.

- **Map** — search anywhere in the world (or drop a pin), save it with a
  category, notes and a rating, and see everything you've saved on one map.
- **Places** — your saved places grouped by city.
- **Trips** — day-by-day itineraries built from your saved places, with the
  selected day's stops numbered on the map and joined by a dashed route.
- **Been** — every place marked "Been there", with place/city/country counts.
- **Sharing** — each trip can publish a secret read-only link for friends.

## Stack

Next.js 16 (App Router), React 19, Prisma 7 + SQLite, Tailwind 4, and
MapLibre GL for the map.

**No API keys are needed.** Basemap tiles come from CARTO's free OpenStreetMap
basemaps and place search comes from Nominatim, both used without an account.
Nominatim asks for at most one request per second and an identifying
User-Agent, so search is proxied through `/api/geocode`, which queues, spaces
and caches the calls (`src/lib/nominatim.ts`). Don't call Nominatim straight
from the browser — that's what the proxy is for.

## Running it

```bash
npm install
npx prisma migrate deploy   # creates prisma/dev.db
npm run dev                 # http://localhost:3000
```

Optional demo data (Lisbon, Tokyo, Paris and a sample trip):

```bash
npm run db:seed
```

`npm run db:reset` drops the database and re-applies migrations, which is the
way to clear the demo data.

`DATABASE_URL` in `.env` is resolved relative to the project root by both the
Prisma CLI and the app — keep it as `file:./prisma/dev.db` so they agree.

## Sharing a trip

"Share trip" on a trip page mints a secret link at `/s/<token>`. Anyone holding
it can read the itinerary — day tabs, stops and the map — without an account.
They cannot change anything.

The token is the whole credential, so:

- it comes from the CSPRNG (24 random bytes, base64url), never from an id;
- there is one link per trip, and "Replace link" rotates the token, which
  instantly breaks every copy of the old URL — that is how you un-share
  something you have already sent;
- "Stop sharing" deletes the row, so old and bogus tokens both 404;
- the page is marked `noindex`.

The shared payload is an explicit allow-list (`PublicItemDTO` and friends in
`src/lib/types.ts`), not a copy of the private DTOs. A place's personal notes
and rating stay in your library; the trip-specific notes on an itinerary item
are shared, since those are the point of sending someone a plan.

The signed-in chrome lives in the `(app)` route group, so a shared itinerary
renders standalone rather than inside somebody else's navigation.

## Accounts

There is no sign-in yet. The app runs as a single local user, created on first
use by `getCurrentUser()` in `src/lib/user.ts`. Every table carries a `userId`
and every query is scoped by it, so adding real sessions is a change to that
one file rather than to every route.

Collaborative trips — friends *editing* an itinerary rather than reading it —
are the thing that genuinely needs accounts, since edits have to be attributed
to somebody. That is a `TripCollaborator` table on top of the same shape, plus
an auth provider.

## Layout

```
src/app/(app)/      the owner's pages: /, /places, /trips, /trips/[id], /been
src/app/s/[token]/  the public read-only shared itinerary
src/app/api/        route handlers
src/components/     client components — MapCanvas is the MapLibre wrapper
src/lib/            prisma client, current user, zod schemas, taxonomy, geo/trip helpers
prisma/schema.prisma  User, Place, Trip, ItineraryItem, TripShare
```

Categories (restaurant, café, bar, activity, sight, nature, stay, shop,
transport, other) and their colours and icons are defined once in
`src/lib/taxonomy.ts`; the map, the lists and the itinerary all read from it.
