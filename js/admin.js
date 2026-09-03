/* ============================================================
   admin.js
   ------------------------------------------------------------
   Lógica exclusiva del panel de administración: dashboard,
   gestión de productos, rubros, marcas y listado de usuarios.
   Protegido por rol (solo accesible para rol === 'admin'),
   validado tanto acá como por las políticas RLS en Supabase.
   ============================================================ */

let productoEnEdicion = null;
let rubroEnEdicion = null;
let marcaEnEdicion = null;

document.addEventListener('DOMContentLoaded', async () => {
  const sesion = await protegerRutaAdmin();
  if (!sesion) return; // ya fue redirigido a login.html

  await actualizarHeader();

  inicializarNavegacionAdmin();
  await renderizarDashboard();
  await renderizarTablaProductos();
  await renderizarTablaRubros();
  await renderizarTablaMarcas();
  await renderizarTablaUsuarios();
  await renderizarTablaConsultas();

  inicializarFormularioProducto();
  inicializarFormularioRubro();
  inicializarFormularioMarca();
});

/* ------------------------- navegación entre secciones ------------------------- */

function inicializarNavegacionAdmin() {
  const links = document.querySelectorAll('[data-seccion]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const destino = link.dataset.seccion;
      document.querySelectorAll('.admin-seccion').forEach(sec => sec.classList.remove('activa'));
      document.getElementById(`seccion-${destino}`).classList.add('activa');
      links.forEach(l => l.classList.remove('activo'));
      link.classList.add('activo');
      document.querySelector('.admin-sidebar')?.classList.remove('abierta');
      if (destino === 'dashboard') renderizarDashboard();
      if (destino === 'consultas') renderizarTablaConsultas();
    });
  });

  const toggleSidebar = document.getElementById('toggleSidebar');
  if (toggleSidebar) {
    toggleSidebar.addEventListener('click', () => {
      document.querySelector('.admin-sidebar').classList.toggle('abierta');
    });
  }
}

/* ------------------------- dashboard ------------------------- */

async function renderizarDashboard() {
  const [productos, rubros, marcas, usuarios, stockTotal] = await Promise.all([
    LimpiarteDB.getProductos(),
    LimpiarteDB.getRubros(),
    LimpiarteDB.getMarcas(),
    LimpiarteDB.getUsuarios(),
    LimpiarteDB.getStockTotal()
  ]);

  document.getElementById('statProductos').textContent = productos.length;
  document.getElementById('statRubros').textContent = rubros.length;
  document.getElementById('statMarcas').textContent = marcas.length;
  document.getElementById('statUsuarios').textContent = usuarios.length;

  const elStockTotal = document.getElementById('statStockTotal');
  if (elStockTotal) elStockTotal.textContent = stockTotal;
}

/* ------------------------- helpers de selects ------------------------- */

async function poblarSelectsFormularioProducto() {
  const selRubro = document.getElementById('inputProductoRubro');
  const selMarca = document.getElementById('inputProductoMarca');
  const [rubros, marcas] = await Promise.all([LimpiarteDB.getRubros(), LimpiarteDB.getMarcas()]);
  selRubro.innerHTML = rubros.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
  selMarca.innerHTML = marcas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
}

/* ------------------------- GESTIÓN DE PRODUCTOS ------------------------- */

async function renderizarTablaProductos() {
  const tbody = document.getElementById('tablaProductos');
  const [productos, rubros, marcas] = await Promise.all([
    LimpiarteDB.getProductos(),
    LimpiarteDB.getRubros(),
    LimpiarteDB.getMarcas()
  ]);

  if (productos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="tabla-vacia">No hay productos cargados.</td></tr>`;
    return;
  }

  tbody.innerHTML = productos.map(p => {
    const rubro = rubros.find(r => r.id === p.rubro_id);
    const marca = marcas.find(m => m.id === p.marca_id);
    const urlImagen = LimpiarteDB.obtenerUrlImagen(p.imagen);
    const celdaImagen = urlImagen
      ? `<span class="celda-imagen"><img src="${urlImagen}" alt="${escaparHTML(p.nombre)}" loading="lazy" onerror="this.parentElement.innerHTML='🧼'"></span>`
      : `<span class="celda-imagen">🧼</span>`;
    return `
      <tr>
        <td>${celdaImagen} ${p.nombre}</td>
        <td>${rubro ? rubro.nombre : '—'}</td>
        <td>${marca ? marca.nombre : '—'}</td>
        <td>${LimpiarteDB.formatearPrecio(p.precio)}</td>
        <td>${p.stock ?? 0}</td>
        <td class="col-acciones">
          <button class="btn-icono" title="Editar" data-editar-producto="${p.id}">✏️</button>
          <button class="btn-icono btn-icono-peligro" title="Eliminar" data-eliminar-producto="${p.id}">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-editar-producto]').forEach(btn => {
    btn.addEventListener('click', () => abrirFormularioProducto(btn.dataset.editarProducto));
  });
  tbody.querySelectorAll('[data-eliminar-producto]').forEach(btn => {
    btn.addEventListener('click', () => confirmarEliminarProducto(btn.dataset.eliminarProducto));
  });
}

function inicializarFormularioProducto() {
  const form = document.getElementById('formProducto');
  const btnNuevo = document.getElementById('btnNuevoProducto');
  const btnCancelar = document.getElementById('btnCancelarProducto');
  const modal = document.getElementById('modalProducto');
  const inputArchivo = document.getElementById('inputProductoArchivoImagen');
  const previewImg = document.getElementById('previewImagenProducto');
  const previewVacio = document.getElementById('previewImagenProductoVacio');

  btnNuevo.addEventListener('click', () => abrirFormularioProducto(null));
  btnCancelar.addEventListener('click', cerrarFormularioProducto);
  modal.addEventListener('click', (e) => { if (e.target.id === 'modalProducto') cerrarFormularioProducto(); });

  // Vista previa: se actualiza apenas el administrador elige un archivo nuevo.
  inputArchivo.addEventListener('change', () => {
    const file = inputArchivo.files[0];
    if (!file) return;

    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const mensaje = document.getElementById('mensajeProducto');
    ocultarMensaje(mensaje);

    if (!tiposPermitidos.includes(file.type)) {
      mostrarMensaje(mensaje, 'Formato no permitido. Usá JPG, PNG o WEBP.');
      inputArchivo.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      mostrarMensaje(mensaje, 'La imagen no puede superar los 5 MB.');
      inputArchivo.value = '';
      return;
    }

    const lector = new FileReader();
    lector.onload = (e) => {
      previewImg.src = e.target.result;
      previewImg.hidden = false;
      previewVacio.hidden = true;
    };
    lector.readAsDataURL(file);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mensaje = document.getElementById('mensajeProducto');
    ocultarMensaje(mensaje);

    const datos = {
      nombre: form.elements.nombre.value.trim(),
      rubro_id: Number(form.elements.rubro_id.value),
      marca_id: Number(form.elements.marca_id.value),
      descripcion: form.elements.descripcion.value.trim(),
      precio: Number(form.elements.precio.value),
      stock: Number(form.elements.stock.value) || 0
    };

    if (!datos.nombre || !datos.descripcion || !datos.precio || datos.precio <= 0) {
      mostrarMensaje(mensaje, 'Completá todos los campos con valores válidos.');
      return;
    }

    const botonSubmit = form.querySelector('button[type="submit"]');
    botonSubmit.disabled = true;

    const archivoSeleccionado = inputArchivo.files[0] || null;
    const imagenActual = form.elements.imagenActual.value || null;

    // Si eligió una imagen nueva, la subimos ANTES de tocar la base de
    // datos, así si la subida falla no tocamos nada más.
    let nuevoPath = null;
    if (archivoSeleccionado) {
      const resultadoSubida = await LimpiarteDB.subirImagenProducto(archivoSeleccionado);
      if (!resultadoSubida.ok) {
        botonSubmit.disabled = false;
        mostrarMensaje(mensaje, resultadoSubida.motivo);
        return;
      }
      nuevoPath = resultadoSubida.path;
      datos.imagen = nuevoPath;
    }

    const resultado = productoEnEdicion
      ? await LimpiarteDB.actualizarProducto(productoEnEdicion, datos)
      : await LimpiarteDB.crearProducto(datos);

    if (!resultado.ok) {
      // La base de datos falló: si ya habíamos subido una imagen nueva,
      // la borramos para no dejar un archivo huérfano en Storage, y el
      // producto conserva su imagen anterior (nunca queda sin imagen).
      if (nuevoPath) await LimpiarteDB.eliminarImagenProducto(nuevoPath);
      botonSubmit.disabled = false;
      mostrarMensaje(mensaje, resultado.motivo);
      return;
    }

    // Todo salió bien: si había una imagen anterior y la reemplazamos,
    // ahora sí la borramos de Storage para no acumular archivos sin uso.
    if (nuevoPath && imagenActual) {
      await LimpiarteDB.eliminarImagenProducto(imagenActual);
    }

    botonSubmit.disabled = false;
    await renderizarTablaProductos();
    await renderizarDashboard();
    cerrarFormularioProducto();
  });
}

async function abrirFormularioProducto(id) {
  await poblarSelectsFormularioProducto();
  const form = document.getElementById('formProducto');
  const titulo = document.getElementById('tituloModalProducto');
  const previewImg = document.getElementById('previewImagenProducto');
  const previewVacio = document.getElementById('previewImagenProductoVacio');

  form.reset();
  document.getElementById('mensajeProducto').hidden = true;
  previewImg.hidden = true;
  previewImg.src = '';
  previewVacio.hidden = false;

  if (id) {
    const producto = await LimpiarteDB.getProductoPorId(id);
    productoEnEdicion = producto.id;
    titulo.textContent = 'Editar producto';
    form.elements.nombre.value = producto.nombre;
    form.elements.rubro_id.value = producto.rubro_id;
    form.elements.marca_id.value = producto.marca_id;
    form.elements.descripcion.value = producto.descripcion;
    form.elements.precio.value = producto.precio;
    if (form.elements.stock) form.elements.stock.value = producto.stock ?? 0;
    form.elements.imagenActual.value = producto.imagen || '';

    const urlImagenActual = LimpiarteDB.obtenerUrlImagen(producto.imagen);
    if (urlImagenActual) {
      previewImg.src = urlImagenActual;
      previewImg.hidden = false;
      previewVacio.hidden = true;
    }
  } else {
    productoEnEdicion = null;
    titulo.textContent = 'Agregar producto';
    form.elements.imagenActual.value = '';
  }

  document.getElementById('modalProducto').hidden = false;
}

function cerrarFormularioProducto() {
  document.getElementById('modalProducto').hidden = true;
  productoEnEdicion = null;
}

function confirmarEliminarProducto(id) {
  abrirConfirmacion(
    `¿Estás seguro de que querés eliminar este producto? Esta acción no se puede deshacer.`,
    async () => {
      const resultado = await LimpiarteDB.eliminarProducto(id);
      if (!resultado.ok) {
        alert(resultado.motivo);
        return;
      }
      await renderizarTablaProductos();
      await renderizarDashboard();
    }
  );
}

/* ------------------------- GESTIÓN DE RUBROS ------------------------- */

async function renderizarTablaRubros() {
  const tbody = document.getElementById('tablaRubros');
  const [rubros, productos] = await Promise.all([LimpiarteDB.getRubros(), LimpiarteDB.getProductos()]);

  tbody.innerHTML = rubros.map(r => {
    const cantidad = productos.filter(p => p.rubro_id === r.id).length;
    return `
      <tr>
        <td>${r.nombre}</td>
        <td>${cantidad} producto${cantidad === 1 ? '' : 's'}</td>
        <td class="col-acciones">
          <button class="btn-icono" title="Editar" data-editar-rubro="${r.id}">✏️</button>
          <button class="btn-icono btn-icono-peligro" title="Eliminar" data-eliminar-rubro="${r.id}">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-editar-rubro]').forEach(btn => {
    btn.addEventListener('click', () => abrirFormularioRubro(btn.dataset.editarRubro));
  });
  tbody.querySelectorAll('[data-eliminar-rubro]').forEach(btn => {
    btn.addEventListener('click', () => eliminarRubroConValidacion(btn.dataset.eliminarRubro));
  });
}

function inicializarFormularioRubro() {
  const form = document.getElementById('formRubro');
  document.getElementById('btnNuevoRubro').addEventListener('click', () => abrirFormularioRubro(null));
  document.getElementById('btnCancelarRubro').addEventListener('click', cerrarFormularioRubro);
  document.getElementById('modalRubro').addEventListener('click', (e) => { if (e.target.id === 'modalRubro') cerrarFormularioRubro(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mensaje = document.getElementById('mensajeRubro');
    ocultarMensaje(mensaje);
    const nombre = form.elements.nombre.value.trim();

    if (!nombre) {
      mostrarMensaje(mensaje, 'Ingresá un nombre para el rubro.');
      return;
    }

    const botonSubmit = form.querySelector('button[type="submit"]');
    botonSubmit.disabled = true;

    const resultado = rubroEnEdicion
      ? await LimpiarteDB.actualizarRubro(rubroEnEdicion, nombre)
      : await LimpiarteDB.crearRubro(nombre);

    botonSubmit.disabled = false;

    if (!resultado.ok) {
      mostrarMensaje(mensaje, resultado.motivo);
      return;
    }

    await renderizarTablaRubros();
    await renderizarDashboard();
    await poblarFiltroRubrosSiExiste();
    cerrarFormularioRubro();
  });
}

async function abrirFormularioRubro(id) {
  const form = document.getElementById('formRubro');
  form.reset();
  document.getElementById('mensajeRubro').hidden = true;

  if (id) {
    const rubro = await LimpiarteDB.getRubroPorId(id);
    rubroEnEdicion = rubro.id;
    document.getElementById('tituloModalRubro').textContent = 'Editar rubro';
    form.elements.nombre.value = rubro.nombre;
  } else {
    rubroEnEdicion = null;
    document.getElementById('tituloModalRubro').textContent = 'Nuevo rubro';
  }
  document.getElementById('modalRubro').hidden = false;
}

function cerrarFormularioRubro() {
  document.getElementById('modalRubro').hidden = true;
  rubroEnEdicion = null;
}

function eliminarRubroConValidacion(id) {
  abrirConfirmacion(
    `¿Estás seguro de que querés eliminar este rubro?`,
    async () => {
      const resultado = await LimpiarteDB.eliminarRubro(id);
      if (!resultado.ok) {
        alert(resultado.motivo + ' Reasigná o eliminá esos productos primero.');
        return;
      }
      await renderizarTablaRubros();
      await renderizarDashboard();
    }
  );
}

async function poblarFiltroRubrosSiExiste() {
  if (document.getElementById('filtroRubro') && typeof poblarFiltroRubros === 'function') {
    // Solo aplica si admin.js se cargó en una página que también tiene el catálogo.
    cacheRubros = await LimpiarteDB.getRubros();
    poblarFiltroRubros();
  }
}

/* ------------------------- GESTIÓN DE MARCAS ------------------------- */

async function renderizarTablaMarcas() {
  const tbody = document.getElementById('tablaMarcas');
  const [marcas, productos] = await Promise.all([LimpiarteDB.getMarcas(), LimpiarteDB.getProductos()]);

  tbody.innerHTML = marcas.map(m => {
    const cantidad = productos.filter(p => p.marca_id === m.id).length;
    return `
      <tr>
        <td>${m.nombre}</td>
        <td>${cantidad} producto${cantidad === 1 ? '' : 's'}</td>
        <td class="col-acciones">
          <button class="btn-icono" title="Editar" data-editar-marca="${m.id}">✏️</button>
          <button class="btn-icono btn-icono-peligro" title="Eliminar" data-eliminar-marca="${m.id}">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-editar-marca]').forEach(btn => {
    btn.addEventListener('click', () => abrirFormularioMarca(btn.dataset.editarMarca));
  });
  tbody.querySelectorAll('[data-eliminar-marca]').forEach(btn => {
    btn.addEventListener('click', () => eliminarMarcaConValidacion(btn.dataset.eliminarMarca));
  });
}

function inicializarFormularioMarca() {
  const form = document.getElementById('formMarca');
  document.getElementById('btnNuevaMarca').addEventListener('click', () => abrirFormularioMarca(null));
  document.getElementById('btnCancelarMarca').addEventListener('click', cerrarFormularioMarca);
  document.getElementById('modalMarca').addEventListener('click', (e) => { if (e.target.id === 'modalMarca') cerrarFormularioMarca(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mensaje = document.getElementById('mensajeMarca');
    ocultarMensaje(mensaje);
    const nombre = form.elements.nombre.value.trim();

    if (!nombre) {
      mostrarMensaje(mensaje, 'Ingresá un nombre para la marca.');
      return;
    }

    const botonSubmit = form.querySelector('button[type="submit"]');
    botonSubmit.disabled = true;

    const resultado = marcaEnEdicion
      ? await LimpiarteDB.actualizarMarca(marcaEnEdicion, nombre)
      : await LimpiarteDB.crearMarca(nombre);

    botonSubmit.disabled = false;

    if (!resultado.ok) {
      mostrarMensaje(mensaje, resultado.motivo);
      return;
    }

    await renderizarTablaMarcas();
    await renderizarDashboard();
    await poblarFiltroMarcasSiExiste();
    cerrarFormularioMarca();
  });
}

async function abrirFormularioMarca(id) {
  const form = document.getElementById('formMarca');
  form.reset();
  document.getElementById('mensajeMarca').hidden = true;

  if (id) {
    const marca = await LimpiarteDB.getMarcaPorId(id);
    marcaEnEdicion = marca.id;
    document.getElementById('tituloModalMarca').textContent = 'Editar marca';
    form.elements.nombre.value = marca.nombre;
  } else {
    marcaEnEdicion = null;
    document.getElementById('tituloModalMarca').textContent = 'Nueva marca';
  }
  document.getElementById('modalMarca').hidden = false;
}

function cerrarFormularioMarca() {
  document.getElementById('modalMarca').hidden = true;
  marcaEnEdicion = null;
}

function eliminarMarcaConValidacion(id) {
  abrirConfirmacion(
    `¿Estás seguro de que querés eliminar esta marca?`,
    async () => {
      const resultado = await LimpiarteDB.eliminarMarca(id);
      if (!resultado.ok) {
        alert(resultado.motivo + ' Reasigná o eliminá esos productos primero.');
        return;
      }
      await renderizarTablaMarcas();
      await renderizarDashboard();
    }
  );
}

async function poblarFiltroMarcasSiExiste() {
  if (document.getElementById('filtroMarca') && typeof poblarFiltroMarcas === 'function') {
    cacheMarcas = await LimpiarteDB.getMarcas();
    poblarFiltroMarcas();
  }
}

/* ------------------------- USUARIOS (solo lectura) ------------------------- */

async function renderizarTablaUsuarios() {
  const tbody = document.getElementById('tablaUsuarios');
  const usuarios = await LimpiarteDB.getUsuarios();

  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td>${u.nombre} ${u.apellido}</td>
      <td>${u.email}</td>
      <td><span class="badge ${u.rol === 'admin' ? 'badge-admin' : 'badge-usuario'}">${u.rol === 'admin' ? 'Administrador' : 'Usuario'}</span></td>
    </tr>
  `).join('');
}

/* ------------------------- CONSULTAS (formulario de contacto) ------------------------- */

async function renderizarTablaConsultas() {
  const tbody = document.getElementById('tablaConsultas');
  const consultas = await LimpiarteDB.getConsultas();

  const pendientes = consultas.filter(c => c.estado === 'pendiente').length;
  const badge = document.getElementById('badgeConsultasPendientes');
  if (badge) {
    badge.textContent = pendientes;
    badge.hidden = pendientes === 0;
  }

  if (consultas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="tabla-vacia">Todavía no llegaron consultas.</td></tr>`;
    return;
  }

  tbody.innerHTML = consultas.map(c => {
    const fecha = new Date(c.fecha_creacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const esVisto = c.estado === 'visto';
    return `
      <tr>
        <td>${fecha}</td>
        <td>${escaparHTML(c.nombre)}</td>
        <td>${escaparHTML(c.email)}</td>
        <td>${escaparHTML(c.asunto)}</td>
        <td class="celda-mensaje-consulta">${escaparHTML(c.mensaje)}</td>
        <td><span class="badge ${esVisto ? 'badge-visto' : 'badge-pendiente'}">${esVisto ? 'Visto' : 'Pendiente'}</span></td>
        <td>
          <button class="btn-toggle-estado" data-toggle-consulta="${c.id}" data-estado-actual="${c.estado}">
            ${esVisto ? 'Marcar pendiente' : 'Marcar como visto'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-toggle-consulta]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggleConsulta;
      const estadoNuevo = btn.dataset.estadoActual === 'visto' ? 'pendiente' : 'visto';
      btn.disabled = true;
      const resultado = await LimpiarteDB.actualizarEstadoConsulta(id, estadoNuevo);
      if (!resultado.ok) {
        alert(resultado.motivo);
        btn.disabled = false;
        return;
      }
      await renderizarTablaConsultas();
    });
  });
}

/* ------------------------- confirmación genérica ------------------------- */

function abrirConfirmacion(texto, alConfirmar) {
  const modal = document.getElementById('modalConfirmacion');
  document.getElementById('textoConfirmacion').textContent = texto;
  modal.hidden = false;

  const btnConfirmar = document.getElementById('btnConfirmarAccion');
  const btnCancelar = document.getElementById('btnCancelarAccion');

  const limpiar = () => {
    modal.hidden = true;
    btnConfirmar.removeEventListener('click', onConfirmar);
    btnCancelar.removeEventListener('click', onCancelar);
  };
  const onConfirmar = () => { alConfirmar(); limpiar(); };
  const onCancelar = () => { limpiar(); };

  btnConfirmar.addEventListener('click', onConfirmar);
  btnCancelar.addEventListener('click', onCancelar);
}
