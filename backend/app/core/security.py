import hashlib
import hmac as _hmac
import uuid
from datetime import datetime, timedelta
from typing import Optional

import jwt
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext

from app.core.config import settings

_ALGORITHM = "HS256"
_password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return _password_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _password_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def hash_api_key(api_key: str) -> str:
    """HMAC-SHA256 déterministe pour stocker les API keys en DB de façon sécurisée.
    Contrairement à bcrypt, permet une recherche indexée en O(1)."""
    return _hmac.new(
        settings.secret_key.encode(),
        api_key.encode(),
        hashlib.sha256,
    ).hexdigest()


def create_access_token(*, subject: str = "", expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    now = datetime.utcnow()
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_delta,
        "jti": str(uuid.uuid4()),  # identifiant unique pour révocation ciblée
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


def decode_access_token(token: str, *, skip_blacklist: bool = False) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[_ALGORITHM])
    except InvalidTokenError as exc:
        raise ValueError("Token d'accès invalide") from exc

    if not skip_blacklist:
        jti = payload.get("jti")
        if jti:
            from app.core.cache import is_blacklisted  # import tardif pour éviter la dépendance circulaire
            if is_blacklisted(jti):
                raise ValueError("Token révoqué")

    return payload
