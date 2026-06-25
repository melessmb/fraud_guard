import warnings

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "fraud-detection-ouest-afrique"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Security (conservé pour compatibilité hash API keys existantes)
    secret_key: str = "CHANGE_ME"

    # Keycloak — IdP centralisé
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "fraudguard"
    # Audience JWT : si non vide, le claim "aud" du token est vérifié
    keycloak_client_id: str = ""
    # Keycloak Admin API (master realm)
    keycloak_admin_user: str = "admin"
    keycloak_admin_password: str = "admin"

    # CORS — liste de domaines séparés par virgule ; "*" uniquement en debug
    cors_origins: str = "*"

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/fraud_ouest_afrique"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Rate limiting
    rate_limit_enabled: bool = True
    rate_limit_score: str = "100/minute"       # endpoint /score (par IP)
    rate_limit_login: str = "10/minute"        # endpoint /auth/login (anti brute-force)
    rate_limit_batch: str = "20/minute"        # endpoint /tenants/{id}/events (batch)
    rate_limit_default: str = "300/minute"     # tous les autres endpoints

    # Monitoring (optional)
    prometheus_enabled: bool = True


settings = Settings()

# ── Validation de sécurité au démarrage ───────────────────────────────────────

if not settings.debug:
    if settings.secret_key in ("CHANGE_ME", "dev-secret-key-change-in-production", ""):
        raise RuntimeError(
            "SECRET_KEY non sécurisée en production. "
            "Définissez SECRET_KEY dans les variables d'environnement."
        )
    if settings.cors_origins == "*":
        raise RuntimeError(
            "CORS_ORIGINS='*' interdit en production. "
            "Définissez CORS_ORIGINS avec les domaines autorisés."
        )
    if not settings.keycloak_client_id:
        warnings.warn(
            "KEYCLOAK_CLIENT_ID non configuré : la vérification d'audience JWT est désactivée. "
            "Définissez KEYCLOAK_CLIENT_ID pour renforcer la sécurité des tokens.",
            stacklevel=1,
        )
else:
    if settings.secret_key in ("CHANGE_ME", "dev-secret-key-change-in-production"):
        warnings.warn("⚠ SECRET_KEY par défaut — ne pas utiliser en production", stacklevel=1)
    if settings.cors_origins == "*":
        warnings.warn("⚠ CORS_ORIGINS=* — ne pas utiliser en production", stacklevel=1)
