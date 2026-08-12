-- READ-ONLY helper for the next content step.
-- Returns one JSON array containing every puzzle ID that has ever been started or completed.
-- Any ID in this array must be frozen before replacing Free puzzle content.
select coalesce(json_agg(puzzle_id order by puzzle_id), '[]'::json) as played_puzzle_ids
from (
  select distinct puzzle_id
  from (
    select puzzle_id from puzzle_attempts where puzzle_id is not null
    union
    select puzzle_id from puzzle_runs where puzzle_id is not null
    union
    select puzzle_id from results where puzzle_id is not null
  ) all_seen
) frozen;
