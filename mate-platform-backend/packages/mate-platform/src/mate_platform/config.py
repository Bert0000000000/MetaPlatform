from pydantic_settings import BaseSettings, SettingsConfigDict


class PlatformSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MATE_", env_file=".env", extra="ignore")
    profile: str = "production"
    service_name: str = "mate-platform"
    log_level: str = "INFO"
