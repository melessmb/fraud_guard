# Guide d'intégration client

## Étape 1 : Créer votre tenant

```bash
curl -X POST http://localhost:8780/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ma Banque CI",
    "country": "CI",
    "environment": "sandbox",
    "api_key": "ma-cle-secrete-unique-001"
  }'
```

Réponse : `{ "id": 1, "status": "created" }`

## Étape 2 : Obtenir un token JWT (optionnel)

```bash
curl -X POST http://localhost:8780/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{ "api_key": "ma-cle-secrete-unique-001" }'
```

## Étape 3 : Scorer une transaction

```bash
curl -X POST http://localhost:8780/api/v1/score \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ma-cle-secrete-unique-001" \
  -d '{
    "transaction_id": "TXN-20240615-001",
    "tenant_id": 1,
    "amount": 250000,
    "currency": "XOF",
    "channel": "mobile_money",
    "country": "CI",
    "device_fingerprint": "fp-iphone14-a1b2c3",
    "ip_address": "41.203.72.10",
    "timestamp": "2024-06-15T14:30:00",
    "features": {
      "velocity_1h": 1,
      "velocity_24h": 4
    }
  }'
```

**Réponse** :
```json
{
  "transaction_id": "TXN-20240615-001",
  "score": 0.42,
  "is_fraud": false,
  "model_version": "v1-lgbm",
  "explanations": { ... }
}
```

## Étape 4 : Configurer votre politique

```bash
curl -X POST http://localhost:8780/api/v1/tenants/1/policies \
  -H "Content-Type: application/json" \
  -d '{
    "score_threshold": 0.70,
    "auto_reject_threshold": 0.95,
    "max_amount_xof": 2000000,
    "allowed_channels": ["mobile_money", "pos", "web", "atm"],
    "model_id": "fraud_v1"
  }'
```

## Étape 5 : Consulter vos métriques

```bash
curl http://localhost:8780/api/v1/tenants/1/metrics?hours=24
```

## SDK Python

```python
# pip install httpx
import httpx

API_URL = "http://localhost:8780/api/v1"
API_KEY = "ma-cle-secrete-unique-001"

with httpx.Client(headers={"X-API-Key": API_KEY}) as client:
    resp = client.post(f"{API_URL}/score", json={
        "transaction_id": "TXN-001",
        "tenant_id": 1,
        "amount": 50000,
        "currency": "XOF",
        "channel": "mobile_money",
        "country": "CI",
        "device_fingerprint": "fp-abc123",
        "ip_address": "1.2.3.4",
        "timestamp": "2024-06-15T14:00:00",
    })
    result = resp.json()
    print(f"Score: {result['score']:.2f} — Fraude: {result['is_fraud']}")
```

## Interprétation des scores

| Score | Recommandation |
|-------|---------------|
| 0.00 – 0.50 | Transaction normale — accepter |
| 0.50 – 0.70 | Zone grise — surveillance recommandée |
| 0.70 – 0.90 | Risque élevé — validation manuelle |
| 0.90 – 1.00 | Fraude très probable — bloquer |

Les explications SHAP indiquent les features qui ont le plus influencé le score (valeurs positives = augmentent le risque, négatives = le réduisent).
