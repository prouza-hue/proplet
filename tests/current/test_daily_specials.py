"""Content/time/progression invariants for optional Daily; no external writes."""
import copy
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from backend.daily_specials import DailySpecials, official_completion_allowed
from backend.dated_daily import DailyPackInvalid, DailyUnavailable, PRAGUE
from backend.progress import calculate_stats


class SpecialInvariants(unittest.TestCase):
    def setUp(self):
        self.source = json.loads((ROOT / "data/daily_specials_private.json").read_text())
        self.bank = DailySpecials(self.source, allow_candidate=True)
        self.today = date(2026, 10, 14)
        self.binding = self.bank.binding(self.today.isoformat(), today=self.today)

    def test_candidate_cannot_become_production_by_flag(self):
        with self.assertRaises(DailyPackInvalid):
            DailySpecials({**self.source, "status": "candidate"})

    def test_finite_calendar_has_no_modulo_fallback(self):
        self.assertEqual(len(self.bank._bindings), 36)
        self.assertIsNone(self.bank.binding("2027-01-13", today=date(2027,1,13)))
        self.assertIsNone(self.bank.binding("2026-10-13", today=self.today))
        with self.assertRaises(DailyUnavailable):
            self.bank.binding("2026-10-16", today=self.today)
        self.assertIsNone(self.bank.puzzle_by_id("g6-ds-mozkomor-w01", today=self.today))

    def test_binding_rejects_content_and_difficulty_tampering(self):
        for mutate in (lambda source: source["bindings"][0].update(difficulty="mozkomor"),
                       lambda source: source["puzzles"][self.binding.puzzle_id]["letters"].__setitem__(0,"X"),
                       lambda source: source["bindings"][0].update(contentHash="0"*64),
                       lambda source: source["bindings"].pop()):
            source=copy.deepcopy(self.source)
            mutate(source)
            with self.assertRaises(DailyPackInvalid):
                DailySpecials(source,allow_candidate=True)
        for wrong in (f"daily:{self.today}",self.binding.challenge_key+":x","daily-special:2026-10-14:mozkomor"):
            with self.assertRaises(DailyUnavailable):
                self.bank.identity(challenge_key=wrong,puzzle_id=self.binding.puzzle_id,difficulty="hardcore",today=self.today)

    def test_practice_retains_separate_reward_identity(self):
        current=self.bank.descriptor(self.binding,today=self.today)
        archive=self.bank.descriptor(self.binding,today=self.today+timedelta(days=1))
        self.assertTrue(current["official"])
        self.assertEqual(current["rewardXp"],200)
        self.assertFalse(archive["official"])
        self.assertEqual(archive["rewardXp"],0)
        self.assertNotEqual(archive["challengeKey"],current["challengeKey"])
        self.assertEqual(archive["officialChallengeKey"],current["challengeKey"])
        _,practice=self.bank.identity(challenge_key=current["practiceChallengeKey"],puzzle_id=self.binding.puzzle_id,
                                     difficulty="hardcore",today=self.today)
        self.assertTrue(practice)

    def test_future_calendar_metadata_has_no_content(self):
        metadata=self.bank.week_metadata(self.today)
        self.assertEqual([row["difficulty"] for row in metadata],["hardcore","mozkomor","mozkokalypsa"])
        for row in metadata:
            self.assertEqual(set(row),{"dailyDate","difficulty","status","challengeKind"})

    def test_offline_grace_needs_server_finished_release_day(self):
        session={"created_at":"2026-10-14T18:00:00+02:00","last_seen":"2026-10-14T18:12:00+02:00",
                 "finished":True,"verified":True}
        now=datetime(2026,10,15,18,0,tzinfo=PRAGUE)
        self.assertTrue(official_completion_allowed(self.binding,now=now,session=session))
        for changed in (None,{**session,"verified":False},{**session,"finished":False},
                        {**session,"last_seen":"2026-10-15T00:01:00+02:00"},
                        {**session,"created_at":"2026-10-13T23:00:00+02:00"}):
            self.assertFalse(official_completion_allowed(self.binding,now=now,session=changed))
        self.assertFalse(official_completion_allowed(self.binding,now=datetime(2026,10,16,0,0,1,tzinfo=PRAGUE),session=session))

    def test_midnight_and_dst_are_prague_calendar_exact(self):
        binding=self.bank.binding("2026-10-25",today=date(2026,10,25))
        self.assertEqual((binding.expires_at.astimezone(timezone.utc)-binding.starts_at.astimezone(timezone.utc)).total_seconds(),25*3600)
        self.assertEqual((binding.grace_until-binding.expires_at.astimezone(timezone.utc)).total_seconds(),24*3600)
        self.assertEqual(binding.expires_at.hour,0)

    def test_special_and_base_same_day_are_two_challenges_one_streak(self):
        base={"mode":"daily","daily_date":"2026-10-14","challenge_key":"daily:2026-10-14","points":100,"clean_solve":True}
        special={"mode":"daily_special","daily_date":"2026-10-14","challenge_key":self.binding.challenge_key,"points":200,"clean_solve":True}
        calculate=lambda rows: calculate_stats(rows,today=self.today,badges=[{"days":1,"name":"base"}],free_difficulties=("hardcore",))
        only=calculate([special])
        self.assertEqual((only["dailyCompleted"],only["currentStreak"],only["cleanDaily"],only["rescuedDays"]),(0,0,0,0))
        self.assertEqual(only["earnedBadges"],[])
        for rows in ([base,special],[special,base]):
            stats=calculate(rows)
            self.assertEqual((stats["dailyCompleted"],stats["dailySpecialCompleted"],stats["dailyChallengeCompleted"],stats["currentStreak"]),(1,1,2,1))
            self.assertEqual(stats["points"],300)
            self.assertEqual(stats["totalCompleted"],1) # existing general badges are preserved


if __name__=="__main__":
    unittest.main()
