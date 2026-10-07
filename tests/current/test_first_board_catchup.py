"""Isolated HTTP contract: no production network or credentials."""
import hashlib
from types import SimpleNamespace
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from backend import first_board, measurement

def test_contract():
    app=FastAPI()
    seen=[]
    @app.middleware("http")
    async def provenance(request,call_next):
        token=measurement.context.set(measurement.request_context(request,"production"))
        try:return await call_next(request)
        finally:measurement.context.reset(token)
    def actor(auth,anon):
        if auth:return {"player_id":"existing-account"}
        if not anon:raise HTTPException(401,"missing")
        return {"anonymous_id":hashlib.sha256(("proplet-anon-v1:"+anon).encode()).hexdigest()}
    def rpc(name,body):
        seen.append((name,body))
        return {"key":"first-board-v1","variant":"control_e001","bucket":3,"identityBucket":53,
                "allocationPolicy":"catchup_20261004","boardId":"g4-e-001","assignmentRecorded":True,
                "firstStepsRunId":body["p_flow"]}
    first_board.install(app,telemetry_actor=actor,db_rpc=rpc,enforce_rate_limit=lambda *a,**k:None,environment="production",app_version="4.05.0")
    client=TestClient(app)
    flow=str(uuid4())
    headers={"X-Proplet-Anon-ID":str(uuid4()),"X-Proplet-First-Steps-Run":flow,
             "X-Proplet-Onboarding":"board-v3-short","X-Proplet-Analytics":"2",
             "X-Proplet-Client-Release":"proplet-v4.05.0-firstboardcatchup1","X-Proplet-Test":"1"}
    r=client.post("/api/first-board/assignment",json={"first_steps_run_id":flow},headers=headers)
    assert r.status_code==200,r.text
    assert seen[-1][0]=="proplet_first_board_assign"
    assert seen[-1][1]["p_is_test"] is True
    assert seen[-1][1]["p_environment"]=="production"
    assert seen[-1][1]["p_flow"]==flow
    assert seen[-1][1]["p_identity_bucket"]==first_board.identity_bucket(headers["X-Proplet-Anon-ID"])
    assert len(seen[-1][1]["p_anonymous_id"])==64
    assert client.post("/api/first-board/assignment",json={"first_steps_run_id":flow},headers={**headers,"Authorization":"Bearer test"}).status_code==409
    assert client.post("/api/first-board/assignment",json={"first_steps_run_id":str(uuid4())},headers=headers).status_code==400
    assert client.post("/api/first-board/assignment",json={"first_steps_run_id":"invalid"},headers=headers).status_code==422
    assert len(seen)==1,"rejected requests cannot allocate"
    enriched=measurement.request_context(SimpleNamespace(headers={k.lower():v for k,v in {
        **headers,"X-Proplet-Experiment":"first-board-v1","X-Proplet-Experiment-Variant":"control_e001",
        "X-Proplet-Experiment-Bucket":"3","X-Proplet-Experiment-Identity-Bucket":"53",
        "X-Proplet-Experiment-Policy":"catchup_20261004"}.items()}),"production")
    assert enriched["_event_context"]["experiment_allocation_policy"]=="catchup_20261004"
    assert enriched["_event_context"]["experiment_identity_bucket"]==53
    assert enriched["is_test"] is True
    rollout_headers={k.lower():v for k,v in {**headers,
        "X-Proplet-Experiment":"first-board-v1",
        "X-Proplet-Experiment-Variant":"challenger_e009",
        "X-Proplet-Experiment-Bucket":"53",
        "X-Proplet-Experiment-Identity-Bucket":"3",
        "X-Proplet-Experiment-Policy":"challenger_rollout_20261007"}.items()}
    rollout=measurement.request_context(SimpleNamespace(headers=rollout_headers),"production")
    assert rollout["_event_context"]["experiment_allocation_policy"]=="challenger_rollout_20261007"
    assert rollout["_event_context"]["experiment_identity_bucket"]==3
    assert rollout["_event_context"]["experiment_bucket"]==53
    assert rollout["is_test"] is True
    print("PASS catch-up API: validated flow, anonymous-only, server environment/test isolation, bounded provenance")

if __name__=="__main__":test_contract()
