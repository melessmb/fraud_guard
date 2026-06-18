import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.keycloak_auth import decode_keycloak_token, oauth2_scheme
from app.models.schemas import LoginRequest, LoginResponse, TenantResponse
from app.models.tenant import Tenant

router = APIRouter()

_KC_TOKEN_URL = (
    "{base}/realms/{realm}/protocol/openid-connect/token"
)


@router.post("/auth/login", response_model=LoginResponse, tags=["auth"])
def login(payload: LoginRequest) -> LoginResponse:
    """Proxy d'authentification vers Keycloak.

    Le dashboard appelle cet endpoint (backend → Keycloak via réseau Docker).
    Évite d'exposer l'URL interne de Keycloak au navigateur.
    """
    url = _KC_TOKEN_URL.format(
        base=settings.keycloak_url,
        realm=settings.keycloak_realm,
    )
    try:
        # trust_env=False : évite que httpx route via un proxy Docker parasite
        with httpx.Client(trust_env=False) as client:
            r = client.post(url, data={
                "client_id":  payload.client_id,
                "grant_type": "password",
                "username":   payload.username,
                "password":   payload.password,
            }, timeout=10)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Keycloak inaccessible: {exc}",
        )

    if r.status_code == 401:
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    if not r.is_success:
        raise HTTPException(
            status_code=r.status_code,
            detail=r.json().get("error_description", "Erreur Keycloak"),
        )

    data = r.json()
    return LoginResponse(
        access_token=data["access_token"],
        token_type=data.get("token_type", "bearer"),
        expires_in=data.get("expires_in", 3600),
        refresh_token=data.get("refresh_token"),
    )


@router.get("/auth/keycloak-info", tags=["auth"])
def keycloak_info() -> dict:
    """Retourne les URLs Keycloak pour la configuration des clients OAuth2."""
    base = f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
    return {
        "realm":      settings.keycloak_realm,
        "token_url":  f"{base}/protocol/openid-connect/token",
        "auth_url":   f"{base}/protocol/openid-connect/auth",
        "jwks_url":   f"{base}/protocol/openid-connect/certs",
        "logout_url": f"{base}/protocol/openid-connect/logout",
        "clients": {
            "dashboard":    "fraudguard-dashboard (public)",
            "tenants_m2m":  "fraudguard-tenants (client_credentials)",
        },
    }


@router.get("/auth/me/tenant", response_model=TenantResponse, tags=["auth"])
def my_tenant(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> TenantResponse:
    """Retourne le tenant lié au compte Keycloak de l'utilisateur authentifié."""
    payload = decode_keycloak_token(token)
    keycloak_id = payload.get("sub", "")
    tenant = db.query(Tenant).filter(Tenant.keycloak_id == keycloak_id).first()
    if not tenant:
        username = payload.get("preferred_username", "")
        tenant = db.query(Tenant).filter(Tenant.name == username).first()
    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Aucun tenant lié à ce compte. Demandez à un administrateur.",
        )
    return TenantResponse.model_validate(tenant)


@router.get("/auth/me", tags=["auth"])
def whoami(token: str = Depends(oauth2_scheme)) -> dict:
    """Retourne les informations de l'utilisateur authentifié."""
    payload = decode_keycloak_token(token)
    return {
        "sub":       payload.get("sub"),
        "username":  payload.get("preferred_username"),
        "email":     payload.get("email"),
        "roles":     payload.get("realm_access", {}).get("roles", []),
        "issued_at": payload.get("iat"),
        "expires_at":payload.get("exp"),
    }
