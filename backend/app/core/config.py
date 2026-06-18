from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "fraud-detection-ouest-afrique"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Security (conservé pour compatibilité hash API keys existantes)
    secret_key: str = "CHANGE_ME"

    # Keycloak — IdP centralisé (remplace admin_api_key + JWT internes)
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "fraudguard"

    # CORS — liste de domaines séparés par virgule ; "*" uniquement en debug
    cors_origins: str = "*"

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/fraud_ouest_afrique"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Monitoring (optional)
    prometheus_enabled: bool = True


settings = Settings()
