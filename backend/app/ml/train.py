"""
Script d'entraînement LightGBM sur données synthétiques de fraude Afrique de l'Ouest.
Usage : python -m app.ml.train  (depuis backend/)
"""
from __future__ import annotations

import pickle
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

CHANNELS = ["mobile_money", "web", "pos", "atm"]
COUNTRIES = ["CI", "SN", "GH", "NG", "BJ"]
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

MODEL_DIR = Path(__file__).parent.parent.parent / "data" / "models"


def generate_synthetic_data(n_samples: int = 20_000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    amounts = rng.lognormal(mean=10.5, sigma=2.5, size=n_samples)
    hours = rng.integers(0, 24, size=n_samples)
    channels = rng.choice(CHANNELS, size=n_samples, p=[0.40, 0.30, 0.20, 0.10])
    countries = rng.choice(COUNTRIES, size=n_samples, p=[0.40, 0.30, 0.15, 0.10, 0.05])
    velocity_1h = rng.poisson(lam=1.5, size=n_samples)
    velocity_24h = rng.poisson(lam=12, size=n_samples)
    device_known = rng.binomial(1, 0.85, size=n_samples)

    df = pd.DataFrame(
        {
            "amount": amounts,
            "hour": hours,
            "channel": channels,
            "country": countries,
            "velocity_1h": velocity_1h,
            "velocity_24h": velocity_24h,
            "device_known": device_known,
        }
    )

    df["amount_log"] = np.log1p(df["amount"])
    df["is_night"] = ((df["hour"] < 6) | (df["hour"] >= 22)).astype(int)
    df["channel_enc"] = df["channel"].map(
        {"mobile_money": 0, "web": 1, "pos": 2, "atm": 3}
    )
    df["country_enc"] = df["country"].map(
        {"CI": 0, "SN": 1, "GH": 2, "NG": 3, "BJ": 4}
    )

    # Score de fraude synthétique basé sur des patterns réels Afrique de l'Ouest
    fraud_score = (
        0.30 * (df["amount_log"] / df["amount_log"].max())
        + 0.25 * (df["channel"] == "mobile_money").astype(float)
        + 0.20 * df["is_night"].astype(float)
        + 0.15 * (df["velocity_1h"] > 3).astype(float)
        + 0.10 * (1 - df["device_known"].astype(float))
    )
    fraud_score += rng.normal(0, 0.08, size=n_samples)
    df["is_fraud"] = (fraud_score > 0.63).astype(int)

    return df


def train_model(n_samples: int = 20_000) -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Génération de {n_samples} transactions synthétiques...")
    df = generate_synthetic_data(n_samples)
    fraud_rate = df["is_fraud"].mean()
    print(f"Taux de fraude synthétique : {fraud_rate:.2%}")

    X = df[FEATURES]
    y = df["is_fraud"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    model = lgb.LGBMClassifier(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=6,
        num_leaves=31,
        min_child_samples=20,
        class_weight="balanced",
        random_state=42,
        verbose=-1,
    )

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.early_stopping(50, verbose=False)],
    )

    y_pred = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_pred)
    print(f"AUC-ROC (test) : {auc:.4f}")

    bundle = {
        "model": model,
        "features": FEATURES,
        "auc_roc": float(auc),
        "version": "v1",
        "n_train": len(X_train),
    }

    model_path = MODEL_DIR / "fraud_v1.pkl"
    with open(model_path, "wb") as f:
        pickle.dump(bundle, f)

    print(f"Modele sauvegarde : {model_path}")


if __name__ == "__main__":
    train_model()
