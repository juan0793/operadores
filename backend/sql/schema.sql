create table if not exists users (
  id bigserial primary key,
  name varchar(140) not null,
  email varchar(180) not null unique,
  password_hash text not null,
  role varchar(30) not null check (role in ('administrador', 'supervisor', 'operador', 'publico')),
  phone varchar(40),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists field_routes (
  id bigserial primary key,
  name varchar(180) not null,
  description text,
  color varchar(20) not null default '#2563eb',
  status varchar(30) not null default 'draft'
    check (status in ('draft', 'assigned', 'in_progress', 'completed', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  is_public boolean not null default false,
  created_by bigint references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists route_points (
  id bigserial primary key,
  route_id bigint not null references field_routes(id) on delete cascade,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  sequence integer not null,
  instruction text,
  created_at timestamptz not null default now(),
  unique (route_id, sequence)
);

create table if not exists route_assignments (
  id bigserial primary key,
  route_id bigint not null references field_routes(id) on delete cascade,
  operator_id bigint not null references users(id),
  assigned_by bigint references users(id),
  status varchar(30) not null default 'assigned'
    check (status in ('assigned', 'in_progress', 'completed', 'cancelled')),
  progress_percent numeric(5, 2) not null default 0,
  notes text,
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_route_assignments_operator on route_assignments(operator_id);
create index if not exists idx_route_assignments_route on route_assignments(route_id);

create table if not exists operator_locations (
  id bigserial primary key,
  assignment_id bigint not null references route_assignments(id) on delete cascade,
  operator_id bigint not null references users(id),
  route_id bigint not null references field_routes(id) on delete cascade,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  accuracy numeric(10, 2),
  speed numeric(10, 2),
  heading numeric(10, 2),
  battery_level numeric(5, 2),
  recorded_at timestamptz not null default now()
);

create index if not exists idx_operator_locations_route_time on operator_locations(route_id, recorded_at desc);
create index if not exists idx_operator_locations_assignment_time on operator_locations(assignment_id, recorded_at desc);

create table if not exists route_events (
  id bigserial primary key,
  assignment_id bigint references route_assignments(id) on delete cascade,
  route_id bigint references field_routes(id) on delete cascade,
  operator_id bigint references users(id),
  event_type varchar(60) not null,
  notes text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  created_at timestamptz not null default now()
);
