"""Pydantic request contracts kept separate from route implementations."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class PlayerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    # v3.20: team is optional. Keeping these fields preserves older cached clients.
    family_code: Optional[str] = Field(default=None, max_length=24)
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    league_pin: Optional[str] = Field(default=None, max_length=32)
    create_league: bool = False
    league_name: Optional[str] = Field(default=None, max_length=40)


class PlayerLogin(BaseModel):
    # v3.31.8: accepts either the historical display name or a verified email.
    name: str = Field(min_length=1, max_length=254)
    # New accounts log in with name + password. Team remains an optional
    # disambiguator for legacy duplicate names.
    family_code: Optional[str] = Field(default=None, max_length=24)
    password: str = Field(min_length=8, max_length=128)


class PasswordSet(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class AvatarSet(BaseModel):
    avatar: Optional[str] = Field(default=None, min_length=1, max_length=16)
    use_google_avatar: bool = False


class SupportModeSet(BaseModel):
    support_mode: str


class HelperEventCreate(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    puzzle_id: str
    challenge_key: str
    event_type: str
    support_mode: str = Field(default="none", max_length=32)
    elapsed_ms: int = Field(default=0, ge=0, le=86_400_000)
    idle_ms: int = Field(default=0, ge=0, le=86_400_000)
    found_words: int = Field(default=0, ge=0, le=99)
    total_words: int = Field(default=0, ge=0, le=99)


class HintEventCreate(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    puzzle_id: str
    challenge_key: str
    hint_level: int = Field(ge=1, le=3)
    source: str = Field(default="manual", max_length=24)
    support_mode: str = Field(default="none", max_length=32)
    complimentary: bool = False
    elapsed_ms: int = Field(default=0, ge=0, le=86_400_000)
    found_words: int = Field(default=0, ge=0, le=99)
    total_words: int = Field(default=0, ge=0, le=99)


class ProductEventCreate(BaseModel):
    event_type: str = Field(min_length=2, max_length=40)


class TeamPinSet(BaseModel):
    pin: str = Field(min_length=4, max_length=32)


class TeamMembershipSet(BaseModel):
    mode: str = Field(pattern="^(join|new)$")
    family_code: Optional[str] = Field(default=None, max_length=24)
    league_pin: str = Field(min_length=4, max_length=32)
    league_name: Optional[str] = Field(default=None, max_length=40)


class ResultCreate(BaseModel):
    puzzle_id: str
    challenge_key: str
    mode: str
    difficulty: str
    elapsed_ms: int = Field(ge=1000, le=86_400_000)
    moves: int = Field(ge=1, le=10000)
    daily_date: Optional[str] = None
    hints_used: int = Field(default=0, ge=0, le=99)
    wrong_attempts: int = Field(default=0, ge=0, le=999)
    max_hint_level: int = Field(default=0, ge=0, le=3)
    attempt_id: Optional[str] = Field(default=None, min_length=8, max_length=80)
    # Conservative default keeps older cached clients from being falsely marked as Clean.
    clean_solve: bool = False
    # Client timestamp lets delayed/offline sync preserve the actual first completion.
    completed_at: Optional[str] = Field(default=None, max_length=40)
    # Klidny rezim keeps XP/progress but is excluded from competitive standings.
    calm_mode: bool = False


class AttemptStart(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    puzzle_id: str
    challenge_key: str
    mode: str
    difficulty: str
    calm_mode: bool = False


class AttemptCheckpoint(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    event_type: str
    elapsed_ms: int = Field(default=0, ge=0, le=86_400_000)
    found_words: int = Field(default=0, ge=0, le=99)
    calm_mode: Optional[bool] = None


class AttemptFinishTelemetry(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    puzzle_id: str
    challenge_key: str
    mode: str
    difficulty: str
    elapsed_ms: int = Field(ge=1000, le=86_400_000)
    moves: int = Field(ge=1, le=10000)
    hints_used: int = Field(default=0, ge=0, le=99)
    wrong_attempts: int = Field(default=0, ge=0, le=999)
    max_hint_level: int = Field(default=0, ge=0, le=3)
    clean_solve: bool = False
    completed_at: Optional[str] = Field(default=None, max_length=40)
    calm_mode: bool = False


class AnonymousClaim(BaseModel):
    anonymous_id: str = Field(min_length=16, max_length=100)


class FeedbackCreate(BaseModel):
    puzzle_id: str
    challenge_key: str
    kind: str
    rating: Optional[int] = Field(default=None, ge=-1, le=1)
    word: Optional[str] = Field(default=None, max_length=80)
    note: Optional[str] = Field(default=None, max_length=300)


class SupportReportCreate(BaseModel):
    category: str = Field(pattern="^(bug|account|privacy|idea|other)$")
    message: str = Field(min_length=3, max_length=1200)
    reply_to: Optional[str] = Field(default=None, max_length=160)
    page: Optional[str] = Field(default=None, max_length=120)


class SupportReportUpdate(BaseModel):
    status: str = Field(pattern="^(new|reviewing|resolved|dismissed)$")
    resolution_note: Optional[str] = Field(default=None, max_length=500)


class ClientErrorCreate(BaseModel):
    code: str = Field(default="client_error", min_length=2, max_length=80)
    message: Optional[str] = Field(default=None, max_length=240)
    route: Optional[str] = Field(default=None, max_length=120)


class AccountDeleteConfirm(BaseModel):
    confirmation: str = Field(min_length=4, max_length=20)
    password: Optional[str] = Field(default=None, max_length=128)


class AdminReportUpdate(BaseModel):
    status: str = Field(min_length=3, max_length=20)
    resolution_note: Optional[str] = Field(default=None, max_length=500)


class RescueFinish(BaseModel):
    puzzle_id: str
    completed: bool
    elapsed_ms: int = Field(ge=0, le=120_000)


class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(min_length=20, max_length=2048)
    p256dh: str = Field(min_length=20, max_length=512)
    auth: str = Field(min_length=8, max_length=256)
    user_agent: Optional[str] = Field(default=None, max_length=300)
    # None means an older client: preserve the historical Daily-only semantics.
    daily_enabled: Optional[bool] = None
    content_enabled: Optional[bool] = None


class PushUnsubscribe(BaseModel):
    endpoint: str = Field(min_length=20, max_length=2048)


class FamilyLeagueSettings(BaseModel):
    enabled: bool
    public_name: Optional[str] = Field(default=None, min_length=2, max_length=40)
    league_pin: Optional[str] = Field(default=None, max_length=32)  # backward compatibility with v3.8.1 clients


class PublicRankingsSet(BaseModel):
    enabled: bool
