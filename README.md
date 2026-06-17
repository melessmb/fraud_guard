# FraudGuard — Détection de fraude en temps réel
### Côte d'Ivoire · Sénégal · Afrique de l'Ouest

API de scoring de fraude basée sur le machine learning (LightGBM), conçue pour les institutions financières et opérateurs mobile money d'Afrique de l'Ouest.

---

## Architecture

```
fraud-detection-ouest-afrique/
├── backend/          # API FastAPI + modèle ML
│   ├── app/
│   │   ├── api/      # Endpoints REST
│   │   ├── core/     # Auth, config, sécurité, cache
│   │   ├── ml/       # LightGBM + explications SHAP
│   │   ├── models/   # ORM SQLAlchemy
│   │   └── services/ # Logique métier
│   ├── data/models/  # Modèle entraîné (fraud_v1.pkl)
│   └── tests/        # 37 tests pytest
├── dashboard/        # Dashboard admin Streamlit
├── sdk/              # SDK Python client
├── docs/             # Documentation API & déploiement
└── infrastructure/   # Docker, Kubernetes, Terraform
```

## Stack technique

| Composant | Technologie |
|-----------|------------|
| API | FastAPI 0.137 + Python 3.11 |
| ML | LightGBM · AUC-ROC 0.963 · SHAP |
| Base de données | PostgreSQL 16 |
| Cache / Rate limit | Redis 7 |
| Auth | HMAC-SHA256 (API keys) · PyJWT (tokens) |
| Dashboard | Streamlit 1.58 + Plotly |
| Infrastructure | Docker · docker-compose |

## Démarrage rapide

### Prérequis
- Docker Desktop
- Python 3.11+

### 1. Configurer l'environnement

```bash
cp backend/.env.example backend/.env
# Éditez backend/.env et générez une SECRET_KEY forte
python -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Lancer avec Docker

```bash
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

API disponible sur `http://localhost:8780/docs`

### 3. Lancer le dashboard admin

```bash
pip install -r dashboard/requirements.txt
python -m streamlit run dashboard/app.py
```

Dashboard disponible sur `http://localhost:8501`

### 4. Lancer en local (sans Docker)

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8780
```

## Endpoints principaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/score` | Scorer une transaction en temps réel |
| `POST` | `/api/v1/auth/token` | Obtenir un token JWT |
| `POST` | `/api/v1/auth/revoke` | Révoquer un token (admin) |
| `GET` | `/api/v1/tenants/{id}/metrics` | Métriques d'un tenant |
| `GET` | `/api/v1/tenants/{id}/alerts` | Alertes de fraude |
| `POST` | `/api/v1/tenants/{id}/policies` | Configurer les seuils (admin) |
| `GET` | `/api/v1/model/versions` | Versions du modèle ML |

## Sécurité

- Clés API hashées HMAC-SHA256 (jamais stockées en clair)
- Tokens JWT avec révocation via Redis (liste noire par JTI)
- Isolation multi-tenant sur chaque requête
- `SECRET_KEY` validée au démarrage (refus si valeur par défaut en production)
- Protection timing attack sur l'authentification admin (`hmac.compare_digest`)
- Rate limiting : 200 requêtes/minute par tenant

## Tests

```bash
cd backend
pytest tests/ -v
# 37 tests · 100% pass
```

## Modèle ML

- Entraîné sur 20 000 transactions synthétiques Afrique de l'Ouest
- Features : montant, heure, canal, pays, vélocité 1h/24h, device connu, transaction nocturne
- **AUC-ROC : 0.963**
- Explications SHAP incluses dans chaque réponse de scoring
- Réentraîner : `python -m app.ml.train` depuis le dossier `backend/`

## Licence

MIT
