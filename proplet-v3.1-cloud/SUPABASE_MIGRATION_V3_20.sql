-- Proplet v3.20 — UX/account migration
-- Tým je od této verze volitelný. Interní solo účty dál používají family_code
-- kvůli zpětné kompatibilitě; team_joined_at chrání férovost Ligy týmů.

alter table public.players
  add column if not exists team_joined_at timestamptz;

-- Stávající týmoví hráči jsou členy od vzniku profilu. Rozhodujeme podle
-- skutečné tabulky leagues, ne podle názvu/prefixu family_code.
update public.players p
set team_joined_at = p.created_at
where p.team_joined_at is null
  and exists (
    select 1 from public.leagues l
    where upper(l.code) = upper(p.family_code)
  );

create index if not exists idx_players_team_joined_at
  on public.players (family_code, team_joined_at);
