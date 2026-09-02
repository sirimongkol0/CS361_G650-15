from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./app.db"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = False

    # Comma-separated browser origins allowed to call the public API.
    # Keep this explicit rather than using "*" so credentialed requests do
    # not accidentally become available from arbitrary sites.
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    # File storage: files live OUTSIDE the database (S3 or local disk).
    STORAGE_BACKEND: str = "local"   # "local" (dev/test/CI) | "s3" (production)
    S3_BUCKET: str = ""              # required when STORAGE_BACKEND=s3
    AWS_REGION: str = "ap-southeast-1"
    # Optional static credentials (pick up from .env / container env).
    # Leave empty on EC2/IAM-role deployments -- boto3 uses the role credential chain.
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    LOCAL_STORAGE_DIR: str = "./storage"  # used when STORAGE_BACKEND=local

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origins(self) -> list[str]:
        """Return normalized, non-empty origins from ``CORS_ORIGINS``."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
