-- Starting point. Change it as you see fit. Apply with:
--   psql postgresql://assessment:assessment@localhost:5432/assessment -f schema.sql
CREATE TABLE IF NOT EXISTS users (
    id            bigserial PRIMARY KEY,
    email         text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS skus (
    id          bigserial PRIMARY KEY,
    external_id integer UNIQUE NOT NULL,
    title       text NOT NULL,
    price       numeric(10,2) NOT NULL,
    thumbnail   text NOT NULL,
    quantity    integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS selections (
    id         bigserial PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES users(id),
    sku_id     bigint NOT NULL REFERENCES skus(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
