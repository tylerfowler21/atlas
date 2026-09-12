# Roava redesign: handoff brief

For Tyler, from Jack. September 2026.

This covers a visual redesign of Roava for iOS and desktop web, and how to build it into `tylerfowler21/atlas`. Almost all of it is a reskin of screens you already have. A short list of items near the end are new features the mockups imply, and those are called out separately so they don't hide inside a "restyle" PR.

## Where everything is

Everything except the Figma file is in the `roava-redesign` folder that comes with this brief.

| Asset | What it is |
| --- | --- |
| [Figma file](https://www.figma.com/design/8w2R8OvQ7coptGdrUjvwhf) | 8 iOS screens, 4 desktop web screens, and a Foundations board (color, type, components). Ask Jack for edit access. |
| `roava-ios-prototype.html` + `img/` | The iOS screens as plain HTML and CSS. Open it in a browser. It's the fastest place to copy exact values from (spacing, shadows, blur, font sizes). Keep it next to the `img/` folder. |
| `roava-redesign-preview.png`, `roava-desktop-preview.png` | Overview images of both sets. |
| `roava-redesign-images.zip` | The photos used in the mockups. |

**About the photos:** they're AI-generated placeholders for the mockups. Don't ship them as real photos of real places (see "Place photos" below).

## The short version

- **Direction:** evolve the brand, don't replace it. Same name, same icon, same four tabs (Map, Trips, Journal, Discover). The palette moves to evergreen, cream and one orange accent, pulled from the app icon. The type moves to Bricolage Grotesque for headings and Geist for UI.
- **No schema changes** are needed for the reskin itself.
- **Suggested order:** tokens and fonts, then shared components, then screens, then the iOS app, then new features. One PR per phase, each checked on a Vercel preview.
- **Rough size, for someone who knows the code and uses Claude Code:** tokens about a day, web screens 1 to 2 weeks, iOS 1 to 2 weeks. New features come on top.

**Caveat:** Jack's review was based on a partial copy of the repo (about 20 files). Components like `MapCanvas`, `TripPlanner`, `SharedTrip`, `Welcome` and the whole `mobile/` source weren't read. Treat the file mapping below as a starting point, not an audit.

## Design tokens

### Color

| Name | Hex | Role |
| --- | --- | --- |
| Evergreen 950 | `#0B211C` | Text on the orange accent, darkest surfaces |
| Evergreen 900 | `#12322B` | Brand, primary buttons, active chips |
| Evergreen 700 | `#245247` | Active text, links on light, focus ring |
| Evergreen 100 | `#E4EDE8` | Active nav tab background, soft badges |
| Mist | `#F3F5F1` | App background |
| Card | `#FEFEFC` | Cards, sheets, nav bar |
| Cream | `#F7F1E8` | Text on evergreen, brand surface |
| Ink | `#13241F` | Body text |
| Muted | `#5B6B65` | Secondary text |
| Faint | `#8A9892` | Separators and decoration only (see contrast) |
| Sun | `#F98746` | The one accent: primary CTA, unread dot, ratings |
| Sun ink | `#A64A15` | Accent-colored text on light backgrounds |
| Sun tint | `#FFE9DB` | Selected state backgrounds |
| Line | `rgba(18,50,43,.10)` | Hairlines and borders |

**Contrast checks:**

| Pairing | Ratio | Result |
| --- | --- | --- |
| Ink on Mist | 14.7:1 | Passes |
| Muted on Mist | 5.1:1 | Passes |
| Sun ink on Mist | 5.3:1 | Passes |
| Evergreen 950 on Sun | 6.9:1 | Passes |
| White on Sun | 2.5:1 | Fails, so orange buttons always carry dark text (same rule you already follow for teal) |
| Faint on Mist | 2.7:1 | Fails, so never use Faint for readable text |

**Fix before shipping:** in the desktop mockups, the sign-in legal line and a couple of footer links are set in Faint. Build those in Muted instead.

### Starting point for `src/app/globals.css`

This keeps your existing token names, so Tailwind classes like `bg-accent` and `text-muted` keep working and recolor automatically:

```css
:root {
  --background: #f3f5f1;      /* Mist */
  --surface: #fefefc;         /* Card */
  --brand-surface: #f7f1e8;   /* Cream */
  --foreground: #13241f;      /* Ink */
  --muted: #5b6b65;
  --border: rgba(18, 50, 43, 0.10);
  --accent: #f98746;          /* Sun */
  --accent-contrast: #0b211c; /* text on Sun */
  --accent-text: #a64a15;     /* Sun ink, for text */
  --brand: #12322b;           /* Evergreen 900 */
  --sea-glass: #e4ede8;       /* Evergreen 100; rename later */
  /* new */
  --faint: #8a9892;
  --sun-tint: #ffe9db;
  --brand-active: #245247;    /* Evergreen 700 */
}
```

**Two decisions for you:**
1. **Brand guide:** this replaces the brand guide's Deep Ocean and Coastal Teal. If the guide has to stay, keep the layouts and components and skip the palette.
2. **Dark mode:** the mockups are light only. Either design a dark evergreen palette, or turn off the `prefers-color-scheme: dark` block until one exists. The current dark block will clash with the new light theme.

### Category pin colors

These are `color` values in `src/lib/taxonomy.ts`. That file is mirrored into the app, so run `npm run sync:mirror` afterwards.

| Category id | Now | Redesign |
| --- | --- | --- |
| restaurant | `#ef4444` | `#D65A4A` |
| cafe | `#b45309` | `#9A6A48` |
| bar | `#a855f7` | `#8A5A9E` |
| activity | `#f59e0b` | `#D99A2B` |
| sight | `#0ea5e9` | `#3C7FB0` |
| nature | `#10b981` | `#3E8E5E` |
| hotel (Stay) | `#6366f1` | `#5566B0` |
| shop | `#ec4899` | `#C4578A` |
| transport | `#4A6B8A` | `#5F7C8C` |
| other | `#0F2D4A` | `#12322B` |

The new colors are the same hues, just desaturated so the pins sit on a calm map without shouting.

### Pins

- **Shape:** a circle filled with the category color, a 2.5px white ring, the category emoji centered at 50% of the pin size, and a soft shadow.
- **Selected:** a 44px pin with a 3px white ring plus an outer orange halo: `0 0 0 7px rgba(249,135,70,.4)`.
- **Trip stop numbers:** a 20px badge in the category color at the top right.
- **Where:** all of this is a restyle of `.roava-pin` in `globals.css`.

### Type

| Use | Font | Weight | Size / line height | Tracking |
| --- | --- | --- | --- | --- |
| Hero (desktop) | Bricolage Grotesque | ExtraBold 800 | 56 to 84 | about -3% |
| Page title | Bricolage Grotesque | ExtraBold 800 | 30 to 44 | -0.6 to -1.4px |
| Section title | Bricolage Grotesque | Bold 700 | 22 to 26 | -0.3px |
| Item title | Geist | SemiBold 600 | 16 to 17 | |
| Body | Geist | Regular 400 | 15 to 16 / 23 | |
| Meta | Geist | Regular or Medium | 13 to 14 | |

**To set up the fonts:**
- **Web:** in `src/app/layout.tsx`, swap `DM_Serif_Display` / `Inter` for `Bricolage_Grotesque` / `Geist` from `next/font/google` and keep the same `--font-display` / `--font-ui` variables.
- **Heading weight:** the `h1, .display` rule in `globals.css` sets `font-weight: 400` for the serif. Change it to 800.
- **iOS:** load both fonts with `expo-font`.

### Shape, glass and shadow

- **Radius rule:** controls (buttons, chips, search, tab bar) are full pills. Cards and sheets are 22 to 28px. Photos inside cards are 14 to 16px. Large hero photos are 28 to 32px.
- **Glass (floating map controls, chips on the map, tab bar):** `rgba(255,255,255,.74)` fill, `backdrop-filter: blur(22px) saturate(160%)`, 1px `rgba(255,255,255,.85)` border, and `0 8px 24px rgba(18,50,43,.12)` shadow.
- **Glass on photos:** `rgba(11,33,28,.34)` fill with `blur(18px)` and a 1px `rgba(255,255,255,.22)` border.
- **Card shadow:** `0 10px 30px rgba(18,50,43,.14)`, used sparingly. Most cards are flat white on Mist.
- **Icons:** Phosphor (MIT), regular weight, with fill for active states. `@phosphor-icons/react` on web. On iOS, the nav icons are built from shared SVGs (`npm run build:native-icons`), so switching sets means swapping those source SVGs.
- **Emoji:** the mockups use Twemoji art so they render in Figma. In the product, native emoji are fine.

## Screen by screen (web)

| Design screen | Route | Likely files | What changes |
| --- | --- | --- | --- |
| **Sign in** (iOS 01, desktop D1) | `/signin` | `src/app/signin/page.tsx` | Full-bleed photo with a headline on the left (desktop) or behind (iOS), buttons on the right. Apple, Google and the dev login all stay as they are, just restyled. |
| **Welcome** (iOS 02) | `/welcome` | `src/app/welcome/page.tsx`, `components/Welcome.tsx` | Same username flow you have. Adds an `@` prefix, an inline "is yours" confirmation, and a three-perk card. |
| **Map** (iOS 03, 04, desktop D2) | `/` | `(app)/page.tsx`, `Explorer.tsx`, `MapCanvas.tsx`, `.roava-pin` | Desktop: a 420px left sidebar (city header, filter chips, place rows with photo, emoji, meta and stars) and a floating place card over the map at top right. iOS: glass search and chips over the map, with a draggable sheet for the list. Filters map to your existing statuses (Want to go, Been there) and categories. |
| **Place detail** (iOS 05, the card in D2) | on the map | `PlaceDetail.tsx`, `StarRating.tsx` | Photo header, status chips (Want to go / Been there / Lived, already in your taxonomy), your rating, a note, and an "Add to trip" primary button with a directions button next to it. |
| **Trip planner** (iOS 06, desktop D3) | `/trips/[id]` | `(app)/trips/[id]/page.tsx`, `TripPlanner.tsx` | Cover photo header with title, dates and traveler avatars. Day picker pills, then a timeline of stop cards with a time column. Travel legs sit between stops ("Train · 18 min"). The map gets a day chip and a "This day / Whole trip" toggle. |
| **Been** (iOS 07) | `/?status=visited` | `Explorer.tsx` or `/journal` | A stats header (countries, cities, places) and a dot-matrix world map with visited countries lit. You redirected `/been` into the map filter, so it's your call whether this lives there or on Journal. |
| **Shared trip** (iOS 08, desktop D4) | `/s/[token]` | `src/app/s/[token]/page.tsx`, `SharedTrip.tsx`, `SignUpInvite.tsx` | Hero with author, big title, one-line summary, fact chips and a cover photo, then day cards next to the route map. The primary CTA is "Copy this trip" (new feature, below) and the secondary is "Open in Roava". |
| **Nav** | all | `NavBar.tsx`, `MobileTabBar.tsx` | Same four tabs. Desktop: 64px white bar with the brand at left, pill tabs (active uses Evergreen 100), then a search pill, the bell with the orange unread dot, an orange "Add place" button and the avatar. iOS: a floating glass tab bar with a separate round orange + button. |

The trips list, notifications, settings and admin pages weren't designed. The tokens and shared components should carry them.

### Desktop layout numbers (1440 wide)

- **Nav:** 64px tall with 28px side padding.
- **Map:** 420px sidebar, and the map fills the rest. The place card is 372px wide, floating 24px from the edges.
- **Trip planner:** 580px itinerary column, and the map fills the rest.
- **Shared trip:** 80px side gutters, so the content is 1280px wide.
  - Hero: a 560px text column next to a 640 × 460px photo.
  - Below it: day cards next to a 520 × 640px map card.

## iOS app (`mobile/`)

It's mostly the same exercise, and the building blocks are already installed:

- **`expo-glass-effect`** gives you real Liquid Glass for the tab bar, the search field and the floating map controls. The Figma is an approximation of it.
- **`expo-font`** loads Bricolage Grotesque and Geist.
- **`expo-image`** handles the photo-heavy lists.
- **`react-native-maps`** takes custom pin views for the circular emoji pins.
- **Colors:** put them in `mobile/constants` as one theme object that mirrors the web tokens. Consider adding it to the mirror check the way `taxonomy.ts` already is.
- **Testing:** your README notes that Expo Go can't sign in, so review this on a development build.

## Recommended phases

**Phase 0: decisions (an hour).** Palette change OK? Dark mode plan? Stay on your current icon set, or move to Phosphor? Where does the Been view live?

**Phase 1: tokens (about a day, one PR).**
- `globals.css` tokens, the `h1` weight, fonts in `layout.tsx`, category colors in `taxonomy.ts` plus `sync:mirror`, and the `.roava-pin` restyle.
- **Done when:** every page recolors, no layout has changed yet, and nothing readable is set in Faint.

**Phase 2: shared components.**
- Button (primary evergreen, accent orange, outline), Chip (active, outline, glass), Card, GlassPanel, Pin, PlaceRow, StopCard, TravelLeg, AvatarStack, DayPill.
- Building these first keeps the screen PRs small.

**Phase 3: web screens.**
- Order: Map, then Trip planner, then Shared trip, then Sign in and Welcome, then Place detail, then everything else.
- Map goes first because it's the home screen and the biggest file (`Explorer.tsx`, about 740 lines).

**Phase 4: iOS.** Same order.

**Phase 5: new features,** from the list below, prioritized separately.

## New features the design implies

These aren't styling. Scope them on their own.

1. **Copy this trip** (share page primary CTA).
   - Add an endpoint that copies the shared trip, its items and the places they reference into the viewer's account, then opens it.
   - Needs a sign-in gate (send people through `/signin` with a return URL), a policy for places the viewer already has saved, and a decision on whether notes come along.
   - If it's not ready, swap the CTA for your existing sign-up invite so the button never goes nowhere.
2. **Place photos and trip cover photos.**
   - The design leans on photography. Options: user uploads (you already have `@vercel/blob` and `expo-image-picker`), or a places photo API, which costs money and has attribution rules.
   - Either way, you need a no-photo fallback. Suggested: a tile in the category color with the emoji centered.
3. **Travel leg durations.**
   - Transport items already have a mode and start and end times, and there's a `lib/directions`. Derive "Train · 18 min" from those.
   - Only add a routing service if the times aren't entered.
4. **Counts and summaries.** "14 places saved", "7 days · 23 stops", "2 cities", and the Been stats. These are cheap queries, but somebody has to write them.
5. **Dot-matrix world map** for Been. A static SVG of country dots, with visited ones colored. The prototype has one generated with d3-geo and world-atlas (open data) if you want to reuse the approach.
6. **"Search this area"** chip after panning the map. It's in the desktop mockup. Skip it if the map already refetches on move.

## Using Claude Code on this

- Put this file in the repo (for example `docs/redesign-handoff.md`) and reference it in each prompt.
- Your `AGENTS.md` already warns that Next 16 differs from what models were trained on, and to read the bundled docs first. Keep that.
- Give it `roava-ios-prototype.html` for exact CSS values. It's more precise than describing screenshots.
- For Figma, use your own account with the Figma MCP (Jack's Starter plan has hit its read limit), or just screenshot frames into the chat.
- **Starter prompt for Phase 1:**

> Read docs/redesign-handoff.md. Implement Phase 1 only: update the tokens in src/app/globals.css, switch fonts in src/app/layout.tsx to Bricolage Grotesque and Geist via next/font/google keeping the same CSS variables, set the h1/.display weight to 800, update category colors in src/lib/taxonomy.ts and run the mirror sync, and restyle .roava-pin per the Pins section. Don't change any layouts. Then list every place readable text uses a color with less than 4.5:1 contrast on its background.

## Open questions

- **Palette:** does replacing the brand guide's navy and teal work for you?
- **Dark mode:** design it now, or ship light first?
- **Icons:** stay on your current set, or move to Phosphor?
- **Been view:** does it live on the map filter or on Journal?
- **Copy this trip:** in scope for v1?
- **Photos:** user uploads, a paid photo API, or both?

---

## Build log

What has actually been done against this brief, so the next person does not
have to diff the repo against it. Newest last.

**Phase 1 — tokens.** Done, with four deliberate differences from the table
above, each for a reason:

| | Brief | Built | Why |
| --- | --- | --- | --- |
| `--brand-surface` | Cream `#F7F1E8` | Evergreen 100 `#E4EDE8` | Not yet reconciled — the brief is probably right, this was read off the Foundations board |
| Text on Sun | Evergreen 950 `#0B211C` | Ink `#13241F` | 6.6:1 against 6.9:1; both pass, worth aligning |
| Active nav pill | Evergreen 100 | `--surface` | Not yet reconciled |
| Activity pin | `#D99A2B` | `#B8831F` | The brief's gold is 2.4:1 on a pale map — the only one of the ten below 3:1 |

Colour lives in `src/lib/brand.ts`, mirrored into the app and checked by
`npm run check:mirror`. A dark palette was derived rather than disabling the
dark block, built only from colours the boards already use.

**Phase 1 — fonts.** Done. Bricolage Grotesque and Geist via `next/font`,
`h1`/`.display` at 800. The app still has the old faces.

**Phase 1 — `.roava-pin`.** Not done.

**Phase 3 — screens.** Sign in, the map's list and top bar, and the place
detail card are done on web. The list follows the map viewport and names
itself from the places in it. Search moved into the bar.

**New features.** #2 place photos: solved a third way the brief does not
list — Wikipedia, free, with attribution stored and displayed. Filled in
lazily as you browse, `POST /api/places/photos`. Roughly half of real saved
places get one; the rest keep a category tile, which is the fallback the
brief suggests. #1 copy this trip, #3 travel legs, #5 dot-matrix map and #6
search-this-area are all untouched.

**About the photographs.** The AI placeholders were shipped to production by
mistake and then replaced. The sign-in now carries a real CC BY-SA
photograph of Oeschinensee with its credit. Nothing else in the product uses
the mockup images.

**Missing asset.** The `roava-redesign` folder never arrived — only this
brief. `roava-ios-prototype.html` is still worth asking Jack for; it is the
precise source for the glass, blur and shadow values, which are otherwise
being eyeballed from screenshots.

**Phase 0 decisions, settled 12 September.** Icons move to Phosphor. Dark
mode ships rather than being disabled.

**Icons.** Swapped at the source, which is what this brief suggests: the
eleven brand SVGs in `brand/icons` are Phosphor regular now, and both
generated sets are rebuilt from them, so the two platforms cannot drift.
Discover has its own compass rather than borrowing the people icon, which
Welcome uses to mean people.

Both generators had to learn one thing: Phosphor draws filled shapes that
inherit `fill` from the root, where the brand set drew strokes on a root of
`fill="none"`. The wrapper decided that for every icon, so a filled set came
out invisible. They carry the source's own value through now and can emit
either kind.
