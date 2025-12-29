from datetime import datetime

from pydantic import BaseModel


class ProviderBase(BaseModel):
    id: int
    name: str
    provider: str
    model: str
    base_url: str | None = None
    has_api_key: bool = False
    last_tested_at: datetime | None = None
    last_test_status: str | None = None
    last_error: str | None = None
    config: dict | None = None

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class ProviderCreate(BaseModel):
    name: str
    provider: str
    model: str
    base_url: str
    api_key: str
    config: dict | None = None


class ProviderUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    model: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    config: dict | None = None
