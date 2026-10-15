#!/usr/bin/env node
'use strict';
// Run against disposable PostgreSQL/WASM, never a configured database URL:
// PROPLET_PGLITE_PATH=/path/to/node_modules/@electric-sql/pglite node <this file>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {PGlite} = require(process.env.PROPLET_PGLITE_PATH || '@electric-sql/pglite');
const ROOT = path.resolve(__dirname, '../..');
const PLAYER = '00000000-0000-4000-8000-000000000001';

async function main() {
  const db = new PGlite();
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'result_timing_schema.sql'), 'utf8');
    const triggerStart = schema.indexOf('create trigger ');
    await db.exec(schema.slice(0, triggerStart));
    await assert.rejects(db.query("select public.proplet_submit_offline_result_v1('{}'::jsonb)"), /does not exist/);
    assert.equal((await db.query('select count(*)::int as n from public.results')).rows[0].n,0,'API-before-migration cannot commit an offline result');
    await db.exec(fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261015070626_offline_result_timing.sql'), 'utf8'));
    await db.exec(schema.slice(triggerStart));
    for (const routine of ['proplet_submit_offline_result_v1','proplet_submit_offline_daily_special_v1']) {
      for (const invalid of [null,{}, {timingUnverified:false}, {timingUnverified:'true'}]) {
        await assert.rejects(db.query(`select public.${routine}($1::jsonb)`,[JSON.stringify(invalid)]),/RESULT_COMMAND_INVALID/);
      }
      const acl=(await db.query("select has_function_privilege('anon',$1,'execute') as anon,has_function_privilege('authenticated',$1,'execute') as authenticated,has_function_privilege('service_role',$1,'execute') as service",['public.'+routine+'(jsonb)'])).rows[0];
      assert.deepEqual(acl,{anon:false,authenticated:false,service:true});
    }
    await db.exec("insert into public.fair_play_policy(enabled,daily_from) values(true,'2026-10-01'); insert into public.daily_specials_policy(enabled) values(true);");
    const today = (await db.query("select (clock_timestamp() at time zone 'Europe/Prague')::date::text as today")).rows[0].today;
    const stamp = (await db.query('select clock_timestamp()::text as stamp')).rows[0].stamp;
    let sequence = 0;
    const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
    function command(overrides = {}) {
      const attempt = `offline-test-${++sequence}`;
      const value = {contractVersion:1, playerId:PLAYER, idempotencyKey:`attempt:${attempt}`, requestDigest:'a'.repeat(64), puzzleId:`puzzle-${sequence}`, challengeKey:`free:puzzle-${sequence}`, mode:'free', difficulty:'easy', dailyDate:null, completedAt:stamp, elapsedMs:42000, moves:12, hintsUsed:0, wrongAttempts:0, maxHintLevel:0, cleanSolve:true, calmMode:false, attemptId:attempt, points:15, contentGeneration:4, freeLevel:sequence, legacyRewardSlot:null, teamCodeAtCompletion:null, ...overrides};
      value.requestDigest = hash(value);
      value.commandDigest = hash(value);
      return value;
    }
    async function submit(value) {
      const routine = value.mode === 'daily_special' ? 'proplet_submit_daily_special_v1' : 'proplet_submit_result_v1';
      if(value.timingUnverified===true){
        const offlineRoutine=value.mode==='daily_special'?'proplet_submit_offline_daily_special_v1':'proplet_submit_offline_result_v1';
        return (await db.query(`select public.${offlineRoutine}($1::jsonb) as receipt`,[JSON.stringify(value)])).rows[0].receipt;
      }
      return (await db.query(`select public.${routine}($1,$2,$3,$4,$5::jsonb) as receipt`, [PLAYER,value.idempotencyKey,value.requestDigest,value.commandDigest,JSON.stringify(value)])).rows[0].receipt;
    }
    async function official(value) {
      return (await db.query('select * from public.results where player_id=$1 and challenge_key=$2',[PLAYER,value.challengeKey])).rows[0];
    }
    async function session(value, verified=true) {
      await db.query("insert into public.play_sessions(actor_key,player_id,challenge_key,puzzle_id,mode,attempt_id,owner_id,verified,finished,active,last_seen,created_at,elapsed_ms,progress) values($1,$2,$3,$4,$5,$6,$7,$8,true,false,clock_timestamp(),clock_timestamp(),42000,'{}'::jsonb)", ['p:'+PLAYER, PLAYER, value.challengeKey, value.puzzleId, value.mode, value.attemptId,'00000000-0000-4000-8000-000000000002',verified]);
    }

    // First-ever offline play has neither a server session nor telemetry. It
    // must still receive exactly the existing reward, once, with lower trust.
    const offline = command({timingUnverified:true});
    const receipt = await submit(offline);
    assert.equal(receipt.firstCompletion,true);
    assert.equal(receipt.awardedPoints,15);
    assert.equal(receipt.attemptStatus,'created_offline');
    assert.equal((await official(offline)).timing_verified,false);
    assert.equal((await official(offline)).calm_mode,false);
    assert.deepEqual(await submit(offline),receipt,'a lost response retries the same committed receipt');
    const rows = (await db.query('select count(*)::int as n,sum(points)::int as xp from public.results')).rows[0];
    assert.deepEqual(rows,{n:1,xp:15});
    const run = (await db.query('select timing_verified from public.puzzle_runs where attempt_id=$1',[offline.attemptId])).rows[0];
    assert.equal(run.timing_verified,false);

    // Omitted trust retains the legacy online classification; the client
    // never gains a new API for writing timing_verified=true.
    const legacy = command();
    await submit(legacy);
    assert.equal((await official(legacy)).timing_verified,null);

    // Delayed older offline completion may replace the official time under
    // existing chronology rules, without paying again or retaining trust.
    const first = command({completedAt:new Date(Date.parse(stamp)+1000).toISOString()});
    await submit(first);
    const earlier = command({puzzleId:first.puzzleId, challengeKey:first.challengeKey, freeLevel:first.freeLevel, completedAt:stamp, timingUnverified:true});
    const earlierReceipt = await submit(earlier);
    assert.equal(earlierReceipt.firstCompletion,false);
    assert.equal(earlierReceipt.awardedPoints,0);
    assert.equal((await official(first)).timing_verified,false);

    // Historical Archive still consumes one existing slot, and an online
    // replay of the same board cannot promote an offline official result.
    const archive = command({puzzleId:'g2-e-001', challengeKey:'free:g2-e-001', contentGeneration:2, freeLevel:1, legacyRewardSlot:{difficulty:'easy',level:1}, timingUnverified:true});
    const archiveReceipt = await submit(archive);
    assert.equal(archiveReceipt.awardedPoints,15);
    assert.equal((await official(archive)).timing_verified,false);
    const archiveReplay = command({...archive, attemptId:'archive-replay', idempotencyKey:'attempt:archive-replay', timingUnverified:false});
    assert.equal((await submit(archiveReplay)).awardedPoints,0);
    assert.equal((await official(archive)).timing_verified,false);
    assert.equal((await db.query('select count(*)::int as n from public.historical_free_slot_rewards')).rows[0].n,1);

    // Server-verified sessions cannot undo an explicit client demotion.
    const daily = command({mode:'daily', dailyDate:today, puzzleId:'daily-board', challengeKey:'daily:'+today, contentGeneration:6, freeLevel:null, points:100, timingUnverified:true});
    await session(daily);
    assert.equal((await submit(daily)).awardedPoints,100);
    assert.equal((await official(daily)).timing_verified,false);
    const onlineDaily = command({mode:'daily', dailyDate:today, puzzleId:'daily-board-2', challengeKey:'daily:'+today+'-test', contentGeneration:6, freeLevel:null, points:100});
    // Daily trigger derives the date from the complete key, so use a separate
    // real day rather than fabricating a suffixed challenge.
    onlineDaily.dailyDate = '2026-10-01'; onlineDaily.challengeKey='daily:2026-10-01';
    await session(onlineDaily);
    await submit(onlineDaily);
    assert.equal((await official(onlineDaily)).timing_verified,true);

    // Extra uses its exact existing finished-session and day rules. The
    // migration only demotes time trust, never loosens those reward gates.
    await db.query("insert into public.daily_special_bindings(challenge_key,daily_date,puzzle_id,difficulty,content_hash,bank_version) values($1,$2,'special-board','hardcore',$3,'test')",['daily-special:'+today+':hardcore',today,'b'.repeat(64)]);
    const special = command({mode:'daily_special',difficulty:'hardcore',dailyDate:today,puzzleId:'special-board',challengeKey:'daily-special:'+today+':hardcore',contentGeneration:6,freeLevel:null,points:100,contentHash:'b'.repeat(64),specialPractice:false,specialPreviewDate:null,timingUnverified:true});
    await assert.rejects(submit(special),/RESULT_COMMAND_INVALID/,'offline Extra cannot bypass the existing session requirement');
    await session(special);
    assert.equal((await submit(special)).awardedPoints,100);
    assert.equal((await official(special)).timing_verified,false);
    const falseRows = (await db.query('select count(*)::int as n from public.puzzle_runs where timing_verified is false')).rows[0].n;
    assert(falseRows>=5);
    console.log('PASS isolated PostgreSQL: offline rewards, atomic replay, Archive slots, sticky trust, verified Daily and unchanged Extra gates');
  } finally { await db.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
