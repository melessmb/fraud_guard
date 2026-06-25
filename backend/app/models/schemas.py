import ipaddress
import socket
import urllib.parse
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# RFC-1918 + link-local + loopback ranges blocked for hook URLs
_BLOCKED_NETWORKS = [
    ipaddress.ip_network(cidr)
    for cidr in (
        "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
        "169.254.0.0/16", "127.0.0.0/8", "::1/128", "fc00::/7",
    )
]


def _validate_hook_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("https", "http"):
        raise ValueError("L'URL du hook doit utiliser http ou https")
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL invalide : hostname manquant")
    try:
        addr = ipaddress.ip_address(hostname)
        if any(addr in net for net in _BLOCKED_NETWORKS):
            raise ValueError("Adresse IP interne ou réservée interdite pour les hooks")
    except ValueError as exc:
        if "interne" in str(exc) or "réservée" in str(exc):
            raise
        # DNS hostname — résoudre pour vérifier l'IP cible
        try:
            resolved_ip = socket.gethostbyname(hostname)
            addr = ipaddress.ip_address(resolved_ip)
            if any(addr in net for net in _BLOCKED_NETWORKS):
                raise ValueError(f"L'hôte '{hostname}' se résout vers une adresse interne interdite")
        except socket.gaierror:
            pass  # Hostname DNS non résolvable localement — on laisse passer, sera rejeté à l'exécution
    return url


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
    rule_triggered: Optional[str] = None   # nom de la règle personnalisée déclenchée
    rule_action: Optional[str] = None      # "block" | "review" | "flag"


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


# ── Règles personnalisées ─────────────────────────────────────────────────────

class CustomRuleBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    min_amount: Optional[float] = Field(default=None, ge=0)
    max_amount: Optional[float] = Field(default=None, ge=0)
    channels: Optional[List[str]] = None
    countries: Optional[List[str]] = None
    min_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    max_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    action: str = Field(default="flag", pattern="^(block|review|flag)$")
    priority: int = Field(default=100, ge=1, le=1000)
    is_active: bool = True


class CustomRuleCreate(CustomRuleBase):
    pass


class CustomRuleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    channels: Optional[List[str]] = None
    countries: Optional[List[str]] = None
    min_score: Optional[float] = None
    max_score: Optional[float] = None
    action: Optional[str] = Field(default=None, pattern="^(block|review|flag)$")
    priority: Optional[int] = Field(default=None, ge=1, le=1000)
    is_active: Optional[bool] = None


class CustomRuleResponse(CustomRuleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tenant_id: int
    created_at: Any
    updated_at: Any


class PolicyConfig(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), populate_by_name=True)

    # Champs canoniques (DB)
    score_threshold: float = Field(ge=0.0, le=1.0, default=0.7)
    auto_reject_threshold: float = Field(ge=0.0, le=1.0, default=0.9)
    max_amount_xof: Optional[float] = None
    max_amount_usd: Optional[float] = None
    allowed_channels: List[str] = []
    blocked_channels: List[str] = []
    model_id: str = "fraud_v1"
    medium_risk_threshold: float = Field(ge=0.0, le=1.0, default=0.5)

    # Alias frontend — reçus depuis la page Configuration du portal
    high_risk_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    auto_block_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    webhook_url: Optional[str] = None  # géré séparément via /webhooks

    def resolved_score_threshold(self) -> float:
        return self.high_risk_threshold if self.high_risk_threshold is not None else self.score_threshold

    def resolved_auto_reject_threshold(self) -> float:
        return self.auto_block_threshold if self.auto_block_threshold is not None else self.auto_reject_threshold


class AlertResponse(BaseModel):
    id: int
    transaction_id: str
    tenant_id: int
    score: float
    risk_level: str
    channel: str
    country: str
    amount: float
    currency: str
    model_version: str
    timestamp: datetime
    status: str  # open | under_review | validated | rejected
    explanations: Optional[Dict[str, Any]] = None


class AlertStatusUpdate(BaseModel):
    status: str
    comment: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        allowed = {"open", "under_review", "validated", "rejected"}
        if v not in allowed:
            raise ValueError(f"Statut invalide. Valeurs acceptées : {allowed}")
        return v


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_id: str
    tenant_id: int
    amount: float
    currency: str
    channel: str
    country: str
    score: float
    is_fraud: bool
    risk_level: str
    model_version: str
    status: str
    created_at: datetime
    data_expires_at: Optional[datetime] = None
    is_anonymized: bool = False


class TransactionListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List["TransactionResponse"]


class ScoringHookRequest(BaseModel):
    name:       str
    hook_type:  str              # "pre_score" | "post_score"
    url:        str
    secret:     Optional[str] = None
    timeout_ms: int = 2000
    enabled:    bool = True

    @field_validator("url")
    @classmethod
    def url_no_ssrf(cls, v: str) -> str:
        return _validate_hook_url(v)


class ScoringHookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:         int
    tenant_id:  int
    name:       str
    hook_type:  str
    url:        str
    timeout_ms: int
    enabled:    bool
    created_at: datetime


class HookTestRequest(BaseModel):
    transaction_id:     str = "test-txn-001"
    amount:             float = 50000.0
    currency:           str = "XOF"
    channel:            str = "mobile_money"
    country:            str = "CI"
    device_fingerprint: str = "fp-test"
    score:              float = 0.75          # utilisé pour post_score
    is_fraud:           bool = True           # utilisé pour post_score


class HookTestResponse(BaseModel):
    hook_id:      int
    url:          str
    status:       str    # "success" | "timeout" | "error"
    response_ms:  int
    response_body: Optional[dict] = None
    error:        Optional[str] = None


class ModelVersionResponse(BaseModel):
    version: str
    stage: str
    created_at: datetime
    auc_roc: Optional[float] = None
    description: str = ""


class DailyPoint(BaseModel):
    date:  str
    total: int
    fraud: int

class ChannelStat(BaseModel):
    channel: str
    total:   int
    fraud:   int

class CountryStat(BaseModel):
    country: str
    total:   int
    fraud:   int

class ScoreBucket(BaseModel):
    bucket: str
    count:  int

class PeriodSummary(BaseModel):
    total:      int
    fraud:      int
    fraud_rate: float
    avg_score:  float

class AnalyticsResponse(BaseModel):
    period_days: int
    current:    PeriodSummary
    previous:   PeriodSummary
    by_day:     List[DailyPoint]
    by_channel: List[ChannelStat]
    by_risk:    Dict[str, int]
    by_country: List[CountryStat]
    score_distribution: List[ScoreBucket]


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
