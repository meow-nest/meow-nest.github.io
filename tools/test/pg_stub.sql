-- 本機 Postgres 假裝成 Supabase：先跑這個，再跑 supabase/all.sql
-- auth.uid() 讀 set_config('t.uid', '<uuid>', false) 設的值，用來假裝「現在是誰登入」
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;
create schema if not exists realtime;
create schema if not exists cron;
create table if not exists auth.users (id uuid primary key, is_anonymous boolean default true, created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('t.uid', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz default now(), metadata jsonb);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create or replace function realtime.topic() returns text language sql stable as $$ select ''::text $$;
create table if not exists realtime.messages (id bigserial primary key, topic text, extension text, payload jsonb, private boolean);
alter table realtime.messages enable row level security;
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then create publication supabase_realtime; end if;
end $$;
create table if not exists cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create or replace function cron.schedule(a text, b text, c text) returns bigint language sql as $$ select 1::bigint $$;
create or replace function cron.unschedule(a text) returns boolean language sql as $$ select true $$;
-- 注意：all.sql 裡 create extension pg_cron 那幾行在本機會報錯，可以忽略（排程只在 Supabase 上跑）
