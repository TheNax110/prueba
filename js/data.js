/* ============================================================
   data.js
   ------------------------------------------------------------
   Capa de acceso a datos (DAO) de LIMPIARTE.
   ------------------------------------------------------------
   Antes: simulaba una base de datos con localStorage/sessionStorage.
   Ahora: se conecta a una base de datos real en Supabase (PostgreSQL)
   usando el cliente inicializado en js/supabase.js.

   Se mantienen los mismos nombres de función que usaba el resto
   del sitio (LimpiarteDB.getProductos(), etc.) para no tener que
   reescribir productos.js / admin.js / auth.js desde cero. La
   diferencia es que TODAS las funciones ahora son asíncronas:
   hay que llamarlas con `await`.
   ============================================================ */

const LimpiarteDB = (() => {

  function formatearPrecio(valor) {
    return Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
  }

  /* Traduce errores comunes de Supabase a mensajes entendibles
     para mostrar en la interfaz. */
  function mensajeError(error, contexto = '') {
    console.error(contexto, error);
    if (!error) return 'Ocurrió un error inesperado.';
    if (error.code === '23505') return 'Ya existe un registro con ese nombre.';
    if (error.code === '23503') return 'No se puede completar la acción: hay datos relacionados.';
    if (error.message?.includes('duplicate key')) return 'Ya existe un registro con ese valor.';
    if (error.message?.includes('JWT') || error.message?.includes('session')) return 'Tu sesión expiró. Volvé a iniciar sesión.';
    return error.message || 'Ocurrió un error al comunicarse con el servidor.';
  }

  /* ------------------------- PRODUCTOS ------------------------- */

  async function getProductos() {
    const { data, error } = await supabaseClient
      .from('productos')
      .select('*')
      .order('id', { ascending: true });
    if (error) { console.error('getProductos', error); return []; }
    return data;
  }

  async function getProductoPorId(id) {
    const { data, error } = await supabaseClient
      .from('productos')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();
    if (error) { console.error('getProductoPorId', error); return null; }
    return data;
  }

  async function crearProducto(datos) {
    const { data, error } = await supabaseClient
      .from('productos')
      .insert([datos])
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'crearProducto') };
    return { ok: true, data };
  }

  async function actualizarProducto(id, datos) {
    const { data, error } = await supabaseClient
      .from('productos')
      .update(datos)
      .eq('id', Number(id))
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'actualizarProducto') };
    return { ok: true, data };
  }

  async function eliminarProducto(id) {
    const { error } = await supabaseClient
      .from('productos')
      .delete()
      .eq('id', Number(id));
    if (error) return { ok: false, motivo: mensajeError(error, 'eliminarProducto') };
    return { ok: true };
  }

  /* ------------------------- RUBROS ------------------------- */

  async function getRubros() {
    const { data, error } = await supabaseClient
      .from('rubros')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) { console.error('getRubros', error); return []; }
    return data;
  }

  async function getRubroPorId(id) {
    const { data, error } = await supabaseClient
      .from('rubros')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();
    if (error) { console.error('getRubroPorId', error); return null; }
    return data;
  }

  async function crearRubro(nombre) {
    const { data, error } = await supabaseClient
      .from('rubros')
      .insert([{ nombre }])
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'crearRubro') };
    return { ok: true, data };
  }

  async function actualizarRubro(id, nombre) {
    const { data, error } = await supabaseClient
      .from('rubros')
      .update({ nombre })
      .eq('id', Number(id))
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'actualizarRubro') };
    return { ok: true, data };
  }

  async function eliminarRubro(id) {
    const { count, error: errorCheck } = await supabaseClient
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('rubro_id', Number(id));
    if (errorCheck) return { ok: false, motivo: mensajeError(errorCheck, 'eliminarRubro/check') };
    if (count > 0) return { ok: false, motivo: 'El rubro tiene productos asociados.' };

    const { error } = await supabaseClient.from('rubros').delete().eq('id', Number(id));
    if (error) return { ok: false, motivo: mensajeError(error, 'eliminarRubro') };
    return { ok: true };
  }

  /* ------------------------- MARCAS ------------------------- */

  async function getMarcas() {
    const { data, error } = await supabaseClient
      .from('marcas')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) { console.error('getMarcas', error); return []; }
    return data;
  }

  async function getMarcaPorId(id) {
    const { data, error } = await supabaseClient
      .from('marcas')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();
    if (error) { console.error('getMarcaPorId', error); return null; }
    return data;
  }

  async function crearMarca(nombre) {
    const { data, error } = await supabaseClient
      .from('marcas')
      .insert([{ nombre }])
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'crearMarca') };
    return { ok: true, data };
  }

  async function actualizarMarca(id, nombre) {
    const { data, error } = await supabaseClient
      .from('marcas')
      .update({ nombre })
      .eq('id', Number(id))
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'actualizarMarca') };
    return { ok: true, data };
  }

  async function eliminarMarca(id) {
    const { count, error: errorCheck } = await supabaseClient
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('marca_id', Number(id));
    if (errorCheck) return { ok: false, motivo: mensajeError(errorCheck, 'eliminarMarca/check') };
    if (count > 0) return { ok: false, motivo: 'La marca tiene productos asociados.' };

    const { error } = await supabaseClient.from('marcas').delete().eq('id', Number(id));
    if (error) return { ok: false, motivo: mensajeError(error, 'eliminarMarca') };
    return { ok: true };
  }

  /* ------------------------- USUARIOS / PERFILES ------------------------- */
  // Requiere rol admin (lo aplica RLS en la tabla perfiles).

  async function getUsuarios() {
    const { data, error } = await supabaseClient
      .from('perfiles')
      .select('*')
      .order('fecha_registro', { ascending: false });
    if (error) { console.error('getUsuarios', error); return []; }
    return data;
  }

  async function getUsuarioPorEmail(email) {
    const { data, error } = await supabaseClient
      .from('perfiles')
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    if (error) { console.error('getUsuarioPorEmail', error); return null; }
    return data;
  }

  /* Registro de usuario nuevo vía Supabase Auth.
     El perfil en la tabla "perfiles" se crea SOLO,
     mediante el trigger handle_new_user() (ver SQL). El rol
     siempre queda en 'usuario': no se puede elegir desde acá. */
  async function crearUsuario({ nombre, apellido, email, password }) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { nombre, apellido } }
    });
    if (error) return { ok: false, motivo: mensajeError(error, 'crearUsuario') };
    return { ok: true, data };
  }

  /* ------------------------- SESIÓN (Supabase Auth) ------------------------- */

  /* Inicia sesión con email/contraseña usando Supabase Auth. */
  async function iniciarSesion(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('email not confirmed')) {
        return { ok: false, motivo: 'Tu email todavía no fue confirmado. Revisá tu casilla de correo, o pedile al administrador que confirme tu cuenta desde Supabase (Authentication → Users).' };
      }
      if (msg.includes('invalid login credentials')) {
        return { ok: false, motivo: 'Email o contraseña incorrectos.' };
      }
      return { ok: false, motivo: mensajeError(error, 'iniciarSesion') };
    }

    const perfil = await getPerfilPropio();
    if (!perfil) return { ok: false, motivo: 'No se pudo cargar tu perfil. Intentá nuevamente.' };
    return { ok: true, usuario: perfil };
  }

  /* Devuelve el perfil (nombre, apellido, rol, etc.) del usuario
     actualmente logueado, o null si no hay sesión activa.
     Usamos getSession() (lectura local, sin red) en vez de getUser()
     (que revalida contra el servidor) para que el header y las
     redirecciones reflejen el estado de sesión al instante, sin
     carreras de tiempos justo después de loguearse o navegar. */
  async function getPerfilPropio() {
    const { data: { session }, error: errorSesion } = await supabaseClient.auth.getSession();
    if (errorSesion || !session) return null;

    const { data: perfil, error: errorPerfil } = await supabaseClient
      .from('perfiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (errorPerfil) { console.error('getPerfilPropio', errorPerfil); return null; }
    return perfil;
  }

  /* Reemplaza a la vieja getSesion() síncrona: ahora es async
     porque tiene que consultar a Supabase. */
  async function getSesion() {
    return getPerfilPropio();
  }

  async function cerrarSesion() {
    await supabaseClient.auth.signOut();
  }

  /* ------------------------- VENTAS / DASHBOARD ------------------------- */

  async function getStockTotal() {
    const { data, error } = await supabaseClient.from('productos').select('stock');
    if (error) { console.error('getStockTotal', error); return 0; }
    return data.reduce((acum, p) => acum + (p.stock || 0), 0);
  }

  /* Cantidad de ventas realizadas desde el lunes de esta semana
     hasta ahora (hora local del navegador). */
  async function getVentasSemana() {
    const hoy = new Date();
    const diaSemana = (hoy.getDay() + 6) % 7; // 0 = lunes
    const lunes = new Date(hoy);
    lunes.setHours(0, 0, 0, 0);
    lunes.setDate(hoy.getDate() - diaSemana);

    const { count, error } = await supabaseClient
      .from('ventas')
      .select('id', { count: 'exact', head: true })
      .gte('fecha_venta', lunes.toISOString());
    if (error) { console.error('getVentasSemana', error); return 0; }
    return count || 0;
  }

  /* Trae fecha_venta y total de TODAS las ventas para poder
     comparar el mes actual contra el mes anterior en el front,
     sin necesidad de una tabla de estadísticas aparte. */
  async function getVentasParaComparativaMensual() {
    const hoy = new Date();
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);

    const { data, error } = await supabaseClient
      .from('ventas')
      .select('fecha_venta, total')
      .gte('fecha_venta', inicioMesAnterior.toISOString())
      .order('fecha_venta', { ascending: true });
    if (error) { console.error('getVentasParaComparativaMensual', error); return []; }
    return data;
  }

  /* ------------------------- API pública ------------------------- */

  return {
    formatearPrecio,
    // productos
    getProductos, getProductoPorId, crearProducto, actualizarProducto, eliminarProducto,
    // rubros
    getRubros, getRubroPorId, crearRubro, actualizarRubro, eliminarRubro,
    // marcas
    getMarcas, getMarcaPorId, crearMarca, actualizarMarca, eliminarMarca,
    // usuarios
    getUsuarios, getUsuarioPorEmail, crearUsuario,
    // sesión
    iniciarSesion, getSesion, cerrarSesion, getPerfilPropio,
    // ventas / dashboard
    getStockTotal, getVentasSemana, getVentasParaComparativaMensual
  };
})();
