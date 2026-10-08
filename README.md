# Renomates

Real renovation costs, trades and council experiences from your neighbours. A plain HTML/CSS/JavaScript site with no build step, backed by [Supabase](https://supabase.com) for logins, database, photos and private messages.

```
index.html          the page
favicon.svg/.ico    browser tab icon (built from your logo)
site.webmanifest    lets people add the site to their phone's home screen
assets/             your logo plus generated icons and the social share image
css/styles.css      styling
js/config.js        YOUR Supabase URL + anon key go here
js/app.js           all the app logic
data/suburbs.json   Australian suburbs + postcodes (lazy-loaded)
supabase/schema.sql database tables, security rules, photo storage
```

## 1. Create the Supabase project (10 minutes)

1. Sign up at supabase.com and create a new project. Pick the Sydney region. Save the database password somewhere safe.
2. Open **SQL Editor > New query**, paste the whole of `supabase/schema.sql`, and click **Run**. It should say "Success".
3. Open **Project Settings > API**. Copy the **Project URL** and the **anon public** key into `js/config.js`.
   The anon key is meant to be public. Never paste the `service_role` key anywhere in this repo.
4. Open **Authentication > URL Configuration**. Set **Site URL** to your live address (for example `https://www.yourdomain.com.au`) and add it, plus `http://localhost:8000`, under **Redirect URLs**. Do this again whenever your address changes.
5. Open **Authentication > Providers > Email**. Leaving "Confirm email" on is safest for a public site. Turn it off only while testing.
6. Optional, Google sign-in: create OAuth credentials in Google Cloud (type "Web application"), add the callback URL shown in Supabase under Authentication > Providers > Google, then paste the client ID and secret there.

## 2. Try it on your computer

You need Python (already on most Macs) or any static server:

```
python3 -m http.server 8000
```

Open http://localhost:8000, create an account, share a reno with photos, and open it again to check it saved. Opening `index.html` by double-clicking will not work, because browsers block some features on `file://` pages.

## 3. Put it on GitHub

1. Create a repository on github.com (private is fine).
2. Click **Add file > Upload files** and drag in everything from this folder (the folders `css`, `js`, `data`, `supabase` plus `index.html`, `README.md`, `.gitignore`). If you uploaded the zip, unzip it first.
3. Edit `js/config.js` so it has your real URL and anon key, then commit.

## 4. Host it (free options)

Any static host works. Settings are the same everywhere: **no build command, publish directory is the root** (`/` or `.`).

- **Cloudflare Pages:** Workers & Pages > Create > Pages > Connect to Git > pick the repo.
- **Netlify:** Add new project > Import from Git. Leave build command blank, publish directory `.`
- **Vercel:** Add New > Project > import the repo. Framework: Other.
- **GitHub Pages:** Settings > Pages > deploy from the main branch.

Every time you commit to `main`, the host republishes automatically.

Check each provider's current free-tier limits and pricing before you rely on them.

## 5. Point your GoDaddy domain at it
(Do step 5b below too, so shared links show your logo.)

Your host shows the exact DNS records when you add a custom domain. In GoDaddy: My Products > your domain > DNS > Manage DNS. Replace the old records for `@` and `www` with the ones the host gives you. Leave any MX/TXT (email) records alone. Then add the new address to Supabase (step 1.4).

### 5b. Set your real web address in index.html

Open `index.html` and replace `YOUR-DOMAIN` (it appears in 4 places near the top) with your real address, for example `www.renomates.com.au`. Facebook, WhatsApp, iMessage and LinkedIn need the full address to show the share image (`assets/og-image.png`). After changing it, you can test with Facebook's Sharing Debugger.

## 6. Run the site

- **Reports:** Supabase > Table Editor > `reports` shows what people flagged. To remove a listing, delete its row in `renos` (its photos rows go too; also delete the files in Storage > reno-photos > that user's folder).
- **Costs and storage:** photos are resized to 1600px on the device and a 480px thumbnail is made. Watch your usage in Supabase > Project Settings > Usage.
- **Backups:** check what your Supabase plan includes, and export tables before big changes.

## Known limits (good next steps)

- Individual renos can be shared with a link (`#r=...`) but are not separate pages for Google to index. Search-friendly pages for each suburb or reno need a small server-side step.
- Messages are private to the two people, but there is no block button yet. Reports go to you.
- "Unread" dots are remembered per browser, not per account.
- HEIC photos work in Safari (iPhone) but some desktop browsers cannot read them.
- Costs are self-reported and not verified. Have a lawyer review your terms of use and privacy policy before you promote the site, especially because members can name tradies.
- Map tiles come from OpenStreetMap's public servers, which are meant for light use. Switch to a tile provider such as MapTiler when traffic grows.
