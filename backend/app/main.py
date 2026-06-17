import warnings
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth as auth_api
from app.api import compliance as compliance_api
from app.api import fraud as fraud_api
from app.api import model as model_api
from app.api import tenants as tenants_api
from app.core.config import settings
from app.core.database import init_db
from app.core.logging_config import setup_logging

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
    # En production : clé absente de la liste noire ET longueur >= 32 caractères
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


# Swagger/ReDoc désactivés en production
_docs_url = "/docs" if settings.debug else None
_redoc_url = "/redoc" if settings.debug else None

app = FastAPI(
    title=settings.app_name,
    description="API de detection de fraude temps reel — Cote d'Ivoire & Senegal",
    version="1.0.0",
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    lifespan=lifespan,
)

# CORS : wildcard uniquement en debug, liste blanche en production
_origins = (
    ["*"]
    if settings.debug
    else [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=not settings.debug,  # credentials=True interdit avec allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "version": "1.0.0"}


app.include_router(fraud_api.router, prefix="/api/v1", tags=["scoring"])
app.include_router(tenants_api.router, prefix="/api/v1", tags=["tenants"])
app.include_router(auth_api.router, prefix="/api/v1", tags=["auth"])
app.include_router(model_api.router, prefix="/api/v1", tags=["model"])
app.include_router(compliance_api.router, prefix="/api/v1", tags=["compliance"])
