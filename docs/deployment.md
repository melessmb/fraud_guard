# Guide de déploiement

## Déploiement local (développement)

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows
source .venv/bin/activate       # Linux/Mac
pip install -r requirements.txt

# Entraîner le modèle ML (une seule fois)
python -m app.ml.train

# Lancer le serveur
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API disponible sur http://localhost:8000  
Swagger : http://localhost:8000/docs

---

## Déploiement Docker (recommandé)

### Prérequis
- Docker Desktop installé et lancé
- Le modèle ML doit être entraîné avant le build (voir ci-dessus)

### Démarrage

```bash
# Depuis la racine du projet
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

- API → http://localhost:8780
- Redis → localhost:6380

### Variables d'environnement (docker-compose.yml)

| Variable | Défaut | Description |
|----------|--------|-------------|
| DATABASE_URL | sqlite:///./fraud_dev.db | Chemin SQLite |
| REDIS_URL | redis://redis:6379/0 | URL Redis interne |
| SECRET_KEY | dev-secret-key | Clé JWT (changer en prod) |
| DEBUG | true | Mode debug |

### Arrêt

```bash
docker compose -f infrastructure/docker/docker-compose.yml down
```

---

## Déploiement cloud (AWS — Afrique du Sud)

### Option 1 : AWS ECS Fargate

1. Pousser l'image Docker sur ECR :
```bash
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.af-south-1.amazonaws.com
docker build -t fraud-api -f infrastructure/docker/Dockerfile .
docker tag fraud-api <account>.dkr.ecr.af-south-1.amazonaws.com/fraud-api:latest
docker push <account>.dkr.ecr.af-south-1.amazonaws.com/fraud-api:latest
```

2. Créer un cluster ECS avec Fargate
3. Définir la task definition avec les variables d'environnement
4. Exposer via un Application Load Balancer

### Option 2 : AWS App Runner
Service PaaS managé, idéal pour démarrer rapidement.

### Recommandations production

- Remplacer SQLite par PostgreSQL (RDS)
- Utiliser ElastiCache pour Redis
- Configurer `SECRET_KEY` via AWS Secrets Manager
- Activer HTTPS via ACM + ALB
- Région recommandée : `af-south-1` (Le Cap) pour la latence Afrique
