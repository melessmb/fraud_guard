from __future__ import annotations

import logging
import threading
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.audit import log_audit
from app.core.database import get_db
from app.models.schemas import ModelVersionResponse

log = logging.getLogger(__name__)
router = APIRouter()

_REGISTRY: dict = {
    "v1": {
        "version": "v1",
        "stage": "production",
        "created_at": datetime(2024, 1, 15),
        "auc_roc": 0.9633,
        "description": "LightGBM entraine sur donnees synthetiques Afrique de l'Ouest",
    },
    "v1-heuristic": {
        "version": "v1-heuristic",
        "stage": "deprecated",
        "created_at": datetime(2024, 1, 1),
        "auc_roc": None,
        "description": "Modele heuristique initial base sur des regles",
    },
}


@router.get("/model/versions", response_model=List[ModelVersionResponse])
def list_model_versions() -> List[ModelVersionResponse]:
    return [ModelVersionResponse(**v) for v in _REGISTRY.values()]


@router.post(
    "/model/versions/{version}/promote",
    dependencies=[Depends(require_admin)],
)
def promote_model_version(version: str, db: Session = Depends(get_db)) -> dict:
    if version not in _REGISTRY:
        raise HTTPException(status_code=404, detail=f"Version '{version}' introuvable")

    previous = next((v["version"] for v in _REGISTRY.values() if v["stage"] == "production"), None)
    for v in _REGISTRY.values():
        if v["stage"] == "production":
            v["stage"] = "staging"

    _REGISTRY[version]["stage"] = "production"
    log_audit(
        db,
        action_type="PROMOTE_MODEL",
        actor_type="admin",
        resource_type="model",
        resource_id=version,
        details={"previous_production": previous},
    )
    return {"version": version, "stage": "production", "status": "promoted"}


# ── Entraînement ──────────────────────────────────────────────────────────────

_train_lock = threading.Lock()
_train_status: dict = {"running": False, "last_result": None, "last_error": None}


def _run_training() -> None:
    from app.ml.train import train_model
    try:
        result = train_model()
        version = result["version"]
        _REGISTRY[version] = {
            "version":    version,
            "stage":      "staging",
            "created_at": datetime.utcnow(),
            "auc_roc":    result["auc_roc"],
            "description": f"Entraîné automatiquement — {result['n_train']} exemples",
        }
        _train_status["last_result"] = result
        _train_status["last_error"]  = None
        log.info("Entraînement terminé — version %s, AUC=%.4f", version, result["auc_roc"])
    except Exception as exc:
        _train_status["last_error"] = str(exc)
        log.exception("Entraînement échoué : %s", exc)
    finally:
        _train_status["running"] = False


@router.post(
    "/model/train",
    status_code=202,
    dependencies=[Depends(require_admin)],
)
def trigger_training(db: Session = Depends(get_db)) -> dict:
    """Lance l'entraînement en arrière-plan (202 Accepted)."""
    with _train_lock:
        if _train_status["running"]:
            raise HTTPException(status_code=409, detail="Un entraînement est déjà en cours")
        _train_status["running"] = True

    thread = threading.Thread(target=_run_training, daemon=True, name="ml-train")
    thread.start()

    log_audit(db, action_type="TRAIN_MODEL", actor_type="admin",
              resource_type="model", resource_id="train", details={})
    return {"status": "started", "message": "Entraînement lancé en arrière-plan"}


@router.get("/model/train/status", dependencies=[Depends(require_admin)])
def get_train_status() -> dict:
    return {
        "running":     _train_status["running"],
        "last_result": _train_status["last_result"],
        "last_error":  _train_status["last_error"],
    }
