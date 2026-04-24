create table if not exists users (
  id bigint primary key auto_increment,
  name varchar(140) not null,
  email varchar(180) not null unique,
  password_hash text not null,
  role enum('administrador', 'supervisor', 'operador', 'publico') not null,
  phone varchar(40),
  is_active boolean not null default true,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp
);

create table if not exists field_routes (
  id bigint primary key auto_increment,
  name varchar(180) not null,
  description text,
  color varchar(20) not null default '#2563eb',
  status enum('draft', 'assigned', 'in_progress', 'completed', 'cancelled') not null default 'draft',
  starts_at timestamp null,
  ends_at timestamp null,
  is_public boolean not null default false,
  created_by bigint,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_field_routes_created_by foreign key (created_by) references users(id)
);

create table if not exists route_points (
  id bigint primary key auto_increment,
  route_id bigint not null,
  latitude decimal(10, 7) not null,
  longitude decimal(10, 7) not null,
  sequence int not null,
  instruction text,
  created_at timestamp not null default current_timestamp,
  unique key uq_route_points_sequence (route_id, sequence),
  constraint fk_route_points_route foreign key (route_id) references field_routes(id) on delete cascade
);

create table if not exists route_assignments (
  id bigint primary key auto_increment,
  route_id bigint not null,
  operator_id bigint not null,
  assigned_by bigint,
  status enum('assigned', 'in_progress', 'completed', 'cancelled') not null default 'assigned',
  progress_percent decimal(5, 2) not null default 0,
  notes text,
  assigned_at timestamp not null default current_timestamp,
  started_at timestamp null,
  completed_at timestamp null,
  key idx_route_assignments_operator (operator_id),
  key idx_route_assignments_route (route_id),
  constraint fk_route_assignments_route foreign key (route_id) references field_routes(id) on delete cascade,
  constraint fk_route_assignments_operator foreign key (operator_id) references users(id),
  constraint fk_route_assignments_assigned_by foreign key (assigned_by) references users(id)
);

create table if not exists operator_locations (
  id bigint primary key auto_increment,
  assignment_id bigint not null,
  operator_id bigint not null,
  route_id bigint not null,
  latitude decimal(10, 7) not null,
  longitude decimal(10, 7) not null,
  accuracy decimal(10, 2),
  speed decimal(10, 2),
  heading decimal(10, 2),
  battery_level decimal(5, 2),
  recorded_at timestamp not null default current_timestamp,
  key idx_operator_locations_route_time (route_id, recorded_at),
  key idx_operator_locations_assignment_time (assignment_id, recorded_at),
  constraint fk_operator_locations_assignment foreign key (assignment_id) references route_assignments(id) on delete cascade,
  constraint fk_operator_locations_operator foreign key (operator_id) references users(id),
  constraint fk_operator_locations_route foreign key (route_id) references field_routes(id) on delete cascade
);

create table if not exists route_events (
  id bigint primary key auto_increment,
  assignment_id bigint,
  route_id bigint,
  operator_id bigint,
  event_type varchar(60) not null,
  notes text,
  latitude decimal(10, 7),
  longitude decimal(10, 7),
  created_at timestamp not null default current_timestamp,
  constraint fk_route_events_assignment foreign key (assignment_id) references route_assignments(id) on delete cascade,
  constraint fk_route_events_route foreign key (route_id) references field_routes(id) on delete cascade,
  constraint fk_route_events_operator foreign key (operator_id) references users(id)
);
