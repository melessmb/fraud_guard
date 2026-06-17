from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.audit import log_audit
from app.core.database import get_db
from app.models.schemas import ModelVersionResponse

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
