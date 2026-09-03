from __future__ import annotations

import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("CUISINE_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "cuisine.sqlite3"
REQUIRE_AUTH = os.environ.get("CUISINE_REQUIRE_AUTH", "0").strip().lower() in {"1", "true", "yes", "on"}

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


def _clean_identifier(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9._@+-]+", "-", value)
    return value.strip("-")[:180]


def _header(request: Request, name: str) -> str:
    return (request.headers.get(name) or "").strip()


def identity_from_request(request: Request) -> dict[str, Any]:
    """Return the authenticated Authentik identity forwarded by Caddy.

    Production requests are accepted only when Authentik's forwarded identity is
    present. Local development can run without Authentik when
    CUISINE_REQUIRE_AUTH is not enabled.
    """
    uid = _header(request, "x-authentik-uid")
    username = _header(request, "x-authentik-username")
    name = _header(request, "x-authentik-name")
    email = _header(request, "x-authentik-email")
    groups_raw = _header(request, "x-authentik-groups")

    if not uid and not username and not email:
        if REQUIRE_AUTH:
            raise HTTPException(status_code=401, detail="Authentik identity required")
        return {
            "id": "local-alexis",
            "scope": "local:alexis",
            "uid": "",
            "username": "alexis",
            "name": "Alexis",
            "email": "",
            "groups": ["local-development"],
            "authentik": False,
        }

    stable = _clean_identifier(uid or username or email)
    if not stable:
        raise HTTPException(status_code=401, detail="Invalid Authentik identity")

    groups = [g.strip() for g in re.split(r"[|,;]", groups_raw) if g.strip()]
    display_name = name or username or (email.split("@", 1)[0] if email else "Utilisateur")
    return {
        "id": stable,
        "scope": f"auth:{stable}",
        "uid": uid,
        "username": username,
        "name": display_name,
        "email": email,
        "groups": groups,
        "authentik": True,
    }


def _legacy_candidates(identity: dict[str, Any]) -> list[str]:
    """Find V3.1 profile keys that can safely seed an Authentik profile once."""
    haystack = " ".join(
        str(identity.get(key) or "").lower()
        for key in ("username", "name", "email")
    )
    candidates: list[str] = []
    username = _clean_identifier(str(identity.get("username") or ""))
    if username:
        candidates.append(f"user:{username}")
    if "tiphaine" in haystack:
        candidates.append("user:tiphaine")
    if "alexis" in haystack:
        candidates.append("user:alexis")
    return list(dict.fromkeys(candidates))


def state_for_identity(identity: dict[str, Any]) -> dict[str, Any] | None:
    scope = str(identity["scope"])
    state = get_state(scope)
    if state is not None:
        return state

    # V3.1 migration. Copy, never delete, so rollback stays possible.
    if identity.get("authentik"):
        for legacy_scope in _legacy_candidates(identity):
            legacy = get_state(legacy_scope)
            if legacy is not None:
                put_state(scope, legacy)
                return legacy
    return None


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "app": "Cuisine",
        "version": "3.4",
        "storage": str(DB_PATH),
        "auth_required": REQUIRE_AUTH,
    }


@app.get("/api/me")
def me(request: Request) -> dict[str, Any]:
    identity = identity_from_request(request)
    return {k: v for k, v in identity.items() if k != "scope"}


@app.get("/api/me/state")
def read_my_state(request: Request) -> dict[str, Any]:
    identity = identity_from_request(request)
    return {"state": state_for_identity(identity)}


@app.put("/api/me/state")
def write_my_state(request: Request, payload: StatePayload) -> dict[str, bool]:
    identity = identity_from_request(request)
    put_state(str(identity["scope"]), payload.state)
    return {"ok": True}


# Deliberately no /api/users/{id} endpoint since V3.2.
# The browser can only read/write the identity authenticated by Authentik.

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
    # Never let a removed or mistyped API route fall through to the SPA.
    if path == "api" or path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")
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
