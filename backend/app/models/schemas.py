from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class TenantRequest(BaseModel):
    name: str
    country: str
    environment: str
    keycloak_id: Optional[str] = None


class TenantUpdateRequest(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    environment: Optional[str] = None
    keycloak_id: Optional[str] = None


class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    country: str
    environment: str
    keycloak_id: Optional[str] = None
    created_at: datetime


class MetricsResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    period_start: datetime
    period_end: datetime
    transaction_count: int
    fraud_count: int
    detection_rate: float
    false_positive_rate: float
    model_version: str
    tenant_id: int


class FraudEvent(BaseModel):
    transaction_id: str
    tenant_id: int
    amount: float
    currency: str
    channel: str
    country: str
    device_fingerprint: str
    ip_address: str
    timestamp: datetime
    client_id: Optional[str] = None
    features: Dict[str, Any] = {}


class FraudScoreResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    transaction_id: str
    score: float
    is_fraud: bool
    model_version: str
    explanations: Optional[Dict[str, Any]] = None


class LoginRequest(BaseModel):
    username: str
    password: str
    client_id: str = "fraudguard-dashboard"


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None


class TokenRequest(BaseModel):
    api_key: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class RevokeRequest(BaseModel):
    token: str


class WebhookConfig(BaseModel):
    url: str
    events: List[str] = ["fraud_detected"]
    secret: Optional[str] = None


class BatchEventRequest(BaseModel):
    events: List[FraudEvent]


class PolicyConfig(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    score_threshold: float = Field(ge=0.0, le=1.0, default=0.7)
    auto_reject_threshold: float = Field(ge=0.0, le=1.0, default=0.9)
    max_amount_xof: Optional[float] = None
    max_amount_usd: Optional[float] = None
    allowed_channels: List[str] = []
    blocked_channels: List[str] = []
    model_id: str = "fraud_v1"


class AlertResponse(BaseModel):
    id: int
    transaction_id: str
    tenant_id: int
    score: float
    channel: str
    amount: float
    currency: str
    timestamp: datetime
    status: str


class ModelVersionResponse(BaseModel):
    version: str
    stage: str
    created_at: datetime
    auc_roc: Optional[float] = None
    description: str = ""


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    action_type: str
    actor_type: str
    actor_id: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    outcome: str
