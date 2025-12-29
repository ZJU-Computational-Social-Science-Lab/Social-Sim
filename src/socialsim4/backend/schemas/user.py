from datetime import datetime

from pydantic import BaseModel, EmailStr

class UserBase(BaseModel):
    id: int
    email: EmailStr
    username: str
    full_name: str | None = None
    organization: str | None = None
    phone_number: str | None = None
    is_active: bool
    is_verified: bool
    role: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class UserPublic(UserBase):
    last_login_at: datetime | None = None


class UserCreate(BaseModel):
    organization: str | None = None
    email: EmailStr
    username: str
    full_name: str
    phone_number: str
    password: str


class UserUpdate(BaseModel):
    organization: str | None = None
    full_name: str | None = None
    phone_number: str | None = None
