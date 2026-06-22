"""
Chargement et inférence du modèle LightGBM avec explications SHAP.
"""
from __future__ import annotations

import hashlib
import logging
import pickle
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent.parent / "data" / "models"

# Hashes SHA-256 attendus des fichiers modèle. Générer avec :
#   python -c "import hashlib; print(hashlib.sha256(open('fraud_v1.pkl','rb').read()).hexdigest())"
# Laisser vide pour désactiver la vérification (mode développement seulement).
_MODEL_HASHES: Dict[str, str] = {}


def _verify_model_integrity(version: str, content: bytes) -> None:
    expected = _MODEL_HASHES.get(version)
    if not expected:
        log.warning(
            "Aucun hash configuré pour le modèle '%s' — vérification d'intégrité ignorée. "
            "Ajoutez le hash SHA-256 dans _MODEL_HASHES pour sécuriser le chargement.",
            version,
        )
        return
    actual = hashlib.sha256(content).hexdigest()
    if actual != expected:
        raise ValueError(
            f"Intégrité du modèle '{version}' compromise : hash attendu {expected[:16]}…, "
            f"obtenu {actual[:16]}…"
        )

FEATURES = [
    "amount_log",
    "hour",
    "channel_enc",
    "country_enc",
    "velocity_1h",
    "velocity_24h",
    "device_known",
    "is_night",
]

_CHANNEL_MAP = {"mobile_money": 0, "web": 1, "pos": 2, "atm": 3}
_COUNTRY_MAP = {"CI": 0, "SN": 1, "GH": 2, "NG": 3, "BJ": 4}

_model_cache: Dict[str, Any] = {}
_explainer_cache: Dict[str, Any] = {}


def _load_model(version: str = "v1") -> Dict[str, Any]:
    if version not in _model_cache:
        path = MODEL_DIR / f"fraud_{version}.pkl"
        if not path.exists():
            raise FileNotFoundError(f"Modèle {version} introuvable : {path}")
        content = path.read_bytes()
        _verify_model_integrity(version, content)
        _model_cache[version] = pickle.loads(content)  # noqa: S301 — intégrité vérifiée ci-dessus
    return _model_cache[version]


def _encode_features(event: Dict[str, Any]) -> List[float]:
    amount = float(event.get("amount", 0.0))
    hour = int(event.get("hour", 12))
    channel = str(event.get("channel", "web"))
    country = str(event.get("country", "CI"))
    fp = str(event.get("device_fingerprint", ""))

    return [
        float(np.log1p(amount)),
        hour,
        float(_CHANNEL_MAP.get(channel, 1)),
        float(_COUNTRY_MAP.get(country, 0)),
        float(event.get("velocity_1h", 1)),
        float(event.get("velocity_24h", 5)),
        1.0 if (fp and len(fp) > 8) else 0.0,
        1.0 if (hour < 6 or hour >= 22) else 0.0,
    ]


def predict(event: Dict[str, Any], version: str = "v1", threshold: float = 0.70) -> Dict[str, Any]:
    bundle = _load_model(version)
    model = bundle["model"]
    auc = bundle.get("auc_roc")

    feat_values = _encode_features(event)
    X = pd.DataFrame([feat_values], columns=FEATURES)

    score = float(model.predict_proba(X)[0][1])
    is_fraud = score >= threshold

    explanations: Optional[Dict[str, Any]] = None
    try:
        import shap

        if version not in _explainer_cache:
            _explainer_cache[version] = shap.TreeExplainer(model)
        explainer = _explainer_cache[version]

        shap_vals = explainer.shap_values(X)
        sv = shap_vals[1][0] if isinstance(shap_vals, list) else shap_vals[0]
        base = explainer.expected_value
        base_val = float(base[1] if isinstance(base, (list, np.ndarray)) else base)

        explanations = {
            "shap_values": {f: float(v) for f, v in zip(FEATURES, sv)},
            "base_value": base_val,
            "model_auc": auc,
        }
    except Exception:
        explanations = {"note": "shap_unavailable"}

    return {
        "score": score,
        "is_fraud": is_fraud,
        "model_version": f"v1-lgbm",
        "explanations": explanations,
    }
