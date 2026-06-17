# Conformité réglementaire — FraudGuard

## Cadre réglementaire applicable

### 1. BCEAO — Instruction n°008-05-2015

**Champ d'application** : Tous les systèmes de paiement électronique opérant dans la zone UEMOA (Côte d'Ivoire, Sénégal, Burkina Faso, Mali, Niger, Togo, Bénin, Guinée-Bissau).

**Obligations clés** :

| Obligation | Délai | Implémentation FraudGuard |
|---|---|---|
| Conservation des données de transaction | 5 ans minimum | `FraudLog.data_expires_at` = `created_at + 5 ans` |
| Traçabilité des décisions automatisées | Illimitée | Table `audit_logs` |
| Signalement des incidents de fraude | 72 h | Endpoint `GET /api/v1/tenants/{id}/alerts` |
| Rapport périodique de fraude | Mensuel | `GET /api/v1/compliance/report` |

### 2. ARTCI — Loi n°2013-546 (Côte d'Ivoire)

**Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire**

- Obligation de signalement des violations de données dans les 72h
- Protection des données personnelles des utilisateurs de services mobile money
- Exigence de pseudonymisation pour les données traitées par des systèmes automatisés

**Implémentation** : Endpoint `POST /api/v1/compliance/anonymize/{transaction_id}` remplace le `transaction_id` réel par un pseudonyme déterministe (`SHA-256[:16]`).

### 3. CDP — Loi n°2008-12 (Sénégal)

**Commission de Protection des Données Personnelles du Sénégal**

- Droit d'accès et d'explication pour les décisions automatisées (équivalent RGPD Art. 22)
- Obligation de minimisation des données
- Droit à l'effacement (limité pour les données financières soumises à obligation légale de conservation)

**Implémentation** : Endpoint `GET /api/v1/compliance/transactions/{id}/explanation` expose la base légale, le seuil appliqué, et la durée de conservation.

---

## Architecture de conformité

```
┌─────────────────────────────────────────────────────────────────┐
│  Décision de scoring (POST /api/v1/score)                       │
│                                                                  │
│  FraudLog {                                                      │
│    transaction_id   → pseudonymisé sur demande                  │
│    score, is_fraud  → conservé 5 ans (BCEAO)                   │
│    data_expires_at  → created_at + 1825 jours                  │
│    is_anonymized    → flag de pseudonymisation                  │
│  }                                                               │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Actions admin auditées → AuditLog                              │
│                                                                  │
│  CREATE_TENANT      → création d'un nouveau client             │
│  UPDATE_POLICY      → modification des seuils de scoring       │
│  CONFIGURE_WEBHOOK  → configuration des notifications          │
│  PROMOTE_MODEL      → promotion d'une version de modèle ML     │
│  ANONYMIZE_TRANSACTION → pseudonymisation sur demande          │
│  PURGE_EXPIRED      → suppression après expiration légale      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Endpoints de conformité

### `GET /api/v1/compliance/audit-log` *(admin)*

Journal d'audit paginé de toutes les actions administratives.

**Paramètres** :
- `limit` (int, défaut 100)
- `offset` (int, défaut 0)
- `action_type` (string, optionnel) — filtre par type d'action

**Usage BCEAO** : Preuve de traçabilité lors d'un contrôle réglementaire.

---

### `GET /api/v1/compliance/report` *(admin)*

Rapport de conformité pour une période donnée.

**Paramètres** :
- `from_date` (ISO 8601, défaut : -30 jours)
- `to_date` (ISO 8601, défaut : maintenant)

**Contenu** :
- Taux de détection de fraude par période
- Répartition par canal / pays / version de modèle
- Nombre d'actions administratives
- Référence réglementaire BCEAO

---

### `GET /api/v1/compliance/transactions/{id}/explanation`

Droit à l'explication pour une décision de scoring automatisée.

**Accessible sans authentification** — destiné aux sujets des données ou à leurs représentants légaux.

**Contenu** :
- Score et seuil appliqué
- Version du modèle utilisée
- Base légale du traitement
- Date d'expiration de la rétention
- Contact du Délégué à la Protection des Données (DPO)

---

### `POST /api/v1/compliance/anonymize/{id}` *(admin)*

Pseudonymisation d'une transaction.

**Comportement** :
1. Calcule `SHA-256(transaction_id)[:16]`
2. Remplace `transaction_id` par `anon-{hash}`
3. Marque `is_anonymized = True`
4. Crée une entrée `ANONYMIZE_TRANSACTION` dans `audit_logs`

> **Note** : La pseudonymisation est irréversible. Le hash à sens unique permet de vérifier l'identité si nécessaire (avec la valeur originale), sans stocker le `transaction_id` en clair.

---

### `GET /api/v1/compliance/retention-stats` *(admin)*

Statistiques de rétention des données.

Permet de surveiller le volume de données arrivant à expiration.

---

### `DELETE /api/v1/compliance/expired` *(admin)*

Suppression des enregistrements dont la durée de conservation BCEAO (5 ans) est expirée.

**À automatiser** : Configurer un `cron` mensuel via la CI/CD ou un scheduler.

```bash
# Exemple d'appel automatisé
curl -X DELETE https://api.fraudguard.ci/api/v1/compliance/expired \
     -H "X-Admin-Key: $ADMIN_API_KEY"
```

---

## Matrice de conformité

| Exigence | Référence | Statut | Endpoint / Champ |
|---|---|---|---|
| Rétention 5 ans | BCEAO Art. 15 | ✅ Implémenté | `FraudLog.data_expires_at` |
| Traçabilité admin | BCEAO Art. 18 | ✅ Implémenté | Table `audit_logs` |
| Droit à l'explication | RGPD Art. 22 / CDP | ✅ Implémenté | `GET /compliance/transactions/{id}/explanation` |
| Pseudonymisation | ARTCI / CDP | ✅ Implémenté | `POST /compliance/anonymize/{id}` |
| Rapport fraude | BCEAO Art. 20 | ✅ Implémenté | `GET /compliance/report` |
| Purge post-expiration | BCEAO Art. 15 | ✅ Implémenté | `DELETE /compliance/expired` |
| TLS (HTTPS) | BCEAO Art. 12 | ⚠️ À configurer | Nginx / ALB (infrastructure) |
| Notification incident 72h | ARTCI / CDP | ⚠️ Manuel | Alerte via webhook tenant |

---

## Contact DPO

Pour toute demande d'exercice de droits (accès, rectification, effacement) :

**Email** : dpo@fraudguard.ci  
**Délai de réponse** : 30 jours calendaires (RGPD Art. 12)
