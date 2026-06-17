# API Reference — Fraud Detection Ouest Afrique

Base URL : `http://localhost:8780/api/v1`  
Swagger interactif : `http://localhost:8780/docs`

## Authentification

Toutes les routes de scoring nécessitent un header `X-API-Key` avec la clé du tenant.

```
X-API-Key: <votre-cle-api>
```

---

## Système

### GET /health
Vérification de l'état de l'API.

**Réponse 200**
```json
{ "status": "ok", "version": "1.0.0" }
```

---

## Auth

### POST /api/v1/auth/token
Obtenir un JWT Bearer à partir d'une clé API.

**Corps**
```json
{ "api_key": "votre-cle-api" }
```

**Réponse 200**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

---

## Scoring

### POST /api/v1/score
Score une transaction en temps réel.  
Requiert : `X-API-Key`

**Corps**
```json
{
  "transaction_id": "txn-abc-001",
  "tenant_id": 1,
  "amount": 120000,
  "currency": "XOF",
  "channel": "mobile_money",
  "country": "CI",
  "device_fingerprint": "fp-a1b2c3d4e5f6",
  "ip_address": "41.203.72.10",
  "timestamp": "2024-06-15T14:30:00",
  "features": {
    "velocity_1h": 2,
    "velocity_24h": 8
  }
}
```

**Channels supportés** : `mobile_money`, `web`, `pos`, `atm`  
**Pays supportés** : `CI`, `SN`, `GH`, `NG`, `BJ`

**Réponse 200**
```json
{
  "transaction_id": "txn-abc-001",
  "score": 0.73,
  "is_fraud": true,
  "model_version": "v1-lgbm",
  "explanations": {
    "shap_values": {
      "amount_log": 0.15,
      "hour": -0.02,
      "channel_enc": 0.22,
      "is_night": 0.18
    },
    "base_value": 0.07,
    "model_auc": 0.9633
  }
}
```

---

## Tenants

### POST /api/v1/tenants
Créer un nouveau tenant.

**Corps**
```json
{
  "name": "Banque Atlantique CI",
  "country": "CI",
  "environment": "sandbox",
  "api_key": "ba-ci-sandbox-key-001"
}
```

**Réponse 201** : `{ "id": 1, "status": "created" }`

### GET /api/v1/tenants
Lister tous les tenants.

**Réponse 200** : tableau de `TenantResponse`

### GET /api/v1/tenants/{tenant_id}/metrics
Métriques de détection sur une période.

**Query params** : `hours` (défaut : 24)

**Réponse 200**
```json
{
  "period_start": "2024-06-14T14:30:00",
  "period_end": "2024-06-15T14:30:00",
  "transaction_count": 1250,
  "fraud_count": 42,
  "detection_rate": 0.0336,
  "false_positive_rate": 0.0,
  "model_version": "v1-lgbm",
  "tenant_id": 1
}
```

### GET /api/v1/tenants/{tenant_id}/alerts
Alertes fraude récentes (transactions `is_fraud = true`).

**Query params** : `limit` (défaut : 50)

### POST /api/v1/tenants/{tenant_id}/policies
Configurer la politique de scoring du tenant.

```json
{
  "score_threshold": 0.70,
  "auto_reject_threshold": 0.95,
  "max_amount_xof": 5000000,
  "allowed_channels": ["pos", "atm"],
  "blocked_channels": [],
  "model_id": "fraud_v1"
}
```

### GET /api/v1/tenants/{tenant_id}/policies
Récupérer la politique active.

### POST /api/v1/tenants/{tenant_id}/events
Scoring batch d'un tableau de transactions.

```json
{
  "events": [ { ...FraudEvent... }, { ...FraudEvent... } ]
}
```

**Réponse 200** : tableau de `FraudScoreResponse`

### POST /api/v1/tenants/{tenant_id}/webhooks
Configurer un webhook de notification.

```json
{
  "url": "https://monapp.ci/webhooks/fraud",
  "events": ["fraud_detected"],
  "secret": "whsec_xxxxx"
}
```

---

## Modèles

### GET /api/v1/model/versions
Lister les versions disponibles du modèle ML.

### POST /api/v1/model/versions/{version}/promote
Promouvoir une version en production.

```
POST /api/v1/model/versions/v1/promote
```

---

## Codes d'erreur

| Code | Signification |
|------|---------------|
| 401 | Clé API manquante ou invalide |
| 404 | Tenant introuvable |
| 409 | Clé API déjà utilisée |
| 422 | Données invalides |
| 500 | Erreur interne |
