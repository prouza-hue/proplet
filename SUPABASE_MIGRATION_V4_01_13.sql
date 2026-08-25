-- Optional private Google profile photo. Public rankings continue to use players.avatar.
alter table public.players
  add column if not exists google_avatar_url text,
  add column if not exists use_google_avatar boolean not null default false;

alter table public.players
  drop constraint if exists players_google_avatar_url_https;

alter table public.players
  add constraint players_google_avatar_url_https
  check (
    google_avatar_url is null
    or (
      char_length(google_avatar_url) <= 2048
      and google_avatar_url ~ '^https://([A-Za-z0-9-]+\.)*googleusercontent\.com/'
    )
  );
