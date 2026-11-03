# Team backend import

The Laravel API is included as ordinary tracked source in `backend/`, so a clone of this frontend repository includes it. It is not a nested Git repository or a submodule.

- Source: https://github.com/Ratha-gift/Choronai_back.git
- Source branch: `main`
- Imported commit: `140121601a3fbb441a3702d24c3052fac9f6013a` (Add database diagram)
- Imported on: 2026-11-03

The upstream source is preserved, including its README, migrations, services, tests, Docker configuration and example environment file. Real environment files, dependencies and database files are not committed. Changes committed here do not automatically update the original backend repository.

## Run the Laravel API locally

From PowerShell at the frontend repository root, with Docker Desktop running:

```powershell
cd backend
Copy-Item .env.example .env
docker compose up -d --build
docker compose exec api composer install
docker compose exec api php artisan key:generate
docker compose exec api php artisan migrate --seed
```

Copy the example environment file only for first-time setup. The API runs at `http://localhost:8000/api/v1`, with PostgreSQL at port 5432. See [the backend README](../backend/README.md) for the API and development commands.

## Current frontend connection

The earlier workflow changes remain in this branch. The frontend still calls the Next.js `/api/session` and `/api/workspace` endpoints, backed by SQLite. Those files and the existing filters, register highlighting, stock and rewards updates have been preserved.

Importing the Laravel source does **not** connect the frontend to Laravel or transfer existing SQLite/browser data into PostgreSQL. These are separate data stores. Frontend authentication, resource requests, stock/sale commands and offline synchronization still need adapters to Laravel's `/api/v1` endpoints before switching the active backend. Avoid entering live data into both systems expecting it to synchronize.

See [the current workflow implementation](workflow-implementation.md) for what the existing frontend uses today. The imported backend's historical planning notes describe its own starting point, not the latest frontend connection.
