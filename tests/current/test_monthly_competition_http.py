"""Monthly HTTP activation, identity and environment boundary; no remote I/O."""
import os
import sys
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi.testclient import TestClient
from backend.config import load_settings
import server

client = TestClient(server.app)
with patch.dict(os.environ, {"PROPLET_MONTHLY_ENABLED": "false"}), patch.object(server, "db_rpc", side_effect=AssertionError("disabled DB access")):
    response = client.get("/api/competition/monthly?month=2026-11")
    assert response.status_code == 200 and response.json()["enabled"] is False
    assert response.headers["cache-control"] == "no-store"
    assert client.get("/api/cron/monthly-competition").status_code == 404
assert client.get("/api/competition/monthly?month=2026-13").status_code == 422
with patch.object(server, "VERCEL_ENV", "production"):
    assert client.get("/api/competition/monthly?scenario=over20").status_code == 404
with patch.object(server, "VERCEL_ENV", "preview"), \
     patch.object(server, "VERCEL_GIT_COMMIT_REF", "codex/monthly-competition-202611"), \
     patch.object(server, "SUPABASE_URL", "https://eanzztstmwlamwfdskbf.supabase.co"), \
     patch.object(server, "db_rpc", side_effect=AssertionError("scenario DB access")):
    response = client.get("/api/competition/monthly?scenario=over20")
    assert response.status_code == 200
    assert response.json()["isolatedScenario"] == "over20" and response.json()["onlineBackend"] is False
    assert response.headers["cache-control"] == "no-store"
    assert client.get("/api/competition/monthly?scenario=unknown").status_code == 422

preview = {"VERCEL_ENV": "preview", "VERCEL_GIT_COMMIT_REF": "codex/monthly-competition-202611",
           "SUPABASE_URL": "https://eanzztstmwlamwfdskbf.supabase.co", "SUPABASE_SECRET_KEY": "inherited-production",
           "PROPLET_MONTHLY_TEST_KEY": "isolated-only"}
with patch.dict(os.environ, preview):
    assert load_settings().supabase_secret_key == "isolated-only"
    with patch.dict(os.environ, {"PROPLET_MONTHLY_TEST_KEY": ""}):
        assert load_settings().supabase_secret_key == ""
    with patch.dict(os.environ, {"SUPABASE_URL": "https://iopyhluayfszskyqqpuc.supabase.co"}):
        try:
            load_settings()
        except RuntimeError:
            pass
        else:
            raise AssertionError("monthly preview accepted production database")

viewer = {"id": "00000000-0000-4000-8000-000000000001"}
with patch.object(server, "monthly_competition_available", return_value=True), \
     patch.object(server, "enforce_rate_limit"), \
     patch.object(server, "_ranking_viewer", return_value=viewer), \
     patch.object(server.monthly_competition, "state", return_value={"enabled": True, "status": "open"}) as state:
    response = client.get("/api/competition/monthly?month=2026-11")
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    assert state.call_args.kwargs["month"] == "2026-11-01"
    assert state.call_args.kwargs["player_id"] == viewer["id"]
    with patch.object(server, "CRON_SECRET", "isolated-cron"), patch.object(server.monthly_competition, "finalize", return_value={"finalized": 0}) as finalize:
        assert client.get("/api/cron/monthly-competition").status_code == 403
        finalize.assert_not_called()
        assert client.get("/api/cron/monthly-competition", headers={"Authorization": "Bearer isolated-cron"}).json() == {"finalized": 0}
        finalize.assert_called_once()
print("PASS monthly HTTP: disabled no I/O, month validation, no-store, authenticated viewer, cron auth, preview credential isolation")

# Exercise the real serializer over HTTP: v2 score facts/precision and unique
# final placement survive the route while private IDs remain private.
private='12345678-1234-4234-8234-123456789012'
raw={'enabled':True,'month':'2026-11-01','status':'closed','scoringVersion':2,'rulesVersion':'monthly-quality-v2',
 'standings':[{'playerId':private,'rank':1,'points':2499.9,'dailyPoints':2000,'otherPoints':499.9,'otherEarnedXp':5999,'otherCreditedXp':5999,
   'cleanCount':20,'hintCount':0,'verifiedTimeMs':123456,'unverifiedDays':0,'drawPending':False,'tieBreakReason':'dailyPoints'},
  {'playerId':viewer['id'],'rank':2,'points':2499.9,'dailyPoints':1999.9,'otherPoints':500,'otherEarnedXp':6001,'otherCreditedXp':6000,
   'cleanCount':20,'hintCount':0,'verifiedTimeMs':None,'unverifiedDays':1,'drawPending':False,'tieBreakReason':'dailyPoints'}],
 'previousPodium':[],'badges':[]}
raw['me']={**raw['standings'][1],'days':[{'date':'2026-11-01','points':99.9,'clean':True,'hints':0,'counted':True,
 'completionPoints':55,'cleanPoints':15,'hintPoints':10,'speedPoints':19.9,'verifiedTimeMs':None,'provisional':False}]}
with patch.object(server,'monthly_competition_available',return_value=True),patch.object(server,'enforce_rate_limit'), \
     patch.object(server,'_ranking_viewer',return_value=viewer),patch.object(server,'db_rpc',return_value=raw), \
     patch.object(server,'db_select_bounded',return_value=[]),patch.object(server.patrons,'annotate_players',side_effect=lambda rows,rpc:rows), \
     patch.object(server,'_ranking_display_identity',return_value={'name':'Private','avatar':'X','anonymous':True}):
    response=client.get('/api/competition/monthly?month=2026-11')
    assert response.status_code==200 and response.headers['cache-control']=='no-store'
    body=response.json()
    assert body['scoringVersion']==2 and body['me']['points']==2499.9 and body['me']['otherCreditedXp']==6000
    assert body['me']['verifiedTimeMs'] is None and body['me']['days'][0]['speedPoints']==19.9
    assert [r['rank'] for r in body['standings']]==[1,2] and not any(r['sharedRank'] for r in body['standings'])
    assert private not in response.text and viewer['id'] not in response.text
print('PASS v2 HTTP precision, audited quality facts, unique final ranks and identifier privacy')
