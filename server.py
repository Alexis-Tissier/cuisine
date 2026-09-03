from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("CUISINE_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "cuisine.sqlite3"

app = FastAPI(title="Cuisine", docs_url=None, redoc_url=None)


class StatePayload(BaseModel):
    state: dict[str, Any]


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS app_state (
            scope TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    return con


def get_state(scope: str) -> dict[str, Any] | None:
    with connect() as con:
        row = con.execute("SELECT data FROM app_state WHERE scope = ?", (scope,)).fetchone()
    return json.loads(row["data"]) if row else None


def put_state(scope: str, state: dict[str, Any]) -> None:
    payload = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    with connect() as con:
        con.execute(
            """
            INSERT INTO app_state(scope, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(scope) DO UPDATE SET
                data = excluded.data,
                updated_at = CURRENT_TIMESTAMP
            """,
            (scope, payload),
        )
        con.commit()


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "app": "Cuisine", "storage": str(DB_PATH)}


@app.get("/api/global")
def read_global() -> dict[str, Any]:
    return {"state": get_state("global")}


@app.put("/api/global")
def write_global(payload: StatePayload) -> dict[str, bool]:
    put_state("global", payload.state)
    return {"ok": True}


@app.get("/api/users/{user_id}/state")
def read_user_state(user_id: str) -> dict[str, Any]:
    if not user_id or len(user_id) > 120:
        raise HTTPException(status_code=400, detail="Invalid user id")
    return {"state": get_state(f"user:{user_id}")}


@app.put("/api/users/{user_id}/state")
def write_user_state(user_id: str, payload: StatePayload) -> dict[str, bool]:
    if not user_id or len(user_id) > 120:
        raise HTTPException(status_code=400, detail="Invalid user id")
    put_state(f"user:{user_id}", payload.state)
    return {"ok": True}


STATIC_FILES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/app.js": "app.js",
    "/styles.css": "styles.css",
    "/manifest.webmanifest": "manifest.webmanifest",
    "/sw.js": "sw.js",
}


@app.get("/{path:path}", include_in_schema=False)
def static(path: str):
    request_path = "/" + path
    filename = STATIC_FILES.get(request_path)
    if filename:
        file_path = BASE_DIR / filename
        if file_path.exists():
            return FileResponse(
                file_path,
                headers={
                    "Cache-Control": "no-cache"
                    if filename in {"index.html", "app.js", "styles.css", "sw.js"}
                    else "public, max-age=3600"
                },
            )
    if "." not in path:
        return FileResponse(BASE_DIR / "index.html", headers={"Cache-Control": "no-cache"})
    raise HTTPException(status_code=404, detail="Not found")
