# Deployment (prepared, not deployed)

The site is a static Vite build. Nothing has been deployed.

Future Vercel project settings:

- Framework preset: Vite
- Root directory: `web`
- Build command: `npm run build`
- Output directory: `dist`

`web/vercel.json` rewrites `/protein/:id` to `index.html` so direct navigation and refresh work. Generated models and JSON in `web/public` ship with the build, so run the Python pipeline and commit its outputs first. Vercel serves HTTPS, which WebXR requires.
