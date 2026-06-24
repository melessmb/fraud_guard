# FraudGuard — Détection de fraude en temps réel
### Côte d'Ivoire · Sénégal · Afrique de l'Ouest

Plateforme SaaS de scoring de fraude basée sur le machine learning (LightGBM), conçue pour les institutions financières et opérateurs mobile money d'Afrique de l'Ouest. Deux espaces distincts : un **dashboard admin** FraudGuard et un **portail client** pour les entreprises clientes.

---

## Architecture

```
fraud_guard/
├── backend/                    # API FastAPI + modèle ML
│   ├── app/
│   │   ├── api/                # Endpoints REST (auth, tenants, users, permissions, scoring…)
│   │   ├── core/               # Auth Keycloak, config, cache Redis, middleware, task registry
│   │   ├── ml/                 # LightGBM + explications SHAP
│   │   ├── models/             # ORM SQLAlchemy (Tenant, TenantUser, TenantFeature, …)
│   │   └── services/           # Scoring, webhooks avec retry, pub/sub SSE
│   └── tests/                  # 80+ tests pytest
├── frontend/                   # Interface Next.js 15 (App Router)
│   └── src/app/
│       ├── (auth)/             # Login admin (/login)
│       ├── (dashboard)/        # Dashboard FraudGuard (/alertes, /scoring, …)
│       └── (portal)/           # Espace client (/portal/*)
├── dashboard/                  # Dashboard admin Streamlit (legacy)
├── sdk/                        # SDK Python client
├── docs/                       # Documentation API & déploiement
└── infrastructure/
    ├── docker/                 # docker-compose + Dockerfiles
    └── keycloak/               # Realm JSON fraudguard (import auto)
```

## Deux espaces d'accès

### Espace Admin — Dashboard FraudGuard
- URL : `http://localhost:3000/login`
- Cookie : `fg_token`
- Rôle requis : `admin`
- Fonctions : gestion des tenants, modèles ML, compliance BCEAO, audit global

### Espace Client — Portail Tenant
- URL : `http://localhost:3000/portal/login`
- Cookie : `fg_portal_token`
- Rôles acceptés : `tenant_admin`, `developer`, `compliance`, `tenant`
- Fonctions : transactions, alertes temps réel, scoring, analytique, équipe, configuration

## Stack technique

| Composant | Technologie |
|-----------|------------|
| API | FastAPI 0.137 · Python 3.13 |
| ML | LightGBM · AUC-ROC 0.963 · SHAP |
| Base de données | PostgreSQL 16 |
| Cache / Rate limit | Redis 7 |
| Authentification | Keycloak 25 (JWT RS256, 5 rôles) |
| Frontend | Next.js 15 · TypeScript · Tailwind CSS · Zustand |
| Temps réel | SSE (Server-Sent Events) via Redis pub/sub |
| Infrastructure | Docker · docker-compose |

## Hiérarchie des rôles

```
admin                   → FraudGuard interne (accès total)
└── tenant_admin        → Administrateur d'une entreprise cliente
    ├── developer       → Équipe technique (scoring, webhooks, config)
    ├── compliance      → Conformité (audit, rapports BCEAO)
    └── tenant          → Opérateur (transactions, alertes)
```

- `tenant_admin` peut inviter `developer`, `compliance`, `tenant` dans son organisation
- `admin` FraudGuard peut assigner `tenant_admin`
- Chaque tenant a un plafond de features configuré par FraudGuard (`TenantFeature`)
- Les permissions par page sont configurables par `tenant_admin` (`TenantPagePermission`)

## Démarrage rapide

### Prérequis
- Docker Desktop (démarré)
- Node.js 20+ (pour le développement frontend)
- Python 3.13+

### 1. Lancer l'infrastructure complète

```bash
# Premier démarrage (build + import realm Keycloak)
docker compose -f infrastructure/docker/docker-compose.yml up --build -d

# Rebuild après modifications du code
docker compose -f infrastructure/docker/docker-compose.yml build --no-cache api frontend
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Services démarrés :
| Service | URL |
|---------|-----|
| API FastAPI | `http://localhost:8780` |
| Frontend Next.js | `http://localhost:3000` |
| Keycloak | `http://localhost:8080` (admin: admin/admin) |
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6380` |

### 2. Vérifier la santé de l'API

```bash
# Liveness (processus vivant)
curl http://localhost:8780/health/live

# Readiness (DB + Redis + Keycloak)
curl http://localhost:8780/health/ready | jq
# → {"status": "ready", "checks": {"database": "ok", "redis": "ok", "keycloak": "ok"}}
```

### 3. Développement local (sans Docker)

```bash
# Backend
cd backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8780

# Frontend
cd frontend
npm install
npm run dev -- -p 3001   # port 3001 si Docker tourne sur 3000
```

## Endpoints principaux

### Authentification
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/auth/login` | Proxy login → Keycloak |
| `GET` | `/api/v1/auth/me` | Profil utilisateur courant |
| `GET` | `/api/v1/auth/me/tenant` | Tenant lié au compte connecté |
| `GET` | `/api/v1/auth/keycloak-info` | URLs Keycloak (OIDC discovery) |

### Scoring & Alertes
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/score` | Scorer une transaction (200 req/min/tenant) |
| `GET` | `/api/v1/tenants/{id}/alerts` | Alertes paginées + filtre `risk_level` |
| `GET` | `/api/v1/events/stream` | Flux SSE temps réel (JWT en query param) |

### Gestion des tenants
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/tenants` | Créer un tenant (admin) |
| `GET` | `/api/v1/tenants` | Lister les tenants (admin) |
| `POST` | `/api/v1/tenants/{id}/api-key` | Générer une API key (admin ou tenant_admin) |
| `DELETE` | `/api/v1/tenants/{id}/api-key` | Révoquer l'API key |
| `GET` | `/api/v1/tenants/{id}/api-key/status` | Statut de la clé |

### Gestion des utilisateurs
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/admin/users/invite` | Inviter un utilisateur dans un tenant |
| `GET` | `/api/v1/admin/tenants/{id}/users` | Lister les membres d'un tenant |
| `DELETE` | `/api/v1/admin/users/{keycloak_id}` | Révoquer un accès |

### Permissions & Features
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v1/admin/tenants/{id}/permissions` | Matrice des permissions par rôle |
| `PUT` | `/api/v1/admin/tenants/{id}/permissions` | Modifier une permission |
| `GET` | `/api/v1/admin/tenants/{id}/features` | Plafond features (admin FraudGuard) |
| `PUT` | `/api/v1/admin/tenants/{id}/features` | Activer/désactiver une feature |
| `GET` | `/api/v1/tenants/{id}/permissions/me` | Mes pages accessibles |

### Compliance BCEAO
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v1/compliance/audit-log` | Journal d'audit |
| `GET` | `/api/v1/compliance/report` | Rapport BCEAO |
| `GET` | `/api/v1/compliance/transactions/{id}/explanation` | Droit à l'explication (RGPD) |
| `POST` | `/api/v1/compliance/anonymize/{id}` | Pseudonymiser une transaction |
| `GET` | `/api/v1/compliance/retention-stats` | Statistiques de rétention |
| `DELETE` | `/api/v1/compliance/expired` | Purger les données expirées (5 ans) |

## Sécurité

- **Keycloak RS256** — tokens JWT signés, vérification d'audience configurable
- **Isolation multi-tenant** — chaque requête vérifie l'appartenance via `tenant_users` ou `keycloak_id`
- **API keys** hashées HMAC-SHA256 (jamais stockées en clair, retournées une seule fois)
- **Révocation Keycloak** — logout envoie le refresh_token à Keycloak pour invalider la session
- **Blacklist JWT** — révocation via JTI stocké dans Redis
- **Rate limiting** — 200 req/min par tenant (Redis avec fallback in-memory)
- **Signatures webhooks** — `X-FraudGuard-Signature: sha256=<hmac>` sur chaque POST
- **SECRET_KEY** validée au démarrage (refus si valeur par défaut en production)
- **CORS** — wildcard interdit en production

## Fiabilité opérationnelle

- **Health checks** — `/health/live` (liveness) + `/health/ready` (DB + Redis + Keycloak)
- **Request ID** — `X-Request-ID` injecté dans chaque requête et tous les logs structlog
- **Retry webhooks** — backoff exponentiel (1s / 2s / 4s), pas de retry sur 4xx
- **Graceful shutdown** — drain des tâches asyncio fire-and-forget (timeout 10s)
- **Pool connexions** — `pool_size=15`, `max_overflow=5` par worker, `pool_recycle=1800s`
- **Docker restart** — `restart: unless-stopped` sur tous les services
- **Resource limits** — API : 512M RAM, 1 CPU

## Performance

L'API est dimensionnée pour **~800–1000 transactions simultanées** grâce à trois optimisations :

### 1. Gunicorn multi-workers
```
uvicorn (1 worker) → gunicorn N workers UvicornWorker
```
Configurable via `WEB_CONCURRENCY` (défaut : 4, règle du pouce : `2 × CPU + 1`) :
```bash
# Exemple en production sur 4 CPU
docker run -e WEB_CONCURRENCY=9 ...
```

### 2. Inférence ML hors event loop
LightGBM + SHAP (~15ms CPU) s'exécute dans un `ThreadPoolExecutor` dédié (8 threads) via `run_in_executor` — l'event loop asyncio reste libre pendant l'inférence.

### 3. Pool de connexions DB calibré par worker
```
Budget : (pool_size=15 + max_overflow=5) × 4 workers = 80 connexions
         → safe sous PostgreSQL défaut (max_connections=100)
```

### Capacité estimée

| Configuration | Req/s | Latence p99 |
|---------------|-------|-------------|
| 1 worker uvicorn (avant) | ~50 | > 10s |
| 4 workers Gunicorn | ~200 | ~500ms |
| + ML sur thread pool | ~500 | ~200ms |
| + pool DB calibré | **~800–1000** | **~150ms** |

> Pour dépasser 1000 req/s : scaling horizontal (plusieurs replicas), cache Redis des scores par `transaction_id`, et/ou batch scoring asynchrone.

## Tests

```bash
cd backend
.venv/bin/python3.13 -m pytest tests/test_api_keys.py tests/test_users.py tests/test_permissions.py -v
# 31 tests · 100% pass (mock JWT multi-module, isolation cross-tenant)

# Suite complète
.venv/bin/python3.13 -m pytest tests/ -q
```

| Fichier | Couverture |
|---------|------------|
| `test_api_keys.py` | Génération, révocation, statut, isolation cross-tenant |
| `test_users.py` | Invitation, hiérarchie rôles, liste, révocation |
| `test_permissions.py` | Matrice permissions, plafond features, règles tenant_admin |
| `test_api.py` | Scoring, tenants, métriques, alertes |
| `test_auth.py` | Login, token, révocation JWT |
| `test_compliance.py` | Audit, rapports BCEAO, anonymisation, rétention |
| `test_model.py` | Versions ML, promotion |

## Modèle ML

- Entraîné sur 20 000 transactions synthétiques Afrique de l'Ouest
- Features : montant, heure, canal, pays, vélocité 1h/24h, device connu, transaction nocturne
- **AUC-ROC : 0.963** · Explications SHAP incluses dans chaque réponse
- Réentraîner : `python -m app.ml.train` depuis `backend/`

## Pages du portail client

| Page | Route | Rôles |
|------|-------|-------|
| Tableau de bord | `/portal` | Tous |
| Transactions | `/portal/transactions` | Tous |
| Mes alertes | `/portal/alertes` | Tous |
| Analytique | `/portal/analytique` | Tous |
| Scoring | `/portal/scoring` | Tous |
| Conformité BCEAO | `/portal/conformite` | Tous |
| Configuration | `/portal/configuration` | Tous |
| Équipe | `/portal/equipe` | `tenant_admin` |

## Licence

MIT
