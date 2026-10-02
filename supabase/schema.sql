-- =====================================================================
--  Rada Tilly · App de servicios al vecino — esquema de Supabase
--  Pegar completo en SQL Editor > New query > Run (proyecto nuevo).
--
--  Roles:
--    vecino   → se registra solo. Se inscribe a actividades, paga cuotas,
--               hace reclamos, saca turnos, administra su grupo familiar.
--    profesor → toma asistencia y ve los inscriptos de SUS actividades.
--    agente   → personal de un área (deportes, cultura, obras, ambiente…).
--               Gestiona actividades, pagos, reclamos y turnos de su área.
--    admin    → todo.
--  La seguridad real está en las políticas RLS de abajo, no en el frontend.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text not null default '',
  dni              text,
  telefono         text,
  direccion        text,
  barrio           text,
  fecha_nacimiento date,
  role             text not null default 'vecino'
                   check (role in ('vecino','profesor','agente','admin')),
  area             text,   -- solo para agentes: deportes, cultura, obras, ambiente…
  activo           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Helpers de permisos (security definer para evitar recursión en RLS)
create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and activo
$$;

create or replace function public.mi_area() returns text
language sql stable security definer set search_path = public as $$
  select area from profiles where id = auth.uid()
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() = 'admin', false)
$$;

create or replace function public.es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() in ('profesor','agente','admin'), false)
$$;

create or replace function public.es_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() in ('agente','admin'), false)
$$;

-- ¿El usuario actual gestiona esta área? (admin: todas; agente: la suya)
create or replace function public.gestiona_area(a text) returns boolean
language sql stable security definer set search_path = public as $$
  select es_admin() or coalesce(mi_rol() = 'agente' and mi_area() = a, false)
$$;

-- Alta automática del perfil al registrarse (datos del formulario de registro)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, dni, telefono, direccion, barrio, fecha_nacimiento)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'dni',
    new.raw_user_meta_data->>'telefono',
    new.raw_user_meta_data->>'direccion',
    new.raw_user_meta_data->>'barrio',
    nullif(new.raw_user_meta_data->>'fecha_nacimiento', '')::date
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un vecino puede editar sus datos, pero no su rol, área ni estado.
-- (Desde el SQL Editor, sin usuario logueado, sí se puede: así se crea el primer admin.)
create or replace function public.proteger_perfil() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    new.role   := old.role;
    new.area   := old.area;
    new.activo := old.activo;
  end if;
  return new;
end $$;

create trigger proteger_perfil before update on public.profiles
  for each row execute function public.proteger_perfil();

alter table public.profiles enable row level security;
create policy "perfil: ver propio o staff" on public.profiles for select
  using (id = auth.uid() or public.es_staff());
create policy "perfil: editar propio o admin" on public.profiles for update
  using (id = auth.uid() or public.es_admin());

-- ---------------------------------------------------------------------
-- Grupo familiar (para inscribir hijos/as, adultos mayores a cargo, etc.)
-- ---------------------------------------------------------------------
create table public.familiares (
  id               uuid primary key default gen_random_uuid(),
  titular_id       uuid not null references public.profiles(id) on delete cascade,
  nombre           text not null,
  dni              text,
  fecha_nacimiento date,
  parentesco       text,
  created_at       timestamptz not null default now()
);
alter table public.familiares enable row level security;
create policy "familiares: el titular gestiona" on public.familiares for all
  using (titular_id = auth.uid()) with check (titular_id = auth.uid());
create policy "familiares: staff ve" on public.familiares for select
  using (public.es_staff());

-- ---------------------------------------------------------------------
-- Sedes (gimnasio, SUM, taller de arte…)
-- ---------------------------------------------------------------------
create table public.sedes (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  direccion text,
  mapa_url  text
);
alter table public.sedes enable row level security;
create policy "sedes: lectura pública" on public.sedes for select using (true);
create policy "sedes: admin escribe" on public.sedes for all
  using (public.es_gestor()) with check (public.es_gestor());

-- ---------------------------------------------------------------------
-- Actividades (deportivas, culturales, adultos mayores, eventos puntuales)
-- ---------------------------------------------------------------------
create table public.actividades (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  descripcion         text,
  area                text not null default 'deportes',
  publico             text,              -- Adultos, Menores, Adultos mayores, Infancias, Todo público
  sede_id             uuid references public.sedes(id) on delete set null,
  docente             text,              -- nombre(s) para mostrar
  profesor_id         uuid references public.profiles(id) on delete set null, -- usuario que toma asistencia
  dias                int[] not null default '{}',   -- 0=Dom … 6=Sáb (igual que JS getDay)
  hora_inicio         time,
  hora_fin            time,
  fecha_evento        date,              -- si tiene fecha, es un evento puntual (ej. trekking)
  edad_min            int,
  edad_max            int,
  cupo                int,               -- null = sin límite
  cuota               numeric(12,2) not null default 0,  -- 0 = gratuita
  modalidad_pago      text not null default 'mensual' check (modalidad_pago in ('mensual','unica')),
  requiere_aprobacion boolean not null default false,
  inscripcion_abierta boolean not null default true,
  activa              boolean not null default true,
  created_at          timestamptz not null default now()
);

create or replace function public.es_profesor_de(act uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from actividades where id = act and profesor_id = auth.uid())
$$;

-- Gestiona la actividad: admin o agente del área
create or replace function public.gestiona_actividad(act uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select gestiona_area(area) from actividades where id = act), false)
$$;

-- Staff de la actividad: quien la gestiona o su profesor
create or replace function public.staff_de_actividad(act uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select gestiona_actividad(act) or es_profesor_de(act)
$$;

alter table public.actividades enable row level security;
create policy "actividades: lectura pública" on public.actividades for select using (true);
create policy "actividades: gestores del área crean" on public.actividades for insert
  with check (public.gestiona_area(area));
create policy "actividades: gestores del área editan" on public.actividades for update
  using (public.gestiona_area(area)) with check (public.gestiona_area(area));
create policy "actividades: gestores del área borran" on public.actividades for delete
  using (public.gestiona_area(area));

-- ---------------------------------------------------------------------
-- Inscripciones
-- ---------------------------------------------------------------------
create table public.inscripciones (
  id           uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.actividades(id) on delete cascade,
  titular_id   uuid not null references public.profiles(id) on delete cascade,
  familiar_id  uuid references public.familiares(id) on delete cascade, -- null = el titular mismo
  estado       text not null default 'activa'
               check (estado in ('pendiente','espera','activa','baja','rechazada')),
  created_at   timestamptz not null default now()
);
-- Una inscripción vigente por persona y actividad (se puede volver a inscribir tras una baja)
create unique index inscripciones_vigente_unica on public.inscripciones
  (actividad_id, titular_id, coalesce(familiar_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where estado not in ('baja','rechazada');

-- Estado inicial: cupo lleno → lista de espera; requiere aprobación → pendiente.
create or replace function public.inscripcion_alta() returns trigger
language plpgsql security definer set search_path = public as $$
declare a actividades; ocupados int;
begin
  select * into a from actividades where id = new.actividad_id;
  if a.id is null then raise exception 'La actividad no existe.'; end if;
  if staff_de_actividad(a.id) then return new; end if;   -- el staff inscribe directo

  if not a.activa or not a.inscripcion_abierta then
    raise exception 'La inscripción a esta actividad está cerrada.';
  end if;
  if new.familiar_id is not null and not exists (
       select 1 from familiares where id = new.familiar_id and titular_id = new.titular_id) then
    raise exception 'La persona elegida no pertenece a tu grupo familiar.';
  end if;

  select count(*) into ocupados from inscripciones
   where actividad_id = a.id and estado = 'activa';
  if a.cupo is not null and ocupados >= a.cupo then new.estado := 'espera';
  elsif a.requiere_aprobacion then new.estado := 'pendiente';
  else new.estado := 'activa';
  end if;
  return new;
end $$;
create trigger inscripcion_alta before insert on public.inscripciones
  for each row execute function public.inscripcion_alta();

-- El vecino solo puede darse de baja (no cambiar otra cosa)
create or replace function public.inscripcion_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not staff_de_actividad(old.actividad_id) then
    new.actividad_id := old.actividad_id;
    new.titular_id   := old.titular_id;
    new.familiar_id  := old.familiar_id;
    new.estado       := 'baja';
  end if;
  return new;
end $$;
create trigger inscripcion_cambio before update on public.inscripciones
  for each row execute function public.inscripcion_cambio();

alter table public.inscripciones enable row level security;
create policy "inscripciones: ver propias o staff" on public.inscripciones for select
  using (titular_id = auth.uid() or public.staff_de_actividad(actividad_id));
create policy "inscripciones: alta propia o staff" on public.inscripciones for insert
  with check (titular_id = auth.uid() or public.staff_de_actividad(actividad_id));
create policy "inscripciones: baja propia o staff" on public.inscripciones for update
  using (titular_id = auth.uid() or public.staff_de_actividad(actividad_id));
create policy "inscripciones: gestores borran" on public.inscripciones for delete
  using (public.gestiona_actividad(actividad_id));

-- Lugares ocupados por actividad (para mostrar cupos sin exponer datos personales)
create or replace function public.cupos_ocupados()
returns table (actividad_id uuid, ocupados bigint)
language sql stable security definer set search_path = public as $$
  select actividad_id, count(*) from inscripciones where estado = 'activa' group by actividad_id
$$;
grant execute on function public.cupos_ocupados() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Asistencia
-- ---------------------------------------------------------------------
create table public.asistencias (
  id             uuid primary key default gen_random_uuid(),
  actividad_id   uuid not null references public.actividades(id) on delete cascade,
  inscripcion_id uuid not null references public.inscripciones(id) on delete cascade,
  fecha          date not null,
  presente       boolean not null default true,
  tomado_por     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (inscripcion_id, fecha)
);
alter table public.asistencias enable row level security;
create policy "asistencias: ver propias o staff" on public.asistencias for select
  using (public.staff_de_actividad(actividad_id) or exists (
    select 1 from inscripciones i where i.id = inscripcion_id and i.titular_id = auth.uid()));
create policy "asistencias: staff carga" on public.asistencias for insert
  with check (public.staff_de_actividad(actividad_id));
create policy "asistencias: staff edita" on public.asistencias for update
  using (public.staff_de_actividad(actividad_id));
create policy "asistencias: staff borra" on public.asistencias for delete
  using (public.staff_de_actividad(actividad_id));

-- ---------------------------------------------------------------------
-- Pagos de cuotas (con comprobante, como en la app de Pakua)
-- ---------------------------------------------------------------------
create table public.pagos (
  id              uuid primary key default gen_random_uuid(),
  titular_id      uuid not null references public.profiles(id) on delete cascade,
  inscripcion_id  uuid not null references public.inscripciones(id) on delete cascade,
  actividad_id    uuid references public.actividades(id) on delete cascade,
  periodo         text not null,   -- 'YYYY-MM'
  monto           numeric(12,2) not null,
  metodo          text not null default 'transferencia',
  comprobante_url text,
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente','aprobado','rechazado')),
  revisado_por    uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create or replace function public.pago_alta() returns trigger
language plpgsql security definer set search_path = public as $$
declare ins inscripciones;
begin
  select * into ins from inscripciones where id = new.inscripcion_id;
  if ins.id is null then raise exception 'Inscripción inexistente.'; end if;
  new.actividad_id := ins.actividad_id;
  new.titular_id   := ins.titular_id;
  if not gestiona_actividad(ins.actividad_id) then
    if ins.titular_id <> auth.uid() then raise exception 'No podés registrar pagos de otra persona.'; end if;
    new.estado := 'pendiente';
    new.revisado_por := null;
  end if;
  return new;
end $$;
create trigger pago_alta before insert on public.pagos
  for each row execute function public.pago_alta();

alter table public.pagos enable row level security;
create policy "pagos: ver propios o gestores" on public.pagos for select
  using (titular_id = auth.uid() or public.gestiona_actividad(actividad_id));
create policy "pagos: alta propia o gestores" on public.pagos for insert
  with check (titular_id = auth.uid() or public.gestiona_actividad(actividad_id));
create policy "pagos: gestores revisan" on public.pagos for update
  using (public.gestiona_actividad(actividad_id));
create policy "pagos: gestores borran" on public.pagos for delete
  using (public.gestiona_actividad(actividad_id));

-- ---------------------------------------------------------------------
-- Reclamos y pedidos (alumbrado, baches, poda, residuos…)
-- ---------------------------------------------------------------------
create table public.reclamo_categorias (
  id     text primary key,
  nombre text not null,
  area   text not null,
  orden  int not null default 0
);
alter table public.reclamo_categorias enable row level security;
create policy "categorías: lectura pública" on public.reclamo_categorias for select using (true);
create policy "categorías: admin escribe" on public.reclamo_categorias for all
  using (public.es_admin()) with check (public.es_admin());

create table public.reclamos (
  id           uuid primary key default gen_random_uuid(),
  numero       bigint generated always as identity unique,
  vecino_id    uuid not null references public.profiles(id) on delete cascade,
  categoria_id text not null references public.reclamo_categorias(id),
  area         text,
  descripcion  text not null,
  direccion    text not null,
  lat          double precision,
  lng          double precision,
  foto_url     text,
  estado       text not null default 'recibido'
               check (estado in ('recibido','en_curso','resuelto','rechazado')),
  asignado_a   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.reclamo_eventos (
  id         uuid primary key default gen_random_uuid(),
  reclamo_id uuid not null references public.reclamos(id) on delete cascade,
  autor_id   uuid references public.profiles(id) on delete set null,
  estado     text check (estado in ('recibido','en_curso','resuelto','rechazado')),
  comentario text,
  created_at timestamptz not null default now()
);

create or replace function public.reclamo_alta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select area into new.area from reclamo_categorias where id = new.categoria_id;
  if not gestiona_area(new.area) then
    new.vecino_id  := auth.uid();
    new.estado     := 'recibido';
    new.asignado_a := null;
  end if;
  return new;
end $$;
create trigger reclamo_alta before insert on public.reclamos
  for each row execute function public.reclamo_alta();

create or replace function public.reclamo_primer_evento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into reclamo_eventos (reclamo_id, autor_id, estado, comentario)
  values (new.id, new.vecino_id, 'recibido', 'Reclamo recibido.');
  return new;
end $$;
create trigger reclamo_primer_evento after insert on public.reclamos
  for each row execute function public.reclamo_primer_evento();

-- Un evento con estado cambia el estado del reclamo (una sola escritura desde la app)
create or replace function public.reclamo_evento_aplica() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado is not null then
    update reclamos set estado = new.estado, updated_at = now() where id = new.reclamo_id;
  else
    update reclamos set updated_at = now() where id = new.reclamo_id;
  end if;
  return new;
end $$;
create trigger reclamo_evento_aplica after insert on public.reclamo_eventos
  for each row execute function public.reclamo_evento_aplica();

alter table public.reclamos enable row level security;
create policy "reclamos: ver propios o área" on public.reclamos for select
  using (vecino_id = auth.uid() or public.gestiona_area(area));
create policy "reclamos: alta propia" on public.reclamos for insert
  with check (vecino_id = auth.uid() or public.es_gestor());
create policy "reclamos: área gestiona" on public.reclamos for update
  using (public.gestiona_area(area));
create policy "reclamos: admin borra" on public.reclamos for delete
  using (public.es_admin());

alter table public.reclamo_eventos enable row level security;
create policy "eventos: ver si ves el reclamo" on public.reclamo_eventos for select
  using (exists (select 1 from reclamos r where r.id = reclamo_id
                 and (r.vecino_id = auth.uid() or public.gestiona_area(r.area))));
create policy "eventos: vecino comenta, área cambia estado" on public.reclamo_eventos for insert
  with check (
    autor_id = auth.uid() and exists (
      select 1 from reclamos r where r.id = reclamo_id and (
        public.gestiona_area(r.area) or (r.vecino_id = auth.uid() and reclamo_eventos.estado is null))));

-- ---------------------------------------------------------------------
-- Turnos (esterilización de mascotas, atención en Hacienda, etc.)
-- ---------------------------------------------------------------------
create table public.servicios_turno (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  descripcion       text,
  requisitos        text,
  area              text not null,
  sede_id           uuid references public.sedes(id) on delete set null,
  dias              int[] not null default '{1,2,3,4,5}',
  hora_desde        time not null default '08:00',
  hora_hasta        time not null default '13:00',   -- último turno empieza antes de esta hora
  duracion_min      int  not null default 30 check (duracion_min > 0),
  cupo_por_turno    int  not null default 1 check (cupo_por_turno > 0),
  dias_anticipacion int  not null default 30,
  pide_notas        text,   -- ej. "Nombre, especie y edad de la mascota"
  activo            boolean not null default true,
  created_at        timestamptz not null default now()
);
alter table public.servicios_turno enable row level security;
create policy "servicios: lectura pública" on public.servicios_turno for select using (true);
create policy "servicios: área gestiona" on public.servicios_turno for all
  using (public.gestiona_area(area)) with check (public.gestiona_area(area));

create table public.turnos (
  id          uuid primary key default gen_random_uuid(),
  servicio_id uuid not null references public.servicios_turno(id) on delete cascade,
  vecino_id   uuid not null references public.profiles(id) on delete cascade,
  fecha       date not null,
  hora        time not null,
  estado      text not null default 'confirmado'
              check (estado in ('confirmado','cancelado','atendido','ausente')),
  notas       text,
  created_at  timestamptz not null default now()
);

create or replace function public.gestiona_servicio(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select gestiona_area(area) from servicios_turno where id = s), false)
$$;

create or replace function public.turno_alta() returns trigger
language plpgsql security definer set search_path = public as $$
declare s servicios_turno; hoy date; ocupados int;
begin
  select * into s from servicios_turno where id = new.servicio_id;
  if s.id is null then raise exception 'Servicio inexistente.'; end if;
  hoy := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  new.estado := 'confirmado';

  if not gestiona_area(s.area) then
    new.vecino_id := auth.uid();
    if not s.activo then raise exception 'Este servicio no está tomando turnos.'; end if;
    if new.fecha < hoy or new.fecha > hoy + s.dias_anticipacion then
      raise exception 'La fecha elegida está fuera del período habilitado.'; end if;
    if not (extract(dow from new.fecha)::int = any (s.dias)) then
      raise exception 'Ese día no hay atención para este servicio.'; end if;
    if new.hora < s.hora_desde or new.hora >= s.hora_hasta
       or (extract(epoch from (new.hora - s.hora_desde))::int % (s.duracion_min * 60)) <> 0 then
      raise exception 'El horario elegido no es válido.'; end if;
    if exists (select 1 from turnos where servicio_id = s.id and vecino_id = new.vecino_id
               and estado = 'confirmado' and fecha >= hoy) then
      raise exception 'Ya tenés un turno confirmado para este servicio.'; end if;
  end if;

  -- bloqueo para que dos personas no tomen el último lugar a la vez
  perform pg_advisory_xact_lock(hashtext(new.servicio_id::text || new.fecha::text || new.hora::text));
  select count(*) into ocupados from turnos
   where servicio_id = s.id and fecha = new.fecha and hora = new.hora and estado = 'confirmado';
  if ocupados >= s.cupo_por_turno then raise exception 'Ese horario se acaba de ocupar. Elegí otro.'; end if;
  return new;
end $$;
create trigger turno_alta before insert on public.turnos
  for each row execute function public.turno_alta();

-- El vecino solo puede cancelar su turno
create or replace function public.turno_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not gestiona_servicio(old.servicio_id) then
    new := old;
    if old.estado = 'confirmado' then new.estado := 'cancelado'; end if;
  end if;
  return new;
end $$;
create trigger turno_cambio before update on public.turnos
  for each row execute function public.turno_cambio();

alter table public.turnos enable row level security;
create policy "turnos: ver propios o área" on public.turnos for select
  using (vecino_id = auth.uid() or public.gestiona_servicio(servicio_id));
create policy "turnos: alta propia o área" on public.turnos for insert
  with check (vecino_id = auth.uid() or public.gestiona_servicio(servicio_id));
create policy "turnos: cancelar propio o área" on public.turnos for update
  using (vecino_id = auth.uid() or public.gestiona_servicio(servicio_id));
create policy "turnos: área borra" on public.turnos for delete
  using (public.gestiona_servicio(servicio_id));

-- Horarios ocupados de un servicio (sin exponer quién los tomó)
create or replace function public.turnos_ocupados(p_servicio uuid, p_desde date, p_hasta date)
returns table (fecha date, hora time, cantidad bigint)
language sql stable security definer set search_path = public as $$
  select fecha, hora, count(*) from turnos
   where servicio_id = p_servicio and estado = 'confirmado' and fecha between p_desde and p_hasta
   group by fecha, hora
$$;
grant execute on function public.turnos_ocupados(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------
-- Avisos a la comunidad (cortes de agua, eventos, alertas)
-- ---------------------------------------------------------------------
create table public.avisos (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  cuerpo     text,
  tipo       text not null default 'info' check (tipo in ('info','alerta','evento')),
  enlace     text,
  desde      date not null default current_date,
  hasta      date,
  publicado  boolean not null default true,
  autor_id   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.avisos enable row level security;
create policy "avisos: publicados para todos" on public.avisos for select
  using (publicado or public.es_gestor());
create policy "avisos: gestores publican" on public.avisos for all
  using (public.es_gestor()) with check (public.es_gestor());

-- ---------------------------------------------------------------------
-- Storage: comprobantes de pago y fotos de reclamos (buckets privados)
-- Cada usuario sube dentro de una carpeta con su propio id.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('comprobantes', 'comprobantes', false),
  ('reclamos', 'reclamos', false)
on conflict (id) do nothing;

create policy "archivos: subir en carpeta propia" on storage.objects for insert to authenticated
  with check (bucket_id in ('comprobantes','reclamos')
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "archivos: ver propios o gestores" on storage.objects for select to authenticated
  using (bucket_id in ('comprobantes','reclamos')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.es_gestor()));

-- =====================================================================
-- DATOS INICIALES
-- Actividades, sedes, horarios y docentes tomados de radatilly.gob.ar.
-- ⚠ Los MONTOS DE CUOTA y los servicios de turnos son DE EJEMPLO:
--   revisalos desde el panel de Gestión antes de publicar la app.
-- =====================================================================
insert into public.sedes (nombre, direccion) values
  ('Gimnasio Municipal "Manuel Belgrano"', null),
  ('SUM Jardín N° 407', null),
  ('Salón del Hipódromo', null),
  ('Taller de Arte Municipal', 'Islas Malvinas 1429'),
  ('Municipalidad', 'Fragata 25 de Mayo N° 94'),
  ('Al aire libre', 'Punto de encuentro a confirmar');

insert into public.reclamo_categorias (id, nombre, area, orden) values
  ('alumbrado',       'Alumbrado público',          'obras',      1),
  ('calles',          'Calles, baches y veredas',   'obras',      2),
  ('agua',            'Agua y cloacas',             'obras',      3),
  ('residuos',        'Recolección de residuos',    'ambiente',   4),
  ('poda',            'Poda y arbolado',            'ambiente',   5),
  ('espacios_verdes', 'Plazas y espacios verdes',   'ambiente',   6),
  ('animales',        'Animales sueltos',           'ambiente',   7),
  ('transito',        'Tránsito y señalización',    'seguridad',  8),
  ('ruidos',          'Ruidos molestos',            'seguridad',  9),
  ('otros',           'Otro',                       'gobierno',  10);

-- Deportes (Secretaría de Deporte y Turismo)
insert into public.actividades
  (nombre, descripcion, area, publico, sede_id, docente, dias, hora_inicio, hora_fin, cuota, modalidad_pago)
values
  ('Musculación', 'Sala de musculación con profesores por turno. Menores: lunes a viernes de 8 a 17 h.',
   'deportes', 'Adultos', (select id from sedes where nombre like 'Gimnasio%'),
   'Pablo Marcos, Claudia Jerez, Pablo Gómez Licenik, Juan José Sebastián, Cinthia Cadiz',
   '{1,2,3,4,5}', '08:00', '21:00', 15000, 'mensual'),
  ('Fight Do', 'También de 14 a 15 h.', 'deportes', 'Adultos', (select id from sedes where nombre like 'Gimnasio%'),
   'Claudia Jerez', '{1,3,5}', '09:00', '10:00', 0, 'mensual'),
  ('Handball adultos', null, 'deportes', 'Adultos', (select id from sedes where nombre like 'Gimnasio%'),
   'Pablo Figueredo', '{2,4}', '21:00', '23:00', 0, 'mensual'),
  ('Senderismo', 'Propuesta recreativa para conocer nuestro paisaje por senderos de fácil acceso. Dura unas dos horas.',
   'deportes', 'Todo público', (select id from sedes where nombre = 'Al aire libre'),
   'Ricardo Rodríguez', '{1,3,5}', '15:00', '17:00', 0, 'mensual'),
  ('Yoga integral', null, 'deportes', 'Adultos', (select id from sedes where nombre like 'SUM%'),
   'Carlos Ojeda', '{2,4}', '20:00', '21:00', 8000, 'mensual'),
  ('Yoga terapéutico', null, 'deportes', 'Adultos', (select id from sedes where nombre like 'Salón del Hip%'),
   'Carlos Ojeda', '{2,4}', '15:15', '16:15', 8000, 'mensual'),
  ('GAP', 'Glúteos, abdominales y piernas.', 'deportes', 'Adultos', (select id from sedes where nombre like 'SUM%'),
   'Claudia Jerez', '{2,4}', '19:00', '20:00', 0, 'mensual'),
  ('Zumba', null, 'deportes', 'Adultos', (select id from sedes where nombre like 'SUM%'),
   'Gladys Bordón', '{1,3,5}', '18:00', '19:00', 8000, 'mensual'),
  ('Actividad física adultos mayores · mañana', null, 'deportes', 'Adultos mayores',
   (select id from sedes where nombre like 'Gimnasio%'), 'Claudia Jerez', '{2,4}', '09:00', '10:00', 0, 'mensual'),
  ('Actividad física adultos mayores · noche', null, 'deportes', 'Adultos mayores',
   (select id from sedes where nombre like 'Gimnasio%'), 'Franco Olivera', '{1,3}', '21:00', '22:00', 0, 'mensual');

-- Evento puntual de ejemplo con cupo (ajustá la fecha)
insert into public.actividades
  (nombre, descripcion, area, publico, sede_id, fecha_evento, hora_inicio, hora_fin, cupo, cuota, modalidad_pago)
values
  ('Trekking de la luna llena', 'Caminata nocturna guiada con vista al Golfo San Jorge. Llevá abrigo y linterna.',
   'deportes', 'Todo público', (select id from sedes where nombre = 'Al aire libre'),
   current_date + 21, '19:30', '22:00', 40, 0, 'unica');

-- Cultura (Taller de Arte Municipal — consultas al 445-1401, de 9 a 14 h)
insert into public.actividades
  (nombre, descripcion, area, publico, sede_id, edad_min, edad_max, cuota, modalidad_pago, requiere_aprobacion)
values
  ('Taller de alfarería', 'Trabajo con arcilla en torno alfarero: modelado, esmaltes y engobes.',
   'cultura', 'Adultos y jóvenes', (select id from sedes where nombre = 'Taller de Arte Municipal'), 16, null, 10000, 'mensual', true),
  ('Taller de cerámica', 'Objetos cerámicos por modelado manual, ornamentación y horneado a 1020 °C. Con o sin experiencia.',
   'cultura', 'Adultos y jóvenes', (select id from sedes where nombre = 'Taller de Arte Municipal'), 16, null, 10000, 'mensual', true),
  ('Taller de experimentación textil', 'Costura, bordado y materiales no convencionales como medio de expresión.',
   'cultura', 'Adultos y jóvenes', (select id from sedes where nombre = 'Taller de Arte Municipal'), 16, null, 10000, 'mensual', true),
  ('Taller de vitrofusión', 'Fusing, sagging, casting termomoldeado y Tiffany para vitreaux.',
   'cultura', 'Adultos y jóvenes', (select id from sedes where nombre = 'Taller de Arte Municipal'), 16, null, 10000, 'mensual', true),
  ('Taller de experimentación plástica', 'Técnicas y materiales variados con acompañamiento de especialistas.',
   'cultura', 'Adultos y adolescentes', (select id from sedes where nombre = 'Taller de Arte Municipal'), 13, null, 10000, 'mensual', true),
  ('Clínica de arte', 'Reflexión y producción para artistas que quieren profundizar su metodología de obra.',
   'cultura', 'Artistas', (select id from sedes where nombre = 'Taller de Arte Municipal'), 18, null, 0, 'mensual', true),
  ('Se me van los pies', 'Expresión corporal, juego y danza. Grupos de 5 a 7 y de 8 a 12 años.',
   'cultura', 'Infancias', (select id from sedes where nombre = 'Taller de Arte Municipal'), 5, 12, 0, 'mensual', false),
  ('Taller de expresión para infancias y adolescentes', 'Grupos por edad: 5-7, 8-10, 11-13 y +14 años.',
   'cultura', 'Infancias y adolescentes', (select id from sedes where nombre = 'Taller de Arte Municipal'), 5, 17, 0, 'mensual', false);

-- Servicios con turno (EJEMPLOS: ajustá días, horarios y requisitos reales)
insert into public.servicios_turno
  (nombre, descripcion, requisitos, area, sede_id, dias, hora_desde, hora_hasta, duracion_min, cupo_por_turno, pide_notas)
values
  ('Esterilización de mascotas', 'Castración gratuita de perros y gatos.',
   'Consultá las indicaciones previas al confirmar el turno.', 'ambiente', null,
   '{2,4}', '08:00', '12:00', 30, 2, 'Nombre, especie, sexo y edad aproximada de la mascota'),
  ('Atención en Hacienda', 'Consultas sobre tasas, impuesto inmobiliario, automotor y planes de pago.',
   'Traé tu DNI y, si tenés, la boleta o el número de partida.', 'hacienda',
   (select id from sedes where nombre = 'Municipalidad'),
   '{1,2,3,4,5}', '08:00', '13:00', 15, 2, 'Motivo de la consulta');

insert into public.avisos (titulo, cuerpo, tipo) values
  ('Bienvenido a la app de servicios al vecino',
   'Desde acá podés inscribirte a talleres y actividades, pagar cuotas, hacer reclamos y sacar turnos.', 'info');
