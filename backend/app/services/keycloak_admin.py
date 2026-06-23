"""Client Keycloak Admin REST API — gestion des utilisateurs."""
import logging
from typing import Any

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

_MASTER_TOKEN_URL = f"{settings.keycloak_url}/realms/master/protocol/openid-connect/token"
_USERS_URL = f"{settings.keycloak_url}/admin/realms/{settings.keycloak_realm}/users"
_ROLES_URL = f"{settings.keycloak_url}/admin/realms/{settings.keycloak_realm}/roles"


def _admin_token() -> str:
    """Obtient un token admin via Resource Owner Password Credentials (master realm)."""
    resp = httpx.post(
        _MASTER_TOKEN_URL,
        data={
            "client_id": "admin-cli",
            "username": settings.keycloak_admin_user,
            "password": settings.keycloak_admin_password,
            "grant_type": "password",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_admin_token()}", "Content-Type": "application/json"}


# ── CRUD utilisateurs ─────────────────────────────────────────────────────────

def create_user(username: str, email: str, password: str, roles: list[str]) -> str:
    """Crée un user dans Keycloak et retourne son UUID."""
    headers = _headers()

    resp = httpx.post(
        _USERS_URL,
        headers=headers,
        json={
            "username": username,
            "email": email,
            "enabled": True,
            "emailVerified": True,
            "credentials": [{"type": "password", "value": password, "temporary": True}],
        },
        timeout=10,
    )
    if resp.status_code == 409:
        raise ValueError(f"L'utilisateur '{username}' existe déjà dans Keycloak")
    resp.raise_for_status()

    # Keycloak retourne l'URL du user créé dans le header Location
    location = resp.headers.get("Location", "")
    user_id = location.rstrip("/").split("/")[-1]

    # Assigner les rôles realm
    for role_name in roles:
        _assign_realm_role(user_id, role_name, headers)

    return user_id


def _assign_realm_role(user_id: str, role_name: str, headers: dict) -> None:
    """Assigne un rôle realm à un user."""
    role_resp = httpx.get(f"{_ROLES_URL}/{role_name}", headers=headers, timeout=10)
    if role_resp.status_code == 404:
        log.warning("Rôle '%s' introuvable dans Keycloak", role_name)
        return
    role_resp.raise_for_status()
    role = role_resp.json()

    httpx.post(
        f"{_USERS_URL}/{user_id}/role-mappings/realm",
        headers=headers,
        json=[{"id": role["id"], "name": role["name"]}],
        timeout=10,
    ).raise_for_status()


def list_users_by_ids(keycloak_ids: list[str]) -> list[dict[str, Any]]:
    """Récupère les infos Keycloak pour une liste d'UUIDs."""
    if not keycloak_ids:
        return []
    headers = _headers()
    results = []
    for kid in keycloak_ids:
        resp = httpx.get(f"{_USERS_URL}/{kid}", headers=headers, timeout=10)
        if resp.status_code == 200:
            u = resp.json()
            roles_resp = httpx.get(
                f"{_USERS_URL}/{kid}/role-mappings/realm",
                headers=headers, timeout=10,
            )
            realm_roles = [r["name"] for r in roles_resp.json().get("mappings", [])] if roles_resp.status_code == 200 else []
            results.append({
                "keycloak_id": u["id"],
                "username": u.get("username", ""),
                "email": u.get("email", ""),
                "enabled": u.get("enabled", True),
                "roles": realm_roles,
            })
    return results


def list_users_by_role(role_name: str) -> list[dict[str, Any]]:
    """Liste tous les users ayant un rôle realm donné."""
    headers = _headers()
    resp = httpx.get(
        f"{_ROLES_URL}/{role_name}/users",
        headers=headers,
        params={"max": 200},
        timeout=10,
    )
    if resp.status_code == 404:
        return []
    resp.raise_for_status()
    return [
        {
            "keycloak_id": u["id"],
            "username": u.get("username", ""),
            "email": u.get("email", ""),
            "enabled": u.get("enabled", True),
        }
        for u in resp.json()
    ]


def disable_user(keycloak_id: str) -> None:
    """Désactive un user Keycloak (soft delete)."""
    httpx.put(
        f"{_USERS_URL}/{keycloak_id}",
        headers=_headers(),
        json={"enabled": False},
        timeout=10,
    ).raise_for_status()


def delete_user(keycloak_id: str) -> None:
    """Supprime définitivement un user Keycloak."""
    resp = httpx.delete(f"{_USERS_URL}/{keycloak_id}", headers=_headers(), timeout=10)
    if resp.status_code != 404:
        resp.raise_for_status()


def reset_password(keycloak_id: str, new_password: str, temporary: bool = True) -> None:
    httpx.put(
        f"{_USERS_URL}/{keycloak_id}/reset-password",
        headers=_headers(),
        json={"type": "password", "value": new_password, "temporary": temporary},
        timeout=10,
    ).raise_for_status()
