"""Semantic checks for the single public, versioned Archive download."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend import archive


def edition_fixture():
    rows = []
    for difficulty, reward in archive.REWARDS.items():
        for level in range(1, 201):
            puzzle_id = f"g3-{difficulty}-{level:03}"
            canonical = [{"word": "ABDC", "path": [0, 1, 3, 2]}]
            covers = [canonical]
            if len(rows) < 79:
                covers.append([{"word": "DCAB", "path": [3, 2, 0, 1]}])
            rows.append({
                "puzzle": {"id": puzzle_id, "difficulty": difficulty, "rows": 2, "cols": 2,
                           "mask": [0, 1, 2, 3], "letters": list("ABCD"), "answers": canonical,
                           "meta": {"level": level, "contentGeneration": 3}},
                "level": level, "difficulty": difficulty, "rewardXp": reward,
                "rewardSlotKey": f"legacy-free:{difficulty}:{level}",
                "solutions": {"puzzleId": puzzle_id, "gameplayScope": "archive",
                              "solutionPolicyRevision": archive.REVISION, "solutionSets": covers},
            })
    return {"editionId": archive.EDITION, "solutionPolicyRevision": archive.REVISION,
            "completeCovers": 879, "boards": rows}


class ArchiveDownloadTests(unittest.TestCase):
    def test_one_payload_contains_every_playable_entry_and_approved_cover(self):
        edition = edition_fixture()
        payload = archive.offline_payload(edition)
        self.assertEqual(payload["formatVersion"], 1)
        self.assertEqual(payload["boardCount"], 800)
        self.assertEqual(len(payload["boards"]), 800)
        self.assertEqual(len(payload["entries"]), 800)
        self.assertEqual(sum(len(e["solutions"]["solutionSets"]) for e in payload["entries"]), 879)
        for summary, entry in zip(payload["boards"], payload["entries"]):
            self.assertEqual(summary["puzzleId"], entry["puzzle"]["id"])
            self.assertEqual(entry["editionId"], payload["editionId"])
            for cover in entry["solutions"]["solutionSets"]:
                archive.validate_completion(entry, {"editionId": payload["editionId"],
                                                    "solutionPolicyRevision": payload["solutionPolicyRevision"],
                                                    "found": cover})
        # Publishing or consuming the download cannot modify the canonical source.
        payload["entries"][0]["puzzle"]["letters"][0] = "X"
        payload["entries"][0]["solutions"]["solutionSets"][0][0]["word"] = "XXXX"
        self.assertEqual(edition["boards"][0]["puzzle"]["letters"][0], "A")
        self.assertEqual(edition["boards"][0]["solutions"]["solutionSets"][0][0]["word"], "ABDC")

    def test_player_claims_never_enter_shared_download(self):
        edition = edition_fixture()
        edition["claims"] = {"player-secret": 50}
        edition["boards"][0]["claims"] = {"paid": True}
        edition["boards"][0]["solutions"]["claims"] = {"player-secret": 50}
        payload = archive.offline_payload(edition)
        self.assertNotIn("claims", payload)
        self.assertNotIn("claims", payload["entries"][0])
        self.assertNotIn("claims", payload["entries"][0]["solutions"])

    def test_partial_mixed_or_corrupted_download_is_rejected(self):
        cases = {
            "revision": lambda e: e.update(solutionPolicyRevision="next-revision"),
            "missing-board": lambda e: e["boards"].pop(),
            "wrong-total-covers": lambda e: e.update(completeCovers=878),
            "mixed-entry-revision": lambda e: e["boards"][0]["solutions"].update(solutionPolicyRevision="old"),
            "foreign-solution": lambda e: e["boards"][0]["solutions"].update(puzzleId="other"),
            "wrong-level-binding": lambda e: e["boards"][0]["puzzle"]["meta"].update(level=2),
            "wrong-reward": lambda e: e["boards"][0].update(rewardXp=999),
            "duplicate-entry": lambda e: e["boards"].__setitem__(1, deepcopy(e["boards"][0])),
            "unplayable-cover": lambda e: e["boards"][0]["solutions"]["solutionSets"][1][0].update(path=[0, 3, 2, 1]),
            "missing-approval": lambda e: e["boards"][0]["solutions"]["solutionSets"].pop(),
            "duplicate-approval": lambda e: e["boards"][0]["solutions"]["solutionSets"].append(deepcopy(e["boards"][0]["solutions"]["solutionSets"][0])),
        }
        for name, mutate in cases.items():
            with self.subTest(name=name):
                edition = edition_fixture()
                mutate(edition)
                with self.assertRaises(ValueError):
                    archive.offline_payload(edition)


if __name__ == "__main__":
    unittest.main()
