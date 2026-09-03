create extension if not exists "pgcrypto";

-- ---------- PERFILES (vinculada a auth.users) ----------
create table if not exists public.perfiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nombre         text not null,
  apellido       text not null,
  email          text not null unique,
  rol            text not null default 'usuario' check (rol in ('admin', 'usuario')),
  fecha_registro timestamptz not null default now()
);

-- ---------- RUBROS ----------
create table if not exists public.rubros (
  id     bigint generated always as identity primary key,
  nombre text not null unique
);

-- ---------- MARCAS ----------
create table if not exists public.marcas (
  id     bigint generated always as identity primary key,
  nombre text not null unique
);

-- ---------- PRODUCTOS ----------
create table if not exists public.productos (
  id              bigint generated always as identity primary key,
  nombre          text not null,
  rubro_id        bigint not null references public.rubros(id) on delete restrict,
  marca_id        bigint not null references public.marcas(id) on delete restrict,
  descripcion     text not null default '',
  precio          numeric(12,2) not null check (precio > 0),
  imagen          text default '🧽',
  stock           integer not null default 0 check (stock >= 0),
  fecha_creacion  timestamptz not null default now()
);

create index if not exists idx_productos_rubro on public.productos(rubro_id);
create index if not exists idx_productos_marca on public.productos(marca_id);

-- ---------- VENTAS ----------
create table if not exists public.ventas (
  id           bigint generated always as identity primary key,
  fecha_venta  timestamptz not null default now(),
  usuario_id   uuid references public.perfiles(id) on delete set null,
  total        numeric(12,2) not null default 0
);

create index if not exists idx_ventas_fecha on public.ventas(fecha_venta);
create index if not exists idx_ventas_usuario on public.ventas(usuario_id);

-- ---------- DETALLE_VENTAS ----------
create table if not exists public.detalle_ventas (
  id               bigint generated always as identity primary key,
  venta_id         bigint not null references public.ventas(id) on delete cascade,
  producto_id      bigint not null references public.productos(id) on delete restrict,
  cantidad         integer not null check (cantidad > 0),
  precio_unitario  numeric(12,2) not null check (precio_unitario >= 0),
  subtotal         numeric(12,2) not null default 0
);

create index if not exists idx_detalle_venta on public.detalle_ventas(venta_id);
create index if not exists idx_detalle_producto on public.detalle_ventas(producto_id);


-- ============================================================
-- 2. FUNCIONES
-- ============================================================

-- ---------- is_admin(): evita recursión de RLS en "perfiles" ----------
-- SECURITY DEFINER le permite leer perfiles sin pasar por sus propias
-- políticas RLS, por eso NO genera recursión infinita.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- ---------- handle_new_user(): crea el perfil al registrarse ----------
-- Se dispara automáticamente cuando Supabase Auth crea un usuario nuevo.
-- El rol SIEMPRE se fuerza a 'usuario': nadie puede registrarse como
-- admin desde el frontend.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, apellido, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    new.email,
    'usuario'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- evitar_autoascenso_admin(): nadie cambia su propio rol ----------
-- Un usuario puede actualizar su propio perfil (nombre/apellido), pero
-- si intenta cambiar "rol" y no es admin, el cambio se ignora.
create or replace function public.evitar_autoascenso_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol is distinct from old.rol and not public.is_admin() then
    new.rol := old.rol;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evitar_autoascenso on public.perfiles;
create trigger trg_evitar_autoascenso
  before update on public.perfiles
  for each row execute function public.evitar_autoascenso_admin();

-- ---------- calcular_subtotal_detalle(): fuerza subtotal correcto ----------
create or replace function public.calcular_subtotal_detalle()
returns trigger
language plpgsql
as $$
begin
  new.subtotal := round(new.cantidad * new.precio_unitario, 2);
  return new;
end;
$$;

drop trigger if exists trg_calcular_subtotal on public.detalle_ventas;
create trigger trg_calcular_subtotal
  before insert or update on public.detalle_ventas
  for each row execute function public.calcular_subtotal_detalle();

-- ---------- actualizar_total_venta(): recalcula ventas.total ----------
-- Se dispara después de cualquier cambio en detalle_ventas y recalcula
-- el total real de la venta sumando los subtotales de sus items.
create or replace function public.actualizar_total_venta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id bigint;
begin
  v_venta_id := coalesce(new.venta_id, old.venta_id);

  update public.ventas
  set total = coalesce((
    select sum(subtotal) from public.detalle_ventas where venta_id = v_venta_id
  ), 0)
  where id = v_venta_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_actualizar_total_venta on public.detalle_ventas;
create trigger trg_actualizar_total_venta
  after insert or update or delete on public.detalle_ventas
  for each row execute function public.actualizar_total_venta();

-- ---------- descontar_stock(): descuenta stock al registrar una venta ----------
create or replace function public.descontar_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.productos
  set stock = greatest(stock - new.cantidad, 0)
  where id = new.producto_id;
  return new;
end;
$$;

drop trigger if exists trg_descontar_stock on public.detalle_ventas;
create trigger trg_descontar_stock
  after insert on public.detalle_ventas
  for each row execute function public.descontar_stock();


-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.perfiles       enable row level security;
alter table public.rubros         enable row level security;
alter table public.marcas         enable row level security;
alter table public.productos      enable row level security;
alter table public.ventas         enable row level security;
alter table public.detalle_ventas enable row level security;

-- ---------- PERFILES ----------
drop policy if exists "perfiles_select_propio_o_admin" on public.perfiles;
create policy "perfiles_select_propio_o_admin"
  on public.perfiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "perfiles_update_propio_o_admin" on public.perfiles;
create policy "perfiles_update_propio_o_admin"
  on public.perfiles for update
  using (id = auth.uid() or public.is_admin());

-- No se define policy de INSERT: los perfiles se crean únicamente
-- mediante el trigger handle_new_user() (SECURITY DEFINER), nunca
-- directamente desde el frontend.

-- ---------- RUBROS ----------
drop policy if exists "rubros_select_publico" on public.rubros;
create policy "rubros_select_publico"
  on public.rubros for select
  using (true);

drop policy if exists "rubros_insert_admin" on public.rubros;
create policy "rubros_insert_admin"
  on public.rubros for insert
  with check (public.is_admin());

drop policy if exists "rubros_update_admin" on public.rubros;
create policy "rubros_update_admin"
  on public.rubros for update
  using (public.is_admin());

drop policy if exists "rubros_delete_admin" on public.rubros;
create policy "rubros_delete_admin"
  on public.rubros for delete
  using (public.is_admin());

-- ---------- MARCAS ----------
drop policy if exists "marcas_select_publico" on public.marcas;
create policy "marcas_select_publico"
  on public.marcas for select
  using (true);

drop policy if exists "marcas_insert_admin" on public.marcas;
create policy "marcas_insert_admin"
  on public.marcas for insert
  with check (public.is_admin());

drop policy if exists "marcas_update_admin" on public.marcas;
create policy "marcas_update_admin"
  on public.marcas for update
  using (public.is_admin());

drop policy if exists "marcas_delete_admin" on public.marcas;
create policy "marcas_delete_admin"
  on public.marcas for delete
  using (public.is_admin());

-- ---------- PRODUCTOS ----------
drop policy if exists "productos_select_publico" on public.productos;
create policy "productos_select_publico"
  on public.productos for select
  using (true);

drop policy if exists "productos_insert_admin" on public.productos;
create policy "productos_insert_admin"
  on public.productos for insert
  with check (public.is_admin());

drop policy if exists "productos_update_admin" on public.productos;
create policy "productos_update_admin"
  on public.productos for update
  using (public.is_admin());

drop policy if exists "productos_delete_admin" on public.productos;
create policy "productos_delete_admin"
  on public.productos for delete
  using (public.is_admin());

-- ---------- VENTAS ----------
drop policy if exists "ventas_select_propia_o_admin" on public.ventas;
create policy "ventas_select_propia_o_admin"
  on public.ventas for select
  using (usuario_id = auth.uid() or public.is_admin());

drop policy if exists "ventas_insert_autenticado" on public.ventas;
create policy "ventas_insert_autenticado"
  on public.ventas for insert
  with check (auth.uid() is not null and (usuario_id = auth.uid() or usuario_id is null));

-- ---------- DETALLE_VENTAS ----------
drop policy if exists "detalle_select_propio_o_admin" on public.detalle_ventas;
create policy "detalle_select_propio_o_admin"
  on public.detalle_ventas for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.ventas v
      where v.id = detalle_ventas.venta_id and v.usuario_id = auth.uid()
    )
  );

drop policy if exists "detalle_insert_propio_o_admin" on public.detalle_ventas;
create policy "detalle_insert_propio_o_admin"
  on public.detalle_ventas for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.ventas v
      where v.id = detalle_ventas.venta_id
        and (v.usuario_id = auth.uid() or v.usuario_id is null)
    )
  );


-- ============================================================
-- 4. DATOS INICIALES
-- ============================================================

insert into public.rubros (nombre) values
  ('Lavavajillas'),
  ('Desinfectantes'),
  ('Limpieza de pisos'),
  ('Desengrasantes'),
  ('Higiene personal'),
  ('Accesorios de limpieza'),
  ('Aromatizantes')
on conflict (nombre) do nothing;

insert into public.marcas (nombre) values
  ('LimpioMax'),
  ('Brillo'),
  ('HogarPlus'),
  ('EcoClean'),
  ('Sanit')
on conflict (nombre) do nothing;

-- Productos de ejemplo (migrados desde js/data.js).
-- Se resuelven rubro_id / marca_id por nombre para no depender de ids fijos.
insert into public.productos (nombre, rubro_id, marca_id, descripcion, precio, imagen, stock)
select v.nombre, r.id, m.id, v.descripcion, v.precio, v.imagen, v.stock
from (values
  ('Detergente Ultra Concentrado', 'Lavavajillas', 'LimpioMax', 'Detergente para lavavajillas con acción desengrasante rápida. Rinde hasta 300 platos por botella y cuida tus manos.', 3500, '🧴', 40),
  ('Lavandina Concentrada 1L', 'Desinfectantes', 'Brillo', 'Desinfectante de alto poder bactericida. Ideal para superficies, baños y cocinas.', 2900, '🧪', 35),
  ('Limpiador de Pisos Lavanda', 'Limpieza de pisos', 'HogarPlus', 'Limpia y perfuma pisos de cerámica, porcelanato y madera. Fragancia duradera.', 4200, '🧹', 30),
  ('Desengrasante Industrial 5L', 'Desengrasantes', 'LimpioMax', 'Fórmula de alto rendimiento para cocinas industriales, campanas y hornos.', 5800, '🛢️', 20),
  ('Jabón Líquido para Manos', 'Higiene personal', 'Sanit', 'Jabón antibacterial de uso frecuente, pH neutro, apto para dispensadores.', 2100, '🧼', 50),
  ('Guantes de Látex x10', 'Accesorios de limpieza', 'HogarPlus', 'Guantes resistentes para tareas de limpieza doméstica y comercial. Talle único.', 1800, '🧤', 60),
  ('Limpiador Multiuso EcoClean', 'Limpieza de pisos', 'EcoClean', 'Limpiador biodegradable apto para todo tipo de superficies. Bajo impacto ambiental.', 3300, '♻️', 45),
  ('Desinfectante en Aerosol', 'Desinfectantes', 'Sanit', 'Elimina el 99,9% de gérmenes y bacterias en superficies y ambientes.', 3100, '💨', 38),
  ('Trapo de Piso Microfibra', 'Accesorios de limpieza', 'HogarPlus', 'Alta absorción, no deja pelusa, apto para todo tipo de pisos.', 2500, '🪣', 55),
  ('Desengrasante para Hornos', 'Desengrasantes', 'Brillo', 'Remueve grasa quemada y residuos difíciles en minutos.', 4600, '🔥', 25),
  ('Aromatizante de Ambientes', 'Aromatizantes', 'EcoClean', 'Fragancia de larga duración para hogares, oficinas y locales comerciales.', 2700, '🌸', 42),
  ('Detergente para Ropa 3L', 'Lavavajillas', 'LimpioMax', 'Detergente líquido concentrado, cuida las fibras y mantiene los colores.', 6200, '👕', 18),
  ('Alcohol en Gel 500ml', 'Higiene personal', 'Sanit', 'Higienizante de manos de uso frecuente, no reseca la piel.', 1900, '🧴', 70),
  ('Escoba y Pala Combo', 'Accesorios de limpieza', 'HogarPlus', 'Set de escoba y pala de plástico reforzado, mango ergonómico.', 3900, '🧹', 22)
) as v(nombre, rubro_nombre, marca_nombre, descripcion, precio, imagen, stock)
join public.rubros r on r.nombre = v.rubro_nombre
join public.marcas m on m.nombre = v.marca_nombre
where not exists (select 1 from public.productos p where p.nombre = v.nombre);


-- ============================================================
-- 5. (OPCIONAL) VENTAS DE EJEMPLO PARA PROBAR EL DASHBOARD
-- ------------------------------------------------------------
-- Este bloque es opcional. Generá algunas ventas de este mes y
-- del mes anterior para que el gráfico de "Ventas mensuales" y
-- el % de variación tengan datos para mostrar apenas entrás al
-- panel. Podés borrarlo o comentarlo si preferís arrancar en cero.
-- ============================================================

do $$
declare
  v_venta_id bigint;
  v_producto_id bigint;
begin
  -- Venta de ejemplo: mes actual
  insert into public.ventas (fecha_venta, usuario_id, total)
  values (now() - interval '2 days', null, 0)
  returning id into v_venta_id;

  select id into v_producto_id from public.productos where nombre = 'Detergente Ultra Concentrado' limit 1;
  if v_producto_id is not null then
    insert into public.detalle_ventas (venta_id, producto_id, cantidad, precio_unitario)
    values (v_venta_id, v_producto_id, 3, 3500);
  end if;

  select id into v_producto_id from public.productos where nombre = 'Lavandina Concentrada 1L' limit 1;
  if v_producto_id is not null then
    insert into public.detalle_ventas (venta_id, producto_id, cantidad, precio_unitario)
    values (v_venta_id, v_producto_id, 5, 2900);
  end if;

  -- Venta de ejemplo: mes anterior
  insert into public.ventas (fecha_venta, usuario_id, total)
  values (date_trunc('month', now()) - interval '5 days', null, 0)
  returning id into v_venta_id;

  select id into v_producto_id from public.productos where nombre = 'Desengrasante Industrial 5L' limit 1;
  if v_producto_id is not null then
    insert into public.detalle_ventas (venta_id, producto_id, cantidad, precio_unitario)
    values (v_venta_id, v_producto_id, 2, 5800);
  end if;
end $$;

/* ============================================================
   FIN DEL SCRIPT
   ------------------------------------------------------------
   Después de ejecutarlo:
   1) Creá el usuario administrador desde
      Authentication → Users → Add user (ver instrucciones).
   2) Ejecutá el UPDATE que asigna rol = 'admin' a su perfil
      (también está en las instrucciones finales).
   ============================================================ */
