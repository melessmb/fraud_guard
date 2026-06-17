"""Lightweight SDK for fraud-detection-ouest-afrique (Python)."""

from __future__ import annotations

import os
from typing import Any, Dict

import requests


class FraudClient:
    def __init__(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def score(self, transaction: Dict[str, Any]) -> Dict[str, Any]:
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
        }
        response = requests.post(
            f"{self.base_url}/api/v1/score",
            json=transaction,
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()
        return response.json()
