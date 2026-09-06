# Dawn Run 5K — training tracker

A 7-week 5K training tracker (plan + food + sleep) that syncs across your devices.

- **Frontend:** plain HTML/CSS/JS bundled with **Vite**, hosted on **Vercel**
- **Backend:** **Supabase** (magic-link auth + one JSONB row per user, protected by Row Level Security)
- **Update loop:** edit code → `git push` → Vercel rebuilds automatically. Database changes go through `supabase/schema.sql`.

---

## Architecture in one picture

```
You (Claude Code)  ──edit──►  GitHub repo  ──auto-deploy──►  Vercel (live site)
                                                                  │
                                                          browser loads app
                                                                  │
                                              magic-link login + data read/write
                                                                  ▼
                                                     Supabase (Auth + Postgres)
```

Your whole app state is a single JSON object. It's mirrored to `localStorage` (instant + offline)
and upserted to Supabase table `tracker_state` (one row per user) whenever it changes.

---

## One-time setup

You'll do this once. Steps marked **(you)** need your login and can't be automated for you.

### 1. Supabase — create the backend **(you)**

1. Go to <https://supabase.com> → sign in → **New project**. Pick a name, a strong database
   password, and a region near you. Wait ~2 min for it to provision.
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql),
   and click **Run**. This creates the `tracker_state` table and its RLS policies.
3. Open **Project Settings → API** and copy two values:
   - **Project URL** → this is `VITE_SUPABASE_URL`
   - **Project API keys → `anon` / `public`** → this is `VITE_SUPABASE_ANON_KEY`
   (The anon key is meant to be public; RLS is what keeps each user's data private.)
4. Open **Authentication → Providers → Email** and make sure **Email** is enabled.
   For zero-friction login, turn **Confirm email** on and leave magic links enabled (default).

### 2. Run it locally **(optional, to preview before deploying)**

```bash
cd dawn-run-5k
npm install
cp .env.example .env.local     # then edit .env.local with your two real values
npm run dev                     # opens http://localhost:5174
```

> A placeholder `.env.local` may already exist from scaffolding — overwrite it with your real
> Supabase URL and anon key, or login will fail with "Failed to fetch".

For local magic links to work, add `http://localhost:5174` under
**Supabase → Authentication → URL Configuration → Redirect URLs**.

### 3. Push to GitHub **(you)**

```bash
cd dawn-run-5k
git init
git add .
git commit -m "Dawn Run 5K tracker"
gh repo create dawn-run-5k --private --source=. --push
# no gh CLI? create an empty repo on github.com, then:
#   git remote add origin https://github.com/<you>/dawn-run-5k.git
#   git branch -M main && git push -u origin main
```

`.env.local` is git-ignored, so your keys never land in the repo.

### 4. Vercel — deploy the frontend **(you)**

1. Go to <https://vercel.com> → **Add New… → Project** → **Import** your `dawn-run-5k` repo.
2. Vercel auto-detects **Vite** (Build: `npm run build`, Output: `dist`). Leave defaults.
3. Expand **Environment Variables** and add the same two keys (Production, Preview, Development):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**. You'll get a URL like `https://dawn-run-5k.vercel.app`.

### 5. Point Supabase auth at the live URL **(you)**

In **Supabase → Authentication → URL Configuration**:
- **Site URL:** `https://dawn-run-5k.vercel.app`
- **Redirect URLs:** add `https://dawn-run-5k.vercel.app` (and keep `http://localhost:5174` for local dev)

Open the site, enter your email, click the magic link in your inbox — you're in, and your data now
syncs to Supabase. Done.

---

## The update loop (what you asked for)

Once the above is wired, **you tell Claude what to change and the live site updates itself:**

- **Change the app** (plan, foods, styling, logic): edit files in `src/` or `index.html`, then:
  ```bash
  git add -A && git commit -m "describe the change" && git push
  ```
  Vercel sees the push and redeploys automatically in ~30–60s. Refresh the site to see it.

- **Change the database** (new columns/tables/policies): edit `supabase/schema.sql`, commit it so
  it's tracked, then paste the new statements into the **Supabase SQL Editor** and Run.
  (This app stores everything in one JSONB `data` column, so most app changes need **no** schema change.)

- **Preview branches:** push to a branch (not `main`) and Vercel gives you a temporary preview URL —
  handy for trying changes before they go live.

That's the whole loop: **Claude edits → push → Vercel redeploys.** Supabase only changes when you
deliberately run SQL.

---

## Project layout

```
dawn-run-5k/
├── index.html          # markup + styles + auth gate
├── src/
│   ├── main.js         # app logic + auth + Supabase sync
│   └── supabase.js     # Supabase client (reads env vars)
├── supabase/
│   └── schema.sql      # table + Row Level Security policies
├── .env.example        # template for your keys
├── package.json
└── vite.config.js
```

## Notes

- **Data model:** `tracker_state (user_id uuid pk, data jsonb, updated_at)`. RLS restricts every row
  to its owner (`auth.uid() = user_id`).
- **Offline:** the app reads from `localStorage` first, so it loads instantly and keeps working
  offline; changes sync up on the next save.
- Food macros are sensible **estimates**, not a precise nutrition database.
- Not medical advice — see a doctor before starting a new exercise program.
