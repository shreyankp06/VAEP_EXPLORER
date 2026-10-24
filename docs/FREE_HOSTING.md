# Free-tier deployment

This repository can deploy the frontend to Vercel and the API to Render. The
API reads from the existing Supabase PostgreSQL database. The free hosting
plans have usage limits, and a Render service may sleep while idle.

## 1. Push the deployment branch

Push the branch you want to publish to GitHub. Keep `.env` and database
credentials out of the repository.

## 2. Deploy the API to Render

1. Sign in to Render and create a **Blueprint** from this repository.
2. Select the branch to deploy. Render reads `render.yaml` at the repository
   root and configures the API service.
3. When prompted, enter `DATABASE_URL` as a secret environment variable. Use
   the Supabase PostgreSQL connection string (not the Supabase project URL).
4. Wait for the service health check at `/api/healthz` to pass, then copy the
   service's public URL, for example `https://vaep-explorer-api.onrender.com`.

Do not put the database connection string in GitHub, Vercel, or frontend
variables.

## 3. Deploy the website to Vercel

1. Sign in to Vercel and import this GitHub repository.
2. Set the project root directory to `artifacts/vaep-explorer` and select the
   same branch used for the Render service. The app's `vercel.json` supplies
   the install, build, output, and single-page-app routing configuration.
3. Add the environment variable `VITE_API_URL` with the public Render service
   URL (for example, `https://vaep-explorer-api.onrender.com`). Do not add a
   trailing slash.
4. Deploy and open the Vercel URL. The frontend build embeds this public API
   URL; redeploy Vercel after changing it. In **Settings → Build and
   Deployment**, disable any Build Command and Output Directory overrides so
   Vercel uses the app's `vercel.json`.

## 4. Verify

- Open `https://<render-service>.onrender.com/api/healthz` and confirm it
  returns a healthy response.
- Open the Vercel site and check the dashboard, match replay, leaderboard,
  and scatter plot.
- If the API does not connect, check that Render has the correct Supabase
  `DATABASE_URL` and Vercel has the correct `VITE_API_URL`. The API currently
  allows cross-origin browser requests; its data endpoints are read-only.
