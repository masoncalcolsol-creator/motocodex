# MotoCodex Prototype Pack v1 (Supabase + Next.js) — Step-by-step “coding for dummies”

This pack gives you a **running prototype**:
- Manual ingest (paste title + url + summary)
- RSS ingest (optional)
- Simple scoring + dedupe
- Simple clustering into stories
- Console UI: Breaking / Today / Week
- Export “Daily Brief” script (copy/paste friendly)
- Optional Nocturnus closer (simple mode)

---

## 0) What you need installed (one time)
1) **Node.js LTS** (v18+)
2) A **Supabase project** (free tier is fine)

---

## 1) Create Supabase project + tables (literal steps)
1) Supabase → create a new project.
2) Left menu → **SQL Editor**
3) Click **New query**
4) Open this file in this zip: `supabase/migrations/0001_motocodex_core.sql`
5) Copy ALL of it → paste into Supabase SQL Editor
6) Click **RUN**
7) You should see “Success”

✅ Test immediately:
- Supabase → **Table Editor**
- Confirm these tables exist:
  - `news_items`, `sources`, `story_clusters`, `cluster_items`, `episode_facts`

STOP if you don’t see them.

---

## 2) Run the app locally (literal steps)
1) Unzip this pack somewhere easy (example: `C:\motocodex\`)
2) Open Terminal in that folder
3) Install:
```bash
npm install
```
4) Start dev server:
```bash
npm run dev
```
5) Open: http://localhost:3000  
If you see “MotoCodex Prototype”, you’re good.

---

## 3) Add Supabase keys (literal steps)
1) Supabase → Settings → API
2) Copy:
   - Project URL
   - Service Role key
3) In the project folder:
   - Copy `.env.example` → `.env.local`
4) Paste values inside `.env.local`

✅ Test immediately (new terminal):
```bash
curl -X POST http://localhost:3000/api/cron/health
```

If you set `CRON_SECRET`, use:
```bash
curl -X POST http://localhost:3000/api/cron/health -H "x-cron-secret: change_me"
```

---

## 4) Manual ingest test (FASTEST proof it works)
1) Open: http://localhost:3000/ingest
2) Paste a test headline → click **Save**
3) Open: http://localhost:3000/console
4) You should see your item in “Today”

If yes → ingestion works.

---

## 5) Run scoring (one change, then test)
```bash
curl -X POST http://localhost:3000/api/cron/score
```
Refresh `/console` and confirm the imp/cred/mom numbers show.

---

## 6) Run clustering (one change, then test)
```bash
curl -X POST http://localhost:3000/api/cron/cluster
```
Refresh `/console` and confirm “Story Clusters” populates.

---

## 7) Generate Daily Brief (one change, then test)
```bash
curl -X POST http://localhost:3000/api/cron/daily-brief
```
Open: http://localhost:3000/brief  
Copy/paste script from the big box.

---

## 8) Optional RSS ingest (ONLY after manual works)
1) Put RSS links in `.env.local` under `RSS_FEEDS=...`
2) Restart dev server
3) Run:
```bash
curl -X POST http://localhost:3000/api/cron/ingest-rss
```

---

## Build safety rules
- **Test after every step**
- **One change at a time**
- If something breaks, tell me:
  1) which step number
  2) the exact error text (copy/paste)

