import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from db import close_pool, get_conn, open_pool

load_dotenv()

PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "https://dummyjson.com/products?limit=12")
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer()


def make_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": exp}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def current_user_id(creds: Annotated[HTTPAuthorizationCredentials, Depends(bearer)]) -> int:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "invalid_token", "message": "Invalid or expired token"})


@asynccontextmanager
async def lifespan(_: FastAPI):
    open_pool()
    yield
    close_pool()


app = FastAPI(title="Assessment API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


@app.get("/health")
def health():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1")
        cur.fetchone()
    return {"ok": True}


class AuthBody(BaseModel):
    email: EmailStr
    password: str


@app.post("/auth/register", status_code=201)
def register(body: AuthBody):
    hashed = pwd_ctx.hash(body.password)
    with get_conn() as conn, conn.cursor() as cur:
        try:
            cur.execute(
                "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id",
                (body.email, hashed),
            )
            user_id = cur.fetchone()[0]
            conn.commit()
        except Exception:
            conn.rollback()
            raise HTTPException(
                status_code=409,
                detail={"code": "email_taken", "message": "Email already registered"},
            )
    return {"token": make_token(user_id)}


@app.post("/auth/login")
def login(body: AuthBody):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, password_hash FROM users WHERE email = %s", (body.email,))
        row = cur.fetchone()
    if not row or not pwd_ctx.verify(body.password, row[1]):
        raise HTTPException(
            status_code=401,
            detail={"code": "bad_credentials", "message": "Invalid email or password"},
        )
    return {"token": make_token(row[0])}


@app.post("/sync", status_code=200)
def sync():
    with httpx.Client(timeout=10) as client:
        data = client.get(PUBLIC_API_URL).raise_for_status().json()
    products = data.get("products", data) if isinstance(data, dict) else data
    inserted = 0
    with get_conn() as conn, conn.cursor() as cur:
        for p in products:
            cur.execute(
                """
                INSERT INTO skus (external_id, title, price, thumbnail, quantity)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (external_id) DO NOTHING
                """,
                (p["id"], p["title"], p["price"], p.get("thumbnail", ""), p.get("stock", 2)),
            )
            inserted += cur.rowcount
        conn.commit()
    return {"inserted": inserted, "total": len(products)}


@app.get("/skus")
def list_skus(_uid: Annotated[int, Depends(current_user_id)]):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, title, price, thumbnail, quantity FROM skus WHERE quantity > 0 ORDER BY id"
        )
        rows = cur.fetchall()
    return [
        {"id": r[0], "title": r[1], "price": float(r[2]), "thumbnail": r[3], "quantity": r[4]}
        for r in rows
    ]


@app.get("/skus/{sku_id}")
def get_sku(sku_id: int, _uid: Annotated[int, Depends(current_user_id)]):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, title, price, thumbnail, quantity FROM skus WHERE id = %s AND quantity > 0",
            (sku_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "SKU not found or sold out"})
    return {"id": row[0], "title": row[1], "price": float(row[2]), "thumbnail": row[3], "quantity": row[4]}


class SelectionBody(BaseModel):
    sku_ids: list[int]


@app.post("/selections", status_code=201)
def create_selection(body: SelectionBody, user_id: Annotated[int, Depends(current_user_id)]):
    if not body.sku_ids or len(body.sku_ids) > 2:
        raise HTTPException(status_code=422, detail={"code": "invalid_input", "message": "Provide 1 or 2 sku_ids"})

    with get_conn() as conn, conn.cursor() as cur:
        try:
            # sort ids so concurrent requests always acquire locks in the same order
            for sku_id in sorted(set(body.sku_ids)):
                cur.execute("SELECT quantity FROM skus WHERE id = %s FOR UPDATE", (sku_id,))
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail={"code": "not_found", "message": f"SKU {sku_id} not found"})
                if row[0] < 1:
                    raise HTTPException(status_code=409, detail={"code": "sold_out", "message": f"SKU {sku_id} is sold out"})
                cur.execute("UPDATE skus SET quantity = quantity - 1 WHERE id = %s", (sku_id,))
                cur.execute("INSERT INTO selections (user_id, sku_id) VALUES (%s, %s)", (user_id, sku_id))
            conn.commit()
        except HTTPException:
            conn.rollback()
            raise
        except Exception:
            conn.rollback()
            raise HTTPException(status_code=500, detail={"code": "server_error", "message": "Unexpected error"})

    return {"ok": True}
