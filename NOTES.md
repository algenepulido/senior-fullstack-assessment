# Notes

## What I built

**Backend (FastAPI + PostgreSQL)**

- `POST /auth/register` and `POST /auth/login` — bcrypt password hashing, JWT tokens signed with HS256 (24h expiry).
- `POST /sync` — pulls 12 products from dummyjson.com, inserts with `ON CONFLICT (external_id) DO NOTHING` so running it twice is safe.
- `GET /skus` — returns all SKUs with `quantity > 0`. Auth required.
- `GET /skus/{id}` — returns 404 when quantity is 0 or the SKU doesn't exist. Auth required.
- `POST /selections` — accepts 1 or 2 `sku_ids`. Uses `SELECT FOR UPDATE` on each row (sorted by id to avoid deadlock) inside a single transaction. If any SKU is sold out the whole transaction rolls back and the client gets a 409. Auth required; user id comes from the JWT, never from the request body.

**Database schema**

- `users`: id, email (unique), password_hash, created_at.
- `skus`: id, external_id (unique — enforces sync idempotency), title, price, thumbnail, quantity (CHECK >= 0), created_at.
- `selections`: id, user_id (FK users), sku_id (FK skus), created_at.

**Frontend (Expo / React Native Web)**

- `LoginScreen` — email + password fields, "Log In" and "Create Account" buttons, error display. Calls `setToken` then `onLoggedIn` on success.
- `ItemsScreen` — fetches `/skus` on mount, renders a 2-column grid of cards (image, title, price, quantity). Tap to toggle selection (max 2), accent border on selected cards. "Confirm (N)" button posts to `/selections`, clears selection, and re-fetches so sold-out items disappear immediately. Sign-out clears the token and returns to login.

## What I skipped on purpose and why

- **Pagination** — ruled out by the brief. 12 products fit in a single response.
- **Password reset, roles, admin, payments** — explicitly out of scope.
- **Refresh tokens** — a 24-hour JWT is sufficient for an assessment; production would use short-lived access tokens + refresh rotation.
- **Input sanitization beyond Pydantic** — Pydantic + parameterized queries cover the surface here.
- **Running sync automatically on startup** — left as an explicit `POST /sync` call so the evaluator controls when data is seeded.

## What I would do next

1. Add a `POST /sync` call in the startup lifespan (or a migration runner) so the app is self-seeding from a clean clone.
2. Introduce refresh tokens with a revocation table for production auth.
3. Add an index on `skus(quantity)` and `selections(user_id)` for scale.
4. Move the concurrency test into an actual integration test: two concurrent requests for the last unit, assert exactly one 201 and one 409.
5. Add rate limiting on `/auth/*` to defend against credential stuffing.

## What I would change about the brief or the API I was given

- `dummyjson.com` returns products with `stock` values up to 100. An assessment about sold-out concurrency works better with seeded items at quantity 1 or 2, so the constraint is easy to hit. I'd either seed with `MIN(stock, 3)` or add a `/seed` endpoint that explicitly sets low quantities.
- The brief says "select up to two" but `POST /selections` takes an array — it's worth clarifying whether a user can call it multiple times (accumulating more than two selections total) or whether two is a per-request and per-user lifetime cap. I treated it as per-request only.

## AI tool use

I used Claude to help write parts of this. I understand every line — the `SELECT FOR UPDATE` ordering, the `ON CONFLICT DO NOTHING` idempotency, the JWT flow, the React Native state. Happy to walk through any of it on the call.
