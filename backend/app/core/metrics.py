from prometheus_client import Counter, Gauge, Histogram

fraud_scores_total = Counter(
    "fraud_scores_total",
    "Total des requêtes de scoring fraude",
    ["tenant_id", "is_fraud"],
)

scoring_latency = Histogram(
    "scoring_latency_seconds",
    "Temps de traitement d'une transaction",
    ["tenant_id"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
)

active_tenants = Gauge(
    "active_tenants_total",
    "Nombre de tenants actifs",
)
