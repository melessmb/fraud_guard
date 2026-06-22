/**
 * Auto-generated types from FastAPI OpenAPI schema.
 * Run `npm run gen:types` when the API is running to regenerate.
 *
 * Generation command:
 *   npx openapi-typescript http://localhost:8780/openapi.json -o src/types/api.ts
 */

export interface paths {
  "/api/v1/auth/login": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            username: string;
            password: string;
            client_id?: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            "application/json": {
              access_token: string;
              token_type: string;
              expires_in: number;
              refresh_token?: string;
            };
          };
        };
      };
    };
  };
  "/api/v1/auth/me": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": {
              sub: string;
              username: string;
              email: string;
              roles: string[];
            };
          };
        };
      };
    };
  };
  "/api/v1/auth/me/tenant": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": TenantResponse;
          };
        };
      };
    };
  };
  "/api/v1/tenants": {
    get: {
      responses: {
        200: {
          content: { "application/json": TenantResponse[] };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          "application/json": {
            name: string;
            country: string;
            environment: string;
            keycloak_id?: string;
          };
        };
      };
      responses: {
        201: { content: { "application/json": { id: number; status: string } } };
      };
    };
  };
  "/api/v1/tenants/{tenant_id}": {
    get: {
      parameters: { path: { tenant_id: number } };
      responses: { 200: { content: { "application/json": TenantResponse } } };
    };
    put: {
      parameters: { path: { tenant_id: number } };
      requestBody: { content: { "application/json": Partial<TenantResponse> } };
      responses: { 200: { content: { "application/json": TenantResponse } } };
    };
    delete: {
      parameters: { path: { tenant_id: number } };
      responses: { 204: { content: never } };
    };
  };
  "/api/v1/tenants/{tenant_id}/metrics": {
    get: {
      parameters: { path: { tenant_id: number }; query?: { hours?: number } };
      responses: { 200: { content: { "application/json": MetricsResponse } } };
    };
  };
  "/api/v1/tenants/{tenant_id}/alerts": {
    get: {
      parameters: { path: { tenant_id: number }; query?: { limit?: number } };
      responses: { 200: { content: { "application/json": AlertResponse[] } } };
    };
  };
  "/api/v1/tenants/{tenant_id}/policies": {
    get: {
      parameters: { path: { tenant_id: number } };
      responses: { 200: { content: { "application/json": PolicyConfig } } };
    };
    post: {
      parameters: { path: { tenant_id: number } };
      requestBody: { content: { "application/json": PolicyConfig } };
      responses: { 200: { content: { "application/json": PolicyConfig } } };
    };
  };
  "/api/v1/tenants/{tenant_id}/hooks": {
    get: {
      parameters: { path: { tenant_id: number } };
      responses: { 200: { content: { "application/json": ScoringHookResponse[] } } };
    };
    post: {
      parameters: { path: { tenant_id: number } };
      requestBody: { content: { "application/json": ScoringHookRequest } };
      responses: { 201: { content: { "application/json": ScoringHookResponse } } };
    };
  };
  "/api/v1/score": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            transaction_id: string;
            tenant_id: number;
            amount: number;
            currency: string;
            channel: string;
            country: string;
            device_fingerprint: string;
            ip_address: string;
            timestamp: string;
          };
        };
      };
      responses: {
        200: { content: { "application/json": ScoreResponse } };
      };
    };
  };
  "/api/v1/model/versions": {
    get: {
      responses: { 200: { content: { "application/json": ModelVersionResponse[] } } };
    };
  };
  "/api/v1/compliance/report": {
    get: {
      parameters: { query?: { from_date?: string; to_date?: string; tenant_id?: number } };
      responses: { 200: { content: { "application/json": ComplianceReport } } };
    };
  };
  "/api/v1/compliance/audit-log": {
    get: {
      parameters: { query?: { limit?: number; offset?: number; tenant_id?: number } };
      responses: { 200: { content: { "application/json": { total: number; rows: AuditLogEntry[] } } } };
    };
  };
  "/api/v1/compliance/retention-stats": {
    get: {
      responses: { 200: { content: { "application/json": RetentionStats } } };
    };
  };
  "/health": {
    get: {
      responses: { 200: { content: { "application/json": { status: string; version: string } } } };
    };
  };
}

// ── Domain types ──────────────────────────────────────────────────────────────

export interface TenantResponse {
  id: number;
  name: string;
  country: string;
  environment: string;
  keycloak_id?: string;
  created_at: string;
}

export interface MetricsResponse {
  period_start: string;
  period_end: string;
  transaction_count: number;
  fraud_count: number;
  detection_rate: number;
  false_positive_rate: number;
  model_version: string;
  tenant_id: number;
}

export interface AlertResponse {
  id: number;
  transaction_id: string;
  tenant_id: number;
  score: number;
  channel: string;
  amount: number;
  currency: string;
  timestamp: string;
  status: string;
}

export interface PolicyConfig {
  score_threshold: number;
  auto_reject_threshold: number;
  max_amount_xof?: number;
  max_amount_usd?: number;
  allowed_channels?: string[];
  blocked_channels?: string[];
  model_id: string;
}

export interface ScoringHookRequest {
  name: string;
  hook_type: "pre_score" | "post_score";
  url: string;
  secret?: string;
  timeout_ms?: number;
  enabled?: boolean;
}

export interface ScoringHookResponse extends ScoringHookRequest {
  id: number;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

export interface ScoreResponse {
  transaction_id: string;
  score: number;
  is_fraud: boolean;
  model_version: string;
  explanations?: Record<string, unknown>;
}

export interface ModelVersionResponse {
  version: string;
  stage: string;
  created_at: string;
  auc_roc?: number;
  description: string;
}

export interface ComplianceReport {
  period_from: string;
  period_to: string;
  generated_at: string;
  tenant_id?: number;
  regulatory_reference: string;
  transactions: {
    total: number;
    fraud_detected: number;
    fraud_rate: number;
    anonymized: number;
    by_channel: Record<string, number>;
    by_country: Record<string, number>;
    by_model_version: Record<string, number>;
  };
  audit_actions: number;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  action_type: string;
  actor_type: string;
  actor_id?: string;
  resource_type?: string;
  resource_id?: string;
  outcome: string;
}

export interface RetentionStats {
  total_records: number;
  expired_records: number;
  anonymized_records: number;
  retention_policy_years: number;
  regulatory_reference: string;
}
