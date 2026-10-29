"""Generate an additive synthetic fixture for the existing isolated admin preview.

This tool never connects to a database. Apply its SQL only through the verified
test-project connection. Passwords remain in gitignored work/, not in this file.
"""
from pathlib import Path
import argparse
import hashlib
import json
import secrets
import uuid

ROOT = Path(__file__).resolve().parents[1]
TEST_PROJECT = "eanzztstmwlamwfdskbf"
OWNER = "e1740794-d196-48da-a59a-2741eadb8e44"


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def password_hash(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=5, maxmem=32*1024*1024, dklen=32)
    return f"scrypt$16384$8$5${salt.hex()}${digest.hex()}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-ref", required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "work/admin-preview-credentials.json")
    parser.add_argument("--sql", action="store_true")
    args = parser.parse_args()
    if args.project_ref != TEST_PROJECT:
        parser.error("Only the explicitly isolated test project is permitted")
    target = args.output.resolve()
    if not target.is_relative_to((ROOT / "work").resolve()):
        parser.error("Private fixture output must remain in gitignored work/")
    if target.exists():
        fixture = json.loads(target.read_text(encoding="utf-8"))
    else:
        fixture = {"projectRef": TEST_PROJECT, "ownerId": OWNER, "ownerName": "Pavel Admin QA",
                   "teamCode": "ADMINQA20261029", "password": secrets.token_urlsafe(20),
                   "targets": [str(uuid.uuid4()) for _ in range(3)]}
        fixture["passwordHash"] = password_hash(fixture["password"])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(fixture, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    if not args.sql:
        print("Private synthetic preview credentials prepared in gitignored work/")
        return
    ids = [OWNER, *fixture["targets"]]
    rows = []
    for i, pid in enumerate(ids):
        name = fixture["ownerName"] if i == 0 else "Klára Admin QA"
        family = fixture["teamCode"] if i in (0, 2) else "SOLO_ADMINQA_" + pid[:8].upper()
        token_hash = hashlib.sha256(secrets.token_bytes(32)).hexdigest()
        joined = "now()" if i in (0, 2) else "null"
        rows.append("("+",".join([quote(pid), quote(name), quote(family), quote(token_hash),
                                  quote(fixture["passwordHash"]), joined, "false"])+")")
    # Refuse to replace any existing account or token. An intentional rerun must
    # inspect its existing fixture instead of silently resetting credentials.
    sql = ["begin;", "select set_config('request.headers','{}',true);",
           "do $$ begin if exists(select 1 from public.players where id="+quote(OWNER)+") then raise exception 'Admin QA owner already exists; fixture is additive only'; end if; end $$;",
           "insert into public.leagues(code,name) values ("+quote(fixture["teamCode"])+",'Admin QA — testovací tým');",
           "insert into public.players(id,name,family_code,token_hash,password_hash,team_joined_at,public_rankings) values " + ",".join(rows)+";",
           "insert into public.admin_accounts(player_id,role,active) values ("+quote(OWNER)+",'owner',true),("+quote(fixture["targets"][2])+",'owner',true);",
           "insert into public.account_rewards(id,player_id,reward_key,points) values " + ",".join(
               "("+quote(uuid.uuid4())+","+quote(pid)+",'account_creation_v1',"+str(points)+")"
               for pid, points in zip(ids, (1000, 2250, 350, 100)))+";",
           "insert into public.support_reports(id,player_id,category,message,status) values " +
               "("+quote(uuid.uuid4())+","+quote(fixture["targets"][0])+",'account','Testovací případ: ověření obnovy přístupu v izolovaném preview.','new'),"+
               "("+quote(uuid.uuid4())+","+quote(fixture["targets"][1])+",'bug','Testovací vyřízený případ pro ověření archivu.','resolved');",
           "commit;", "select 'isolated admin fixture ready' as result;"]
    print("\n".join(sql))


if __name__ == "__main__":
    main()
