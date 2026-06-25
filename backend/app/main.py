import warnings
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import auth as auth_api
from app.api import compliance as compliance_api
from app.api import events as events_api
from app.api import users as users_api
from app.api import permissions as permissions_api
from app.api import export as export_api
from app.api import fraud as fraud_api
from app.api import hooks as hooks_api
from app.api import model as model_api
from app.api import tenants as tenants_api
from app.core import task_registry
from app.core.cache import get_redis
from app.core.config import settings
from app.core.database import get_db, init_db
from app.core.logging_config import setup_logging
from app.core.middleware import RequestIdMiddleware

_WEAK_KEYS = frozenset({
    "CHANGE_ME",
    "dev-secret-key",
    "dev-secret-key-change-in-production",
    "secret",
    "changeme",
    "password",
})


def _validate_secret_key() -> None:
    key = settings.secret_key
    is_weak = key in _WEAK_KEYS or (not settings.debug and len(key) < 32)
    if is_weak:
        msg = (
            "SECRET_KEY non sécurisée détectée (valeur par défaut ou trop courte). "
            "Générez-en une avec : python -c \"import secrets; print(secrets.token_hex(32))\""
        )
        if settings.debug:
            warnings.warn(msg, stacklevel=2)
        else:
            raise RuntimeError(msg)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(debug=settings.debug)
    _validate_secret_key()
    init_db()
    yield
    await task_registry.drain(timeout=10.0)


app = FastAPI(
    title=settings.app_name,
    description="API de detection de fraude temps reel — Cote d'Ivoire & Senegal",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)

# ── Middlewares ───────────────────────────────────────────────────────────────

app.add_middleware(RequestIdMiddleware)

_origins = (
    ["*"]
    if settings.debug
    else [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=not settings.debug,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Swagger (debug only) ──────────────────────────────────────────────────────

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui() -> HTMLResponse:
    if not settings.debug:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title=settings.app_name + " - Swagger UI",
        swagger_js_url="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css",
    )

# ── Health checks ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
@app.get("/health/live", tags=["system"])
def liveness() -> dict:
    return {"status": "ok", "version": "1.0.0"}


@app.get("/health/ready", tags=["system"])
def readiness(db: Session = Depends(get_db)) -> JSONResponse:
    checks: dict[str, str] = {}

    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"

    try:
        get_redis().ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    try:
        kc_url = (
            f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
            "/.well-known/openid-configuration"
        )
        resp = httpx.get(kc_url, timeout=3, follow_redirects=False)
        checks["keycloak"] = "ok" if resp.is_success else f"error: HTTP {resp.status_code}"
    except Exception as exc:
        checks["keycloak"] = f"error: {exc}"

    all_ok = all(v == "ok" for v in checks.values())
    return JSONResponse(
        content={"status": "ready" if all_ok else "degraded", "checks": checks},
        status_code=200 if all_ok else 503,
    )


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(fraud_api.router,       prefix="/api/v1", tags=["scoring"])
app.include_router(tenants_api.router,     prefix="/api/v1", tags=["tenants"])
app.include_router(hooks_api.router,       prefix="/api/v1", tags=["hooks"])
app.include_router(auth_api.router,        prefix="/api/v1", tags=["auth"])
app.include_router(model_api.router,       prefix="/api/v1", tags=["model"])
app.include_router(compliance_api.router,  prefix="/api/v1", tags=["compliance"])
app.include_router(export_api.router,      prefix="/api/v1", tags=["export"])
app.include_router(events_api.router,      prefix="/api/v1", tags=["events"])
app.include_router(users_api.router,       prefix="/api/v1", tags=["users"])
app.include_router(permissions_api.router, prefix="/api/v1", tags=["permissions"])
