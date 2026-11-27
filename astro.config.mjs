import { defineConfig } from 'astro/config';

const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const isProjectPage = Boolean(repository && !repository.endsWith('.github.io'));
const defaultSite = owner ? `https://${owner}.github.io` : 'https://example.com';
const site = process.env.PUBLIC_SITE_URL || defaultSite;
const isCustomDomain = Boolean(owner && new URL(site).hostname !== `${owner}.github.io`);
const defaultBase = isProjectPage && !isCustomDomain ? `/${repository}` : '/';
const configuredBase = process.env.PUBLIC_BASE_PATH?.trim();
const base = configuredBase ? (configuredBase.startsWith('/') ? configuredBase : `/${configuredBase}`) : defaultBase;

export default defineConfig({
  output: 'static',
  site,
  base,
  build: { assets: '_assets' },
});