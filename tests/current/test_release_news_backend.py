"""Authenticated API and environment gating; actual receipt race is tested in CI PG."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from fastapi import FastAPI, HTTPException, Response
from backend import release_news
from backend.config import release_news_enabled


class NewsTests(unittest.TestCase):
    def setUp(self):
        self.enabled=True
        self.calls=[]
        self.value=dict(enabled=True,eligible=True,canShowAutomatically=True,displayGranted=False)
        self.auth='account-A'
        app=FastAPI()
        def authenticate(token):
            if token!='Bearer known':raise HTTPException(401,'auth')
            return {'id':self.auth}
        def rpc(name,params):
            self.calls.append((name,params));return self.value
        release_news.install(app,auth_player=authenticate,db_rpc=rpc,
            enforce_rate_limit=lambda *a,**k:None,enabled=lambda:self.enabled)
        self.routes={r.path:r.endpoint for r in app.routes if r.path.startswith('/api/release-news')}

    def call(self,claim=False,token='Bearer known'):
        response=Response()
        value=self.routes['/api/release-news'+('/claim' if claim else '')](None,response,token)
        self.assertEqual(response.headers['Cache-Control'],'no-store')
        return value

    def test_auth_and_disabled_never_call_rpc(self):
        with self.assertRaises(HTTPException):self.call(token=None)
        self.enabled=False
        self.assertEqual(self.call(True),dict(campaignId=release_news.CAMPAIGN_ID,
            enabled=False,eligible=False,canShowAutomatically=False,displayGranted=False))
        self.assertFalse(self.calls)

    def test_status_uses_authenticated_player_and_no_claim(self):
        self.value['player_id']='private';self.value['other_accounts']=['private']
        value=self.call()
        self.assertEqual(set(value),{'campaignId','enabled','eligible','canShowAutomatically'})
        self.assertEqual(self.calls,[('proplet_release_news_v1',{'p_player':'account-A','p_claim':False})])

    def test_claim_once_and_account_binding(self):
        self.value.update(canShowAutomatically=False,displayGranted=True)
        self.assertTrue(self.call(True)['displayGranted'])
        self.value['displayGranted']=False
        self.assertFalse(self.call(True)['displayGranted'])
        self.auth='account-B';self.call(True)
        self.assertEqual(self.calls[-1][1],{'p_player':'account-B','p_claim':True})

    def test_enabled_new_and_seen_are_distinct(self):
        self.value.update(eligible=False,canShowAutomatically=False)
        self.assertTrue(self.call()['enabled']);self.assertFalse(self.call()['eligible'])
        self.value['eligible']=True
        self.assertTrue(self.call()['eligible']);self.assertFalse(self.call()['canShowAutomatically'])

    def test_unavailable_or_inconsistent_response_never_grants(self):
        for value in (None,{},[],{'enabled':True},
                      dict(enabled=False,eligible=True,canShowAutomatically=False,displayGranted=False),
                      dict(enabled=True,eligible=True,canShowAutomatically=True,displayGranted=True)):
            self.value=value
            with self.assertRaises(HTTPException) as caught:self.call(True)
            self.assertEqual(caught.exception.status_code,503)

    def test_explicit_flag_and_exact_isolated_preview(self):
        prod={'VERCEL_ENV':'production','SUPABASE_URL':'https://iopyhluayfszskyqqpuc.supabase.co'}
        with patch.dict(os.environ,prod,clear=True):self.assertFalse(release_news_enabled())
        with patch.dict(os.environ,{**prod,'PROPLET_RELEASE_NEWS_ENABLED':'true'},clear=True):self.assertTrue(release_news_enabled())
        qa={'VERCEL_ENV':'preview','VERCEL_GIT_COMMIT_REF':'codex/monthly-competition-202611',
            'SUPABASE_URL':'https://eanzztstmwlamwfdskbf.supabase.co','PROPLET_MONTHLY_QA_ENABLED':'true',
            'PROPLET_MONTHLY_QA_SECRET':'synthetic-test-secret-32-characters-long','PROPLET_RELEASE_NEWS_ENABLED':'true'}
        with patch.dict(os.environ,qa,clear=True):self.assertTrue(release_news_enabled())
        for key,value in [('SUPABASE_URL',prod['SUPABASE_URL']),('VERCEL_GIT_COMMIT_REF','other'),
                          ('PROPLET_RELEASE_NEWS_ENABLED','false'),('PROPLET_MONTHLY_QA_SECRET',''),('VERCEL_ENV','development')]:
            with patch.dict(os.environ,{**qa,key:value},clear=True):self.assertFalse(release_news_enabled())


if __name__=='__main__':unittest.main()
