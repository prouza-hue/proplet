"""Pure player progress and statistics calculation.

The HTTP adapter is responsible for loading result/reward/rescue data and for
performing legacy repair writes.  This module only combines already loaded
plain values.  In particular, it deliberately has no dependency on
infrastructure, runtime configuration, diagnostics, or system time.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable, Mapping, Sequence


def _valid_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def streak_ending_on(date_strings: Iterable[str], anchor: date) -> int:
    values = {str(value)[:10] for value in date_strings if value}
    count = 0
    current = anchor
    while current.isoformat() in values:
        count += 1
        current -= timedelta(days=1)
    return count


def streaks(date_strings: Iterable[str], today: date) -> tuple[int, int]:
    values = sorted({date.fromisoformat(str(value)) for value in date_strings if value}, reverse=True)
    if not values:
        return 0, 0
    value_set = set(values)
    yesterday = today - timedelta(days=1)
    anchor = today if today in value_set else yesterday if yesterday in value_set else None
    current = streak_ending_on((item.isoformat() for item in value_set), anchor) if anchor else 0
    longest = max(streak_ending_on((item.isoformat() for item in value_set), item) for item in values)
    return current, longest


def _empty_reward_stats() -> dict:
    return {
        "rewardXp": 0,
        "accountBonusXp": 0,
        "wordDiscoveryXp": 0,
        "otherRewardXp": 0,
        "wordDiscoveryRewards": 0,
        "discoveredWords": 0,
        "accountRewardsIncluded": False,
    }


def reward_stats_from_rows(rows: Iterable[Mapping], *, account_rewards_included: bool = True) -> dict:
    """Classify account reward rows without any persistence dependency."""
    account_bonus_xp = 0
    word_discovery_xp = 0
    other_reward_xp = 0
    discovered_words: set[str] = set()
    discovery_rewards = 0
    for reward in rows:
        points = max(0, int(reward.get("points") or 0))
        key = str(reward.get("reward_key") or "")
        if key == "account_creation_v1":
            account_bonus_xp += points
        elif key.startswith("word_discovery_v1:"):
            word_discovery_xp += points
            discovery_rewards += 1
            word = str(reward.get("reward_word") or key.rpartition(":")[2]).strip().casefold()
            if word:
                discovered_words.add(word)
        else:
            other_reward_xp += points
    return {
        "rewardXp": account_bonus_xp + word_discovery_xp + other_reward_xp,
        "accountBonusXp": account_bonus_xp,
        "wordDiscoveryXp": word_discovery_xp,
        "otherRewardXp": other_reward_xp,
        "wordDiscoveryRewards": discovery_rewards,
        "discoveredWords": len(discovered_words),
        "accountRewardsIncluded": bool(account_rewards_included),
    }


def _empty_slots(difficulties: Sequence[str]) -> dict:
    zero = {key: 0 for key in difficulties}
    return {"effective": zero.copy(), "transferred": zero.copy(), "current": zero.copy(), "baseCurrent": zero.copy()}


def calculate_stats(
    rows: Sequence[Mapping],
    *,
    today: date,
    badges: Sequence[Mapping],
    free_difficulties: Sequence[str],
    rescued_dates: Iterable[str] = (),
    rescue_rows: Iterable[Mapping] | None = None,
    free_slots: Mapping | None = None,
    reward_rows: Iterable[Mapping] | None = None,
    account_rewards_included: bool = True,
    reward_stats: Mapping | None = None,
    gen4_rewards: Mapping | None = None,
    mozkomor_unlocked: bool = False,
    daily_dates: Iterable[str] | None = None,
    daily_times: Iterable[int] | None = None,
    clean_daily: int | None = None,
) -> dict:
    """Return the historical ``player_stats`` payload from plain inputs.

    ``today`` is mandatory so callers cannot accidentally make the result
    depend on implicit time state.  The optional daily fields are adapter-derived
    values: they let the HTTP layer retain its malformed-data warning seams
    without putting diagnostics in this pure module.
    """
    difficulties = tuple(free_difficulties)
    slots = free_slots or _empty_slots(difficulties)
    if reward_rows is not None:
        rewards = reward_stats_from_rows(reward_rows, account_rewards_included=account_rewards_included)
    else:
        rewards = dict(_empty_reward_stats() | dict(reward_stats or {}))
    repairs = dict({"repairedXp": 0, "returnBonusXp": 0, "bonusAwardedNow": 0} | dict(gen4_rewards or {}))

    computed_daily_dates: list[str] = []
    computed_daily_times: list[int] = []
    total_points = 0
    clean_solves = 0
    computed_clean_daily = 0
    free_history = {key: 0 for key in difficulties}
    tajenka_completed = 0
    mozkomor_completed = 0

    for row in rows:
        mode = row.get("mode")
        difficulty = row.get("difficulty")
        total_points += int(row.get("points") or 0)
        is_clean = row.get("clean_solve") is True
        if is_clean and mode in ("daily", "free"):
            clean_solves += 1

        if mode == "daily" and row.get("daily_date"):
            raw_date = str(row.get("daily_date"))[:10]
            try:
                date.fromisoformat(raw_date)
                computed_daily_dates.append(raw_date)
                if is_clean:
                    computed_clean_daily += 1
            except ValueError:
                pass
            try:
                computed_daily_times.append(int(row.get("best_elapsed_ms")))
            except (TypeError, ValueError):
                pass

        if mode == "free" and difficulty in free_history:
            free_history[difficulty] += 1
            if difficulty == "mozkomor":
                mozkomor_completed += 1
        elif mode == "tajenka":
            tajenka_completed += 1

    selected_daily_dates = list(computed_daily_dates if daily_dates is None else daily_dates)
    selected_daily_times = list(computed_daily_times if daily_times is None else daily_times)
    selected_clean_daily = computed_clean_daily if clean_daily is None else int(clean_daily)
    if rescue_rows is not None:
        valid_rescued_dates = {
            str(row.get("missed_date"))[:10]
            for row in rescue_rows
            if row.get("status") == "passed" and row.get("missed_date")
            and _valid_date(str(row.get("missed_date"))[:10])
        }
    else:
        valid_rescued_dates = {
            str(value)[:10] for value in rescued_dates if value and _valid_date(str(value)[:10])
        }
    effective_dates = set(selected_daily_dates) | valid_rescued_dates
    current, longest = streaks(effective_dates, today)
    earned = [badge for badge in badges if longest >= badge["days"]]
    next_badge = next((badge for badge in badges if current < badge["days"]), None)

    return {
        "points": total_points + rewards["rewardXp"],
        "resultXp": total_points,
        "xpAuthoritative": rewards["accountRewardsIncluded"],
        **rewards,
        "totalCompleted": sum(1 for row in rows if row.get("mode") in ("daily", "free")),
        "dailyCompleted": len(set(selected_daily_dates)),
        "freeCompleted": slots["effective"],
        "freeTransferred": slots["transferred"],
        "freePlayedCurrent": slots["current"],
        "freeBasePlayedCurrent": slots["baseCurrent"],
        "mozkomorUnlocked": bool(mozkomor_unlocked),
        "freePlayedGen2": slots["current"],
        "freeHistoryCompleted": free_history,
        "currentStreak": current,
        "longestStreak": longest,
        "bestDailyMs": min(selected_daily_times) if selected_daily_times else None,
        "cleanSolves": clean_solves,
        "cleanDaily": selected_clean_daily,
        "tajenkaCompleted": tajenka_completed,
        "mozkomorCompleted": mozkomor_completed,
        "rescuedDays": len(valid_rescued_dates),
        "earnedBadges": earned,
        "nextBadge": next_badge,
        "gen4RewardPolicy": "per-board",
        "gen4RewardRepairXp": repairs["repairedXp"],
        "gen4ReturnBonusXp": repairs["returnBonusXp"],
        "gen4ReturnBonusAwardedNow": repairs["bonusAwardedNow"],
    }
