-- PRAZION AI database schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_updated_idx on public.conversations(user_id, updated_at desc);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  default_provider text not null default 'openai' check (default_provider in ('openai','anthropic')),
  default_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.user_settings enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "conversations_select_own" on public.conversations for select to authenticated using (auth.uid() = user_id);
create policy "conversations_insert_own" on public.conversations for insert to authenticated with check (auth.uid() = user_id);
create policy "conversations_update_own" on public.conversations for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "conversations_delete_own" on public.conversations for delete to authenticated using (auth.uid() = user_id);

create policy "messages_select_own" on public.messages for select to authenticated using (auth.uid() = user_id);
create policy "messages_insert_own" on public.messages for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
);
create policy "messages_update_own" on public.messages for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "messages_delete_own" on public.messages for delete to authenticated using (auth.uid() = user_id);

create policy "attachments_select_own" on public.attachments for select to authenticated using (auth.uid() = user_id);
create policy "attachments_insert_own" on public.attachments for insert to authenticated with check (auth.uid() = user_id);
create policy "attachments_update_own" on public.attachments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "attachments_delete_own" on public.attachments for delete to authenticated using (auth.uid() = user_id);

create policy "settings_select_own" on public.user_settings for select to authenticated using (auth.uid() = user_id);
create policy "settings_insert_own" on public.user_settings for insert to authenticated with check (auth.uid() = user_id);
create policy "settings_update_own" on public.user_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Create the private bucket in Storage UI: prazion-attachments, public=false.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prazion-attachments', 'prazion-attachments', false, 10485760,
  array['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false;

create policy "storage_read_own_files" on storage.objects for select to authenticated using (
  bucket_id = 'prazion-attachments' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "storage_upload_own_files" on storage.objects for insert to authenticated with check (
  bucket_id = 'prazion-attachments' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "storage_delete_own_files" on storage.objects for delete to authenticated using (
  bucket_id = 'prazion-attachments' and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
          new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of raw_user_meta_data on auth.users
for each row execute procedure public.handle_new_user();
