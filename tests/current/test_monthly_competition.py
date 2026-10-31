"""Behavioral read adapter tests; score/concurrency rules use real SQL acceptance."""
from copy import deepcopy
import json
import unittest

from fastapi import HTTPException
from backend import monthly_competition as monthly


class MonthlyAdapterTests(unittest.TestCase):
    def test_invalid_month_never_calls_database(self):
        for month in ('2026-11', '2026-11-02', '2026-13-01', '26-11-01'):
            with self.assertRaises(HTTPException) as caught:
                monthly.state(rpc=lambda *args: self.fail('database called'), player_id=None,
                    month=month, players=lambda ids: [], identity=lambda *args: {})
            self.assertEqual(caught.exception.status_code,400)

    def test_disabled_state_does_not_fetch_profiles(self):
        result = monthly.state(rpc=lambda *args:{'enabled':False,'reason':'rules-pending'},
            player_id=None,month=None,players=lambda ids:self.fail('profiles fetched'),identity=lambda *args:{})
        self.assertEqual(result,{'enabled':False,'reason':'policy-pending'})

    def test_profile_privacy_and_own_rank_beyond_top100(self):
        rows = [{'playerId':str(i),'rank':i+1,'points':2400-i,'validDays':20,'countedDays':20}
                for i in range(102)]
        mine = {**rows[-1],'days':[{'date':'2026-11-01','points':100,'counted':True,'clean':False}]}
        data = {'enabled':True,'month':'2026-11-01','standings':rows,'me':mine,'previousPodium':[rows[0]]}
        calls=[]
        def identity(profile,viewer,scope,used):
            calls.append((profile['id'],viewer,scope))
            return {'name':'Private' if profile['id']!=viewer else 'Mine','avatar':'X','anonymous':profile['id']!=viewer}
        result=monthly.state(rpc=lambda *args:deepcopy(data),player_id='101',month='2026-11-01',
            players=lambda ids:[{'id':pid,'name':'DO NOT LEAK','avatar':'real'} for pid in ids],identity=identity)
        self.assertEqual(len(result['standings']),101)
        self.assertEqual(result['totalPlayers'],102)
        self.assertEqual(result['month'],'2026-11')
        self.assertTrue(result['truncated'])
        self.assertEqual(result['standings'][-1]['rank'],102)
        self.assertTrue(result['standings'][-1]['isMine'])
        self.assertFalse(any('playerId' in row for row in result['standings']+result['previousPodium']))
        self.assertNotIn('playerId',result['me'])
        self.assertEqual(result['standings'][0]['name'],'Private')
        self.assertEqual(result['previousPodium'][0]['name'],'Private')
        self.assertEqual(result['me']['days'],mine['days'])
        self.assertEqual(calls[0],('0','101','monthly:2026-11-01'))

    def test_missing_receipt_shape_is_unavailable(self):
        for value in (None, [], {}, {'enabled':True,'standings':None,'previousPodium':[]}):
            with self.assertRaises(HTTPException) as caught:
                monthly.state(rpc=lambda *args:value,player_id=None,month=None,
                    players=lambda ids:[],identity=lambda *args:{})
            self.assertEqual(caught.exception.status_code,503)

    def test_tied_placement_badge_month_and_no_public_uuid(self):
        private='12345678-1234-4234-8234-123456789012'
        own='abcdefab-1234-4234-8234-123456789012'
        rows=[{'playerId':private,'rank':1,'points':120},{'playerId':own,'rank':1,'points':120}]
        value={'enabled':True,'month':'2026-11-01','standings':rows,'previousPodium':rows,
            'me':{**rows[-1],'days':[]},'badges':[{'month':'2026-11-01','rank':1,'shared':True}]}
        result=monthly.state(rpc=lambda *args:value,player_id=own,month='2026-11-01',
            players=lambda ids:[{'id':pid} for pid in ids],
            identity=lambda *args:{'name':'Anonymní hráč','avatar':'X','anonymous':True})
        self.assertTrue(all(row['sharedRank'] for row in result['standings']+result['previousPodium']))
        self.assertTrue(result['me']['sharedRank'])
        self.assertEqual(result['badges'][0]['month'],'2026-11')
        self.assertNotIn(private,json.dumps(result))
        self.assertNotIn(own,json.dumps(result))

    def test_finalizer_requires_confirmed_result(self):
        self.assertEqual(monthly.finalize(rpc=lambda *args:{'enabled':True,'finalized':0})['finalized'],0)
        with self.assertRaises(HTTPException):
            monthly.finalize(rpc=lambda *args:None)


if __name__=='__main__':
    unittest.main()
