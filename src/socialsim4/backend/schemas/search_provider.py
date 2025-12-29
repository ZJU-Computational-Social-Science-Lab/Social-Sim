from pydantic import BaseModel


class SearchProviderBase(BaseModel):
    id: int
    provider: str
    base_url: str | None = None
    has_api_key: bool = False
    config: dict | None = None

    class Config:
        from_attributes = True


class SearchProviderCreate(BaseModel):
    provider: str
    base_url: str | None = None
    api_key: str | None = None
    config: dict | None = None


class SearchProviderUpdate(BaseModel):
    provider: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    config: dict | None = None

