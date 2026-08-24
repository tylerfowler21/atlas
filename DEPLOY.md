# Putting Atlas online

Follow these in order. Roughly 30 minutes, mostly waiting on other people's
websites. Everything here needs *your* accounts, which is why it isn't
automated.

You'll do Google twice: once now to get your keys, and once at the end to tell
it your real web address (which doesn't exist yet).

---

## 1. Get a database (5 min)

1. Go to **https://neon.tech** and sign up (free).
2. Click **Create project**. Any name. Any region near you.
3. On the project page find **Connection string** and copy it.
   It looks like:
   ```
   postgresql://user:password@ep-something.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

⚠️ **Change the ending from `?sslmode=require` to `?sslmode=verify-full`.**
Both work today, but `verify-full` explicitly means "check the certificate and
the hostname", and it will keep doing so after the Postgres driver's next major
version. Use that form everywhere you paste this string.

**Keep this somewhere for a minute. It's a password — don't paste it into
chat, a ticket, or a commit.**

---

## 2. Get Google sign-in keys (10 min)

1. Go to **https://console.cloud.google.com**
2. Top-left project dropdown → **New project** → name it `Atlas` → **Create**.
   Make sure the dropdown shows `Atlas` before continuing.
3. Left menu → **APIs & Services** → **OAuth consent screen**
   - User type: **External** → **Create**
   - App name: `Atlas`
   - User support email: your email
   - Developer contact email: your email
   - **Save and continue** through the remaining steps. You don't need to add
     scopes or test users.
4. Left menu → **Credentials** → **+ Create credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Atlas web`
   - Under **Authorised redirect URIs** click **+ Add URI** and paste exactly:
     ```
     http://localhost:3100/api/auth/callback/google
     ```
     (Just this one for now. The real address comes in step 5.)
   - **Create**
5. A box appears with **Client ID** and **Client secret**. Copy both.

> **This must match character for character.** Google compares the redirect URI
> as a literal string. No trailing slash, `http` not `https` for localhost.

---

## 3. Put the code on GitHub (5 min)

Atlas is already a git repository with everything committed. It just has
nowhere to go yet.

1. Go to **https://github.com/new**
2. Repository name: `atlas`. Choose **Private**.
3. **Do not** tick "Add a README" — the repo already has one.
4. **Create repository**.
5. Copy the URL it shows, then run this in the project folder, replacing
   `YOUR-USERNAME`:

```bash
git remote add origin https://github.com/YOUR-USERNAME/atlas.git && git push -u origin main
```

Your `.env` file is **not** uploaded — it's in `.gitignore`. Secrets go into
Vercel's settings instead, in the next step.

---

## 4. Deploy on Vercel (10 min)

1. Go to **https://vercel.com** and sign in **with GitHub**.
2. **Add New… → Project** → find `atlas` → **Import**.
3. Before clicking Deploy, open **Environment Variables** and add these four.

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `AUTH_SECRET` | run `openssl rand -base64 33` and paste the output |
   | `AUTH_GOOGLE_ID` | Client ID from step 2 |
   | `AUTH_GOOGLE_SECRET` | Client secret from step 2 |

   **Do not add `ALLOW_DEV_LOGIN`.** That's the local password-free login.

4. **Deploy**, and wait.
5. When it finishes, Vercel shows your address, something like
   `https://atlas-abc123.vercel.app`. **Copy it.**

Signing in will not work yet — one step to go.

---

## 5. Tell Google your real address (2 min)

1. Back in **Google Cloud → APIs & Services → Credentials**
2. Click your `Atlas web` client.
3. Under **Authorised redirect URIs** → **+ Add URI**, paste your Vercel
   address with `/api/auth/callback/google` on the end:
   ```
   https://atlas-abc123.vercel.app/api/auth/callback/google
   ```
4. **Save.** Changes can take a few minutes to take effect.

Not sure of the exact text? Run this and it prints it for you:

```bash
npm run preflight -- https://atlas-abc123.vercel.app
```

---

## 6. Create the tables (2 min)

The database is empty. Run this once from the project folder, pasting your Neon
string:

```bash
DATABASE_URL="postgresql://...your neon string..." npm run db:migrate
```

Then check everything is right:

```bash
DATABASE_URL="postgresql://...your neon string..." npm run preflight
```

You want all ticks.

> This is deliberately a manual step. Vercel gives every branch a preview
> deployment sharing this same database, so running migrations automatically
> during a build would let an untested branch change your live data.

**Now open your Vercel address and sign in with Google.** It should work.

---

## 7. Let other people in (2 min)

Right now only *you* can sign in. Google keeps new apps in "Testing" mode.

1. **Google Cloud → APIs & Services → OAuth consent screen**
2. Click **Publish app** → confirm.

That's the switch that turns "just me" into "everyone". Until you click it,
friends get an error telling them the app hasn't completed verification.

Google may ask you to verify the app if you request sensitive permissions.
Atlas only asks for name, email and profile picture, which is the basic tier —
no verification review needed.

---

## 8. Move your existing places over

Your original places and trips are in `atlas-export.json`. After you've signed
in to the live site once with Google:

```bash
DATABASE_URL="postgresql://...your neon string..." npm run db:import -- your.real@gmail.com
```

Use the same email you signed in with.

---

## Later: deploying changes

Push to `main` and Vercel redeploys automatically.

If you changed `prisma/schema.prisma`, you need a migration. With
`npm run db:dev` running and your local database up to date:

```bash
DIR="prisma/migrations/$(date +%Y%m%d%H%M%S)_change" && mkdir -p "$DIR" && npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > "$DIR/migration.sql"
```

Read the generated `migration.sql`, then apply it locally and to production:

```bash
npm run db:migrate
DATABASE_URL="postgresql://...your neon string..." npm run db:migrate
```

Commit the new folder along with the schema change.

(The usual `prisma migrate dev` doesn't work here: it wants to create a second
"shadow" database to work things out, and the local PGlite database can only
be one database. `migrate diff` against the running database does the same job
without one.)

---

## When something doesn't work

**"Error 400: redirect_uri_mismatch" when signing in**
The address in Google doesn't exactly match. It must be your site's address
plus `/api/auth/callback/google` — no trailing slash, `https` for the live
site. Run `npm run preflight -- https://your-address` to see the exact string.

**"Access blocked: Atlas has not completed the Google verification process"**
You skipped step 7. Publish the consent screen.

**Site loads but every page errors**
The tables probably aren't there. Run step 6.

**"Configuration" error on sign-in**
`AUTH_SECRET`, `AUTH_GOOGLE_ID` or `AUTH_GOOGLE_SECRET` is missing or has a
stray space in Vercel's settings. Fix it, then **redeploy** — environment
variable changes don't apply to an already-built deployment.

**Signed in, but my places are gone**
Accounts are separate, and the live database is a different database from your
laptop's. Run step 8.

**Anything else**
`npm run preflight` locally, and `DATABASE_URL="..." npm run preflight` against
production. It checks the database, the schema and every variable, and tells
you what to fix.
