#!/usr/bin/env python3
"""Focused regressions for v3.20.1 account-without-team UX."""
from pathlib import Path
import sys
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server  # noqa: E402

PASSWORD='abcdefgh'

def test_solo_account_creation_keeps_legacy_schema():
    inserted=[]
    with (
        patch.object(server,'db_insert',side_effect=lambda table,row: inserted.append((table,row)) or row),
        patch.object(server,'player_stats',return_value={'points':0}),
    ):
        out=server.create_player(server.PlayerCreate(name='Novák',password=PASSWORD))
    row=next(row for table,row in inserted if table=='players')
    assert row['family_code'].startswith(server.SOLO_FAMILY_PREFIX)
    assert out['familyCode'] is None and out['leagueName'] is None
    assert out['hasPassword'] is True


def test_teamless_login_uses_name_and_password():
    player={'id':'p1','name':'Anna','family_code':'SOLO_ABC123','password_hash':server.hash_password(PASSWORD),'avatar':'🙂','support_mode':'none'}
    with (
        patch.object(server,'db_select',return_value=[player]),
        patch.object(server,'new_session',return_value='session'),
        patch.object(server,'player_stats',return_value={'points':42}),
    ):
        out=server.login(server.PlayerLogin(name='anna',password=PASSWORD))
    assert out['id']=='p1' and out['token']=='session'
    assert out['familyCode'] is None


def test_legacy_team_can_disambiguate_login():
    a={'id':'p1','name':'Pavel','family_code':'ALFA','password_hash':server.hash_password('aaaaaaaa')}
    b={'id':'p2','name':'Pavel','family_code':'BETA','password_hash':server.hash_password('bbbbbbbb')}
    def select(table,**filters):
        assert table=='players'
        return [b] if filters.get('family_code')=='BETA' else [a,b]
    with (
        patch.object(server,'db_select',side_effect=select),
        patch.object(server,'new_session',return_value='session'),
        patch.object(server,'player_stats',return_value={}),
        patch.object(server,'league_name_for',return_value='Beta'),
    ):
        out=server.login(server.PlayerLogin(name='Pavel',family_code='BETA',password='bbbbbbbb'))
    assert out['id']=='p2' and out['familyCode']=='BETA'


def test_solo_player_can_join_team_and_join_time_is_recorded():
    pin='1234'; pin_hash=server.hash_password(pin); updates=[]
    def select(table,**filters):
        if table=='leagues': return [{'code':'RODINA','name':'Rodina','pin_hash':pin_hash}]
        if table=='players': return []
        raise AssertionError(table)
    with (
        patch.object(server,'auth_player',return_value={'id':'p1','name':'Eva','family_code':'SOLO_X'}),
        patch.object(server,'db_select',side_effect=select),
        patch.object(server,'db_update',side_effect=lambda table,filters,values: updates.append((table,filters,values)) or []),
        patch.object(server,'league_name_for',return_value='Rodina'),
    ):
        out=server.set_team_membership(server.TeamMembershipSet(mode='join',family_code='RODINA',league_pin=pin),authorization='Bearer x')
    assert out['familyCode']=='RODINA'
    values=updates[0][2]
    assert values['family_code']=='RODINA' and values.get('team_joined_at')




def test_real_team_with_solo_like_name_stays_a_team():
    player={'family_code':'SOLO_FAMILY','team_joined_at':'2026-01-01T00:00:00+00:00'}
    assert server.is_solo_player(player) is False
    assert server.public_family_code(player['family_code'],player['team_joined_at'])=='SOLO_FAMILY'


def test_me_never_exposes_internal_solo_team():
    player={'id':'p1','name':'Eva','family_code':'SOLO_PRIVATE','password_hash':'x','avatar':'🙂','support_mode':'none'}
    with (
        patch.object(server,'auth_player',return_value=player),
        patch.object(server,'player_stats',return_value={'points':7}),
    ):
        out=server.me(authorization='Bearer x')
    assert out['familyCode'] is None and out['leagueName'] is None

def test_stage_specific_product_event_is_accepted():
    inserted=[]
    with (
        patch.object(server,'telemetry_actor',return_value={'player_id':None,'anonymous_id':'anon'}),
        patch.object(server,'db_insert',side_effect=lambda table,row: inserted.append((table,row)) or row),
    ):
        out=server.product_event(server.ProductEventCreate(event_type='account_nudge_3_authenticated'),x_proplet_anon_id='x')
    assert out['ok'] is True and inserted[0][1]['app_version']=='3.20.1'


def test_health_marks_ux_release():
    with patch.object(server,'supabase_ready',return_value=False):
        health=server.health()
    assert health['version']=='3.20.1'
    assert health['accountWithoutTeam'] is True
    assert health['accountNudgeCompletions']==[1,4,10]

if __name__=='__main__':
    test_solo_account_creation_keeps_legacy_schema()
    test_teamless_login_uses_name_and_password()
    test_legacy_team_can_disambiguate_login()
    test_solo_player_can_join_team_and_join_time_is_recorded()
    test_real_team_with_solo_like_name_stays_a_team()
    test_me_never_exposes_internal_solo_team()
    test_stage_specific_product_event_is_accepted()
    test_health_marks_ux_release()
    print('PASS: v3.20.1 server account/team compatibility and analytics')
