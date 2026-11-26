# FSBM Library

A French-language academic resource library for the Faculté des Sciences Ben M'Sik. The beta catalogue is scoped to Informatique Appliquée, semesters S1–S6. Public browsing, search, downloads and resource requests do not require student accounts.

## Architecture

- **Astro** generates the static, responsive public site for GitHub Pages.
- **Cloudflare Workers** exposes the API and enforces all privileged operations.
- **Cloudflare D1** stores the academic catalogue, resource metadata, requests, administrators, sessions and audit events.
- **Cloudflare R2** stores PDF files; the bucket is not public and files are served through the Worker.
- **TypeScript** is checked independently for the frontend and Worker.

The public site and API are separate origins. For dependable administrator sessions in modern browsers, use a custom domain for GitHub Pages (for example `library.example.org`) and a Worker custom domain under the same registrable domain (for example `api.library.example.org`). Browsers may block third-party cookies when using the default `github.io` and `workers.dev` hostnames, which can prevent cross-site admin sessions. Configure the exact public site origin in `wrangler.toml` (`APP_ORIGIN`) so the Worker can enforce origin checks and credentialed CORS. Do not use a wildcard origin.

## Requirements

- Node.js 22 or newer and npm
- A Cloudflare account with Workers, D1 and R2 enabled
- A GitHub repository with GitHub Pages configured to use **GitHub Actions**

## Local frontend

```sh
npm install
cp .env.example .env
# Set PUBLIC_API_URL to your deployed Worker URL in .env
npm run dev
```

## Cloudflare setup

1. Install and authenticate Wrangler: `npx wrangler login`.
2. Create the database and bucket:

   ```sh
   npx wrangler d1 create fsbm-library
   npx wrangler r2 bucket create fsbm-library-files
   ```

3. Copy the D1 `database_id` into `wrangler.toml`. Keep the bucket private; do not enable public R2 access.
4. Set `APP_ORIGIN` in `wrangler.toml` to the exact deployed frontend origin, for example `https://YOUR_GITHUB_OWNER.github.io` (the origin does not include a repository path).
5. Apply migrations and deploy:

   ```sh
   npm run db:remote
   npm run worker:check
   npm run worker:deploy
   ```

6. Configure the first Owner using Worker secrets. The bootstrap creates exactly one Owner only while the `admin_users` table is empty. Use a strong, unique password of at least 14 characters:

   ```sh
   npx wrangler secret put BOOTSTRAP_OWNER_EMAIL
   npx wrangler secret put BOOTSTRAP_OWNER_PASSWORD
   ```

   Deploy once with these secrets configured. After the Owner exists, remove the two bootstrap secrets from the Worker. The bootstrap credentials are not a permanent login mechanism.

7. Set the `PUBLIC_API_URL` and `PUBLIC_SITE_URL` GitHub Actions repository **variables** under Settings → Secrets and variables → Actions → Variables. `PUBLIC_API_URL` must be the Worker custom-domain origin, without a trailing slash. `PUBLIC_SITE_URL` is the frontend origin. Keep both hosts under the same registrable domain so the secure `SameSite=Lax` admin cookie works across the two origins. Do not put secrets in these variables.

## GitHub Pages deployment

The workflow in `.github/workflows/pages.yml` uses `npm install`, runs frontend checks, Worker TypeScript checks and a production build, then uploads `dist` using the official Pages artifact action. It derives the project Pages base path from `GITHUB_REPOSITORY`; user/organization Pages repositories use the root path. For a custom domain, set `PUBLIC_SITE_URL` to that domain and `PUBLIC_BASE_PATH` to an empty value if needed.

In repository Settings → Pages, choose **GitHub Actions** as the build and deployment source. Push to `main` or run the workflow manually.

## Administration

Open `/admin/` on the deployed site. The initial Owner can create Editor and additional Owner accounts. Roles are enforced by the Worker, not by UI visibility:

- **Owner:** manage resources, modules and requests; create administrator accounts; permanently delete resources.
- **Editor:** manage modules, upload and publish resources, and process requests; cannot create administrators or permanently delete resources.

The Worker uses PBKDF2-SHA-256 password hashes, random opaque session tokens stored only as hashes in D1, HttpOnly/Secure/SameSite=Lax cookies for same-site cross-origin requests, short-lived sessions, origin checks, login throttling and an audit log. The frontend must use credentialed fetch requests. Use HTTPS for both origins.

## Resource workflow

An administrator creates a resource record, uploads a PDF (15 MiB default limit), and then publishes it. The Worker checks the PDF content signature, computes SHA-256, generates an opaque R2 key, and stores the file privately. Public download routes only return published resources and increment the download counter. Change `MAX_UPLOAD_BYTES` in `wrangler.toml` only after considering Worker request limits and operational costs.

The initial programme and six semesters are seeded by `migrations/0001_initial.sql`. Module names are intentionally not fabricated: add the verified official module names in the admin dashboard.

## Checks

```sh
npm install
npm run check          # Astro + frontend TypeScript
npm run worker:check   # Worker TypeScript
npm run build          # production static build
npm run verify         # all checks and build
```

For a local Worker and D1 database, use `npm run worker:dev` and `npm run db:local`. Configure local values in `.dev.vars` (ignored by Git), and set the local D1 database id/binding according to Wrangler's generated local configuration. Do not commit credentials or `.dev.vars`.

## Data and operations

D1 migrations are versioned in `migrations/`. Back up D1 and R2 independently, keep encrypted off-site copies, verify SHA-256 manifests, and test restores. See [`docs/backup-policy.md`](docs/backup-policy.md) and [`docs/data-model.md`](docs/data-model.md).

## Security and limitations

- Never expose R2 publicly or place Cloudflare credentials in frontend variables.
- Restrict `APP_ORIGIN` to the exact frontend origin.
- Configure Cloudflare platform-level rate limiting/WAF for production; the application also throttles login attempts and public resource requests.
- Uploads are PDF-only and size-limited. Before production launch, add malware scanning/content moderation if the institution's risk policy requires it.
- This repository does not claim to include verified official module data, institutional SSO, email notifications, or automated off-site backups.
- Student access is intentionally anonymous; the optional contact field on requests is used only to follow up.
