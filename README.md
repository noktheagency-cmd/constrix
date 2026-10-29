# AFEZ local development

Run `npm run dev` from this directory to start the frontend and API together.

The API port is configured with `PORT` in `backend/.env` (default: `3001`).
Vite reads the same setting for its `/api` proxy. If another application uses
that port, choose a free port, for example `PORT=3002`, then restart
`npm run dev`. A `PORT` environment variable in your terminal overrides the file
for both servers.

`npm run dev` checks that both the API port and frontend port are free, and that
PostgreSQL responds before starting. The API starts first; Vite starts only after
`/api/health` succeeds. Wait for `[AFEZ] READY` before opening the UI. If AFEZ is
already running, use that instance or press `Ctrl+C` in its terminal before
starting again. `npm run start:dev` in `backend` performs the same check.
The frontend stays on port `5173`; if either development command exits, the
combined runner stops the other one too.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
