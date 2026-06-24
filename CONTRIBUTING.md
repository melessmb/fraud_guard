# Contribution — GitFlow FraudGuard

## Branches permanentes

| Branche | Rôle | Merge autorisé depuis |
|---------|------|-----------------------|
| `main` | Production stable — déployée en prod | `release/*`, `hotfix/*` uniquement |
| `develop` | Intégration — base de toutes les features | `feature/*`, `bugfix/*`, `release/*` |

**Règle fondamentale : on ne pousse jamais directement sur `main` ni sur `develop`.**
Tout passe par une Pull Request avec au moins une review.

---

## Types de branches temporaires

### `feature/` — Nouvelle fonctionnalité
```bash
# Créer depuis develop
git checkout develop && git pull origin develop
git checkout -b feature/nom-court

# Exemple
git checkout -b feature/export-csv-alertes
git checkout -b feature/portal-scoring-ui
```
→ PR vers **`develop`** quand la feature est prête.

---

### `bugfix/` — Correction de bug non-critique
```bash
git checkout develop && git pull origin develop
git checkout -b bugfix/description-courte

# Exemple
git checkout -b bugfix/fix-null-tenant-id
git checkout -b bugfix/cors-header-missing
```
→ PR vers **`develop`**.

---

### `release/` — Préparation d'une version
```bash
# Créer depuis develop quand les features sont gelées
git checkout develop && git pull origin develop
git checkout -b release/1.2.0
```
Seuls les bugfixes de dernière minute sont admis sur une branche `release/`.
Une fois stabilisée :
```bash
# Merger dans main ET develop
git checkout main && git merge release/1.2.0 && git tag v1.2.0
git checkout develop && git merge release/1.2.0
git branch -d release/1.2.0
```

---

### `hotfix/` — Correction urgente en production
```bash
# Créer depuis main (pas develop !)
git checkout main && git pull origin main
git checkout -b hotfix/description-critique

# Exemple
git checkout -b hotfix/security-api-key-leak
```
Une fois corrigé :
```bash
# Merger dans main ET develop
git checkout main && git merge hotfix/description && git tag v1.1.1
git checkout develop && git merge hotfix/description
git branch -d hotfix/description
```

---

## Flux complet

```
main ──────────────────────────────────────── v1.0 ──── v1.1 ──── v1.2
         ↑ merge release                        ↑          ↑
develop ─┴──────────────────────────────────────┴──────────┴────────────
         ↑ merge feature/*                    ↑ merge hotfix/
feature/A ────────────────────────────────────┘
feature/B           ─────────────────────────┘
bugfix/x                      ───────────────┘
                                      hotfix/ ─────────→ main + develop
```

---

## Conventions de commit

Format : `type(scope): description courte`

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `perf` | Amélioration de performance |
| `refactor` | Refactoring sans changement fonctionnel |
| `test` | Ajout ou modification de tests |
| `docs` | Documentation uniquement |
| `chore` | Tâches de maintenance (deps, CI, config) |
| `hotfix` | Correction urgente en production |

```bash
# Exemples
feat(portal): ajouter page analytique avec graphiques
fix(auth): corriger la révocation de token Keycloak
perf(scoring): décharger LightGBM sur thread pool
test(permissions): ajouter tests isolation cross-tenant
docs(readme): mettre à jour section performance
```

---

## Checklist Pull Request

Avant d'ouvrir une PR :

- [ ] La branche est créée depuis `develop` (ou `main` pour un hotfix)
- [ ] Les tests passent : `.venv/bin/python3.13 -m pytest tests/ -q`
- [ ] Pas d'erreur TypeScript : `node_modules/.bin/tsc --noEmit`
- [ ] Le code est review-ready (pas de `console.log`, pas de `TODO` oublié)
- [ ] La PR cible la bonne branche (`develop` ou `main`)
- [ ] Le titre suit la convention de commit (`feat(scope): ...`)

---

## Démarrage rapide pour un nouveau développeur

```bash
# 1. Cloner le repo
git clone https://github.com/melessmb/fraud_guard.git
cd fraud_guard

# 2. Toujours partir de develop
git checkout develop && git pull origin develop

# 3. Créer sa branche
git checkout -b feature/ma-feature

# 4. Travailler, commiter
git add fichiers-modifiés
git commit -m "feat(scope): description"

# 5. Pousser et ouvrir une PR vers develop
git push origin feature/ma-feature
# → Ouvrir la PR sur GitHub vers develop
```

---

## Protection des branches (à configurer sur GitHub)

Sur **Settings → Branches → Branch protection rules** :

| Branche | Règles recommandées |
|---------|---------------------|
| `main` | Require PR · Require 1 review · No direct push · Require status checks |
| `develop` | Require PR · Require 1 review · No direct push |
