from dataclasses import dataclass


@dataclass
class SearchConfig:
    dialect: str
    api_key: str = ""
    base_url: str | None = None
    params: dict | None = None

