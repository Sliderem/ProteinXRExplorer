# Vercel deployment

Production went live on 2026-11-21 at [protein-xr-explorer.vercel.app](https://protein-xr-explorer.vercel.app). The first release was deployed with the Vercel CLI.

| Setting | Value |
|---|---|
| Vercel project | `protein-xr-explorer` |
| Account scope | `emilianmihailescu-2845` |
| Project ID | `prj_i5rpFXYpObBbIJ5AalYzpdgXtXzw` |
| Org ID | `team_kXPCkxP0oIPRhDgLwUTl1dNn` |
| Local app directory | `web/` |
| Framework | Vite |
| Build command | `npm run build` (TypeScript check and Vite build) |
| Output directory | `dist`, relative to `web/` |
| Backend or production environment variables | None required |

[Initial production deployment in Vercel](https://vercel.com/emilianmihailescu-2845/protein-xr-explorer/EDmi8x41Vi5fAtAjqT3YTAMn95LM)

The browser fetches the registry and protein assets from the same origin. The Python pipeline runs locally. If protein data changes, regenerate the relevant GLB and JSON under `web/public/` before building. The rewrite in `web/vercel.json` serves `index.html` for direct visits to `/protein/:id`. Vercel provides the HTTPS required by WebXR.

## Release from a local checkout

Run the checks from the repository root. Fix any failures before deploying.

```bash
scripts/test-local.sh
```

Run the following commands from `web/`. If the CLI is signed out, run `npx vercel login` and approve the browser prompt. For a fresh checkout, link to the existing production project. Check `.vercel/project.json` for the project and org IDs above before deploying.

```bash
cd web
npx vercel whoami
npx vercel link --scope emilianmihailescu-2845 --project protein-xr-explorer
npx vercel --prod --scope emilianmihailescu-2845
```

CLI authentication belongs to the local operator. Vercel may create an ignored `.env.local` containing an OIDC token when linking. Keep `.vercel/` and `.env*` files out of commits.

## Production verification

Check the stable production URL after each release.

```bash
base=https://protein-xr-explorer.vercel.app
for route in / /protein/P01012 /proteins.json /proteins/P01012/metadata.json /proteins/P01012/model.glb; do
  curl -fsS -o /dev/null -w "%{http_code} %{content_type} $route\n" "$base$route" || exit 1
done
```

Expect HTTP 200 for each route. Open `/protein/P01012` in a browser and check that the ovalbumin metadata and 3D viewer render. Use the [Quest checklist](quest-testing.md) for headset verification.

The initial release passed all 9 Python tests and the production build. The production routes, JavaScript bundle, and model returned HTTP 200. The served GLB matched the checked-in model, and headless Chrome rendered the ovalbumin metadata and WebGL canvas. The earlier physical Quest 3 test used an HTTPS tunnel.
