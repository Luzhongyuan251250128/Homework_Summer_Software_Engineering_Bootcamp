from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    admin_password: str = "changeme"
    master_key: str | None = None
    llm_api_key: str | None = None
    llm_base_url: str = "https://api.deepseek.com/v1"
    llm_model: str = "deepseek-chat"
    llm_timeout: float = 60.0
    sync_interval_hours: int = 0
    database_path: str = "devhours.db"
    session_secret: str = "dev-only-secret-change-me"

    # 工时估算口径常量（SPEC §3.3 M3）
    cluster_gap_minutes: int = 90
    segment_boundary_minutes: int = 30
    segment_cap_hours: float = 6.0
    lines_per_unit: int = 2000
    volume_coef_min: float = -0.2
    volume_coef_max: float = 0.5
    daily_cap_hours: float = 12.0
    weekend_factor: float = 0.5

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
