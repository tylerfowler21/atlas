# Atlas

A personal travel map. Save the places you want to go, plan trips day by day,
and keep a running map of everywhere you've been.

- **Map** — search anywhere in the world (or drop a pin), save it with a
  category, notes and a rating, and see everything you've saved on one map.
- **Places** — your saved places grouped by city.
- **Trips** — day-by-day itineraries built from your saved places, with the
  selected day's stops numbered on the map and joined by a dashed route.
- **Been** — every place marked "Been there", with place/city/country counts.

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

## Accounts and sharing

There is no sign-in yet. The app runs as a single local user, created on first
use by `getCurrentUser()` in `src/lib/user.ts`. Every table already carries a
`userId` and every query is scoped by it, so adding real sessions is a change
to that one file rather than to every route — and trip sharing then becomes a
`TripCollaborator` table on top of the same shape.

## Layout

```
src/app/            pages (/, /places, /trips, /trips/[id], /been) and /api routes
src/components/     client components — MapCanvas is the MapLibre wrapper
src/lib/            prisma client, current user, zod schemas, taxonomy, geo/trip helpers
prisma/schema.prisma  User, Place, Trip, ItineraryItem
```

Categories (restaurant, café, bar, activity, sight, nature, stay, shop,
transport, other) and their colours and icons are defined once in
`src/lib/taxonomy.ts`; the map, the lists and the itinerary all read from it.
