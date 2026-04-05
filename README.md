# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

---

# mini_app_ui

Telegram Mini App (React + Vite) for the `tg_bot` FastAPI `/api/webapp` routes.

## Local dev

1. Run `tg_bot` with Uvicorn (e.g. `http://127.0.0.1:8000`).
2. Copy `.env.example` → `.env` and set `VITE_DEV_PROXY_TARGET` if your API is not on port 8000.
3. `npm install` && `npm run dev`

## Deploy on Vercel

1. Import this repo in [Vercel](https://vercel.com) (root = `mini_app_ui` if the repo is a monorepo, set **Root Directory** accordingly).
2. **Environment variable (required):** `VITE_API_URL` = your public API base, e.g. `https://your-server.com/api/webapp` (no trailing slash). The FastAPI app must use **HTTPS** and stay reachable from the internet.
3. Deploy. Set **`MINI_APP_URL`** in the bot’s `.env` to the production URL (e.g. `https://your-app.vercel.app`).
4. In [@BotFather](https://t.me/BotFather), set the menu button Web App URL to the same URL if you rely on that flow.

`vercel.json` includes an SPA fallback rewrite. `tg_bot` already allows CORS `*` for browser calls.
