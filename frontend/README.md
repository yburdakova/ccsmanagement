# Frontend Run Modes

This frontend supports two development modes only:

1. Local backend mode
2. Remote backend mode

## Commands

Run from `frontend/`:

```bash
npm run dev:local
```

Uses `frontend/.env.local` and targets local backend.

```bash
npm run dev:remote
```

Uses `frontend/.env.remote` and targets deployed backend.

## Environment Variables

Required:

- `VITE_API_BASE_URL` (example: `http://localhost:4000/api`)
- `VITE_DEBUG_LOGS` (`true` or `false`)
