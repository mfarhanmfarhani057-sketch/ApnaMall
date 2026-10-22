create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null,
  username_key text not null unique,
  full_name text,
  email text,
  mobile text,
  city text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_username_length_chk
    check (char_length(username) between 3 and 20)
);

create unique index if not exists customer_profiles_username_lower_idx
  on public.customer_profiles (lower(username));

create or replace function public.set_customer_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists customer_profiles_set_updated_at on public.customer_profiles;

create trigger customer_profiles_set_updated_at
before update on public.customer_profiles
for each row
execute function public.set_customer_profiles_updated_at();
