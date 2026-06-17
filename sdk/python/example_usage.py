from fraud_sdk import FraudClient

client = FraudClient(base_url="http://localhost:8000", api_key="dev-key")
transaction = {
  "transaction_id": "txdemo1",
  "tenant_id": 1,
  "amount": 12000000.0,
  "currency": "XOF",
  "channel": "mobile_money",
  "country": "CI",
  "device_fingerprint": "dp_demo",
  "ip_address": "102.89.0.10",
  "timestamp": "2025-06-16T12:00:00Z",
  "client_id": "client_demo"
}

result = client.score(transaction=transaction)
print(result)
