#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {PGlite} = require(process.env.PROPLET_PGLITE_PATH || '@electric-sql/pglite');
async function main() {
 const db=new PGlite();
 try {
  const schema=fs.readFileSync(path.join(__dirname,'result_timing_schema.sql'),'utf8');
  await db.exec(schema.slice(0,schema.indexOf('create trigger ')));
  // Only the referenced metadata shape is needed for the existing XP SQL.
  await db.exec('create table public.players(id uuid,family_code text,team_joined_at timestamptz); create table public.account_rewards(player_id uuid,points int,reward_key text,granted_at timestamptz); create table public.streak_rescues(player_id uuid,missed_date date,status text);');
  await db.exec(fs.readFileSync(path.join(__dirname,'ranking_functions_reference.sql'),'utf8'));
  const player=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  async function insertRun(n,elapsed,verified,calm=false) {
   await db.query("insert into public.puzzle_runs(id,attempt_id,player_id,puzzle_id,challenge_key,mode,difficulty,elapsed_ms,moves,timing_verified,calm_mode) values(gen_random_uuid(),$1,$2,'free-board','free:free-board','free','easy',$3,12,$4,$5)",[`attempt-${n}`,player(n),elapsed,verified,calm]);
   await db.query("insert into public.results(id,player_id,puzzle_id,challenge_key,mode,difficulty,best_elapsed_ms,best_moves,points,timing_verified,calm_mode) values(gen_random_uuid(),$1,'free-board','free:free-board','free','easy',$2,12,15,$3,$4)",[player(n),elapsed,verified,calm]);
   await db.query("insert into public.players(id,family_code) values($1,'TEST_TEAM')",[player(n)]);
  }
  await insertRun(1,1000,false); // Fast offline time must not win.
  await insertRun(2,20000,true);
  await insertRun(3,10000,null); // Legacy rows retain their existing status.
  await insertRun(4,5000,true,true);
  const ranked=(await db.query("select * from public.proplet_ranking_runs_v1('free','free-board',null)")).rows;
  assert.deepEqual(ranked.map(r=>r.player_id).sort(),[player(2),player(3)]);
  assert(ranked.every(r=>r.elapsed_ms!==1000));
  const totals=(await db.query('select * from public.proplet_rankings_xp_aggregate(null)')).rows;
  const xp=totals.find(row=>row.row_kind==='player'&&row.entity_id===player(1));
  assert.equal(Number(xp.period_xp),15,'offline play still counts toward period XP');
  assert.equal(Number(xp.lifetime_xp),15,'offline play still counts toward lifetime XP');
  assert.equal(Number(totals.find(row=>row.row_kind==='team').period_xp),45,'team XP includes offline play and retains existing calm-mode policy');
  console.log('PASS production ranking SQL excludes offline Free times while personal/team XP still counts');
 } finally {await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
