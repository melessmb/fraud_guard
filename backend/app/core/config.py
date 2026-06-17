from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "fraud-detection-ouest-afrique"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Security
    secret_key: str = "CHANGE_ME"
    access_token_expire_minutes: int = 60

    # Admin — clé séparée pour les opérations de gestion de la plateforme
    admin_api_key: str = "CHANGE_ADMIN_KEY"

    # CORS — liste de domaines séparés par virgule ; "*" uniquement en debug
    cors_origins: str = "*"

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/fraud_ouest_afrique"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Monitoring (optional)
    prometheus_enabled: bool = True


settings = Settings()
