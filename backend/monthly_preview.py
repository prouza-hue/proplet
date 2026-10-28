"""Private controls for the disposable monthly preview; never a production API."""
from datetime import datetime, timezone
from typing import Literal
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict, model_validator


class MonthlyPreviewControl(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["clock", "status", "finalize"]
    now: datetime | None = None

    @model_validator(mode="after")
    def valid_clock(self):
        if self.action == "clock":
            if self.now is None or self.now.tzinfo is None:
                raise ValueError("Clock requires a timezone-aware timestamp")
            if not datetime(2026, 11, 1, tzinfo=ZoneInfo("Europe/Prague")) <= self.now < datetime(2027, 1, 5, tzinfo=ZoneInfo("Europe/Prague")):
                raise ValueError("QA clock is confined to the November/December test season")
        elif self.now is not None:
            raise ValueError("Only clock accepts a timestamp")
        return self
