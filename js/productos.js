/* ============================================================
   productos.js
   ------------------------------------------------------------
   Renderiza el catálogo en index.html: búsqueda, filtro por
   rubro, filtro por marca, ordenamiento y modal de detalle.
   Los productos NUNCA se escriben a mano en el HTML: siempre
   se generan dinámicamente consultando a Supabase a través de
   LimpiarteDB (ver js/data.js).
   ============================================================ */

let filtrosCatalogo = {
  texto: '',
  rubroId: 'todos',
  marcaId: 'todas',
  orden: 'relevancia'
};

// Caches simples en memoria para no repetir consultas de rubros/marcas
// cada vez que se re-renderiza el catálogo.
let cacheRubros = [];
let cacheMarcas = [];

async function inicializarCatalogo() {
  const grid = document.getElementById('gridProductos');
  if (!grid) return; // esta página no tiene catálogo

  cacheRubros = await LimpiarteDB.getRubros();
  cacheMarcas = await LimpiarteDB.getMarcas();

  poblarFiltroRubros();
  poblarFiltroMarcas();
  await renderizarCatalogo();

  document.getElementById('buscadorProductos').addEventListener('input', (e) => {
    filtrosCatalogo.texto = e.target.value.trim().toLowerCase();
    renderizarCatalogo();
  });

  document.getElementById('filtroRubro').addEventListener('change', (e) => {
    filtrosCatalogo.rubroId = e.target.value;
    renderizarCatalogo();
  });

  document.getElementById('filtroMarca').addEventListener('change', (e) => {
    filtrosCatalogo.marcaId = e.target.value;
    renderizarCatalogo();
  });

  document.getElementById('ordenProductos').addEventListener('change', (e) => {
    filtrosCatalogo.orden = e.target.value;
    renderizarCatalogo();
  });

  document.getElementById('modalCerrar').addEventListener('click', cerrarModalProducto);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') cerrarModalProducto();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModalProducto();
  });
}

function poblarFiltroRubros() {
  const select = document.getElementById('filtroRubro');
  select.innerHTML = '<option value="todos">Todos los rubros</option>' +
    cacheRubros.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
}

function poblarFiltroMarcas() {
  const select = document.getElementById('filtroMarca');
  select.innerHTML = '<option value="todas">Todas las marcas</option>' +
    cacheMarcas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
}

async function obtenerProductosFiltrados() {
  let productos = await LimpiarteDB.getProductos();

  if (filtrosCatalogo.texto) {
    productos = productos.filter(p => p.nombre.toLowerCase().includes(filtrosCatalogo.texto));
  }
  if (filtrosCatalogo.rubroId !== 'todos') {
    productos = productos.filter(p => p.rubro_id === Number(filtrosCatalogo.rubroId));
  }
  if (filtrosCatalogo.marcaId !== 'todas') {
    productos = productos.filter(p => p.marca_id === Number(filtrosCatalogo.marcaId));
  }

  switch (filtrosCatalogo.orden) {
    case 'precio-asc': productos.sort((a, b) => a.precio - b.precio); break;
    case 'precio-desc': productos.sort((a, b) => b.precio - a.precio); break;
    case 'nombre-asc': productos.sort((a, b) => a.nombre.localeCompare(b.nombre)); break;
    case 'nombre-desc': productos.sort((a, b) => b.nombre.localeCompare(a.nombre)); break;
    default: break;
  }

  return productos;
}

async function renderizarCatalogo() {
  const grid = document.getElementById('gridProductos');
  const contador = document.getElementById('contadorResultados');
  const vacio = document.getElementById('catalogoVacio');
  const productos = await obtenerProductosFiltrados();

  contador.textContent = `${productos.length} producto${productos.length === 1 ? '' : 's'} encontrado${productos.length === 1 ? '' : 's'}`;

  if (productos.length === 0) {
    grid.innerHTML = '';
    vacio.hidden = false;
    return;
  }
  vacio.hidden = true;

  grid.innerHTML = productos.map(p => {
    const rubro = cacheRubros.find(r => r.id === p.rubro_id);
    const marca = cacheMarcas.find(m => m.id === p.marca_id);
    const urlImagen = LimpiarteDB.obtenerUrlImagen(p.imagen);
    const bloqueImagen = urlImagen
      ? `<div class="tarjeta-producto-imagen"><img src="${urlImagen}" alt="${escaparHTML(p.nombre)}" loading="lazy" onerror="this.parentElement.textContent='🧼'"></div>`
      : `<div class="tarjeta-producto-imagen">🧼</div>`;
    return `
      <article class="tarjeta-producto">
        ${bloqueImagen}
        <div class="tarjeta-producto-body">
          <span class="chip">${rubro ? rubro.nombre : 'Sin rubro'}</span>
          <h3>${p.nombre}</h3>
          <p class="tarjeta-producto-marca">Marca: <strong>${marca ? marca.nombre : 'Sin marca'}</strong></p>
          <p class="tarjeta-producto-desc">${recortarTexto(p.descripcion, 80)}</p>
          <div class="tarjeta-producto-footer">
            <span class="precio">${LimpiarteDB.formatearPrecio(p.precio)}</span>
            <button class="btn btn-primary btn-sm" data-ver-detalle="${p.id}">Ver detalle</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('[data-ver-detalle]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalProducto(btn.dataset.verDetalle));
  });
}

function recortarTexto(texto, max) {
  return texto.length > max ? texto.slice(0, max).trim() + '…' : texto;
}

async function abrirModalProducto(id) {
  const producto = await LimpiarteDB.getProductoPorId(id);
  if (!producto) return;
  const rubro = cacheRubros.find(r => r.id === producto.rubro_id);
  const marca = cacheMarcas.find(m => m.id === producto.marca_id);

  const urlImagen = LimpiarteDB.obtenerUrlImagen(producto.imagen);
  const contenedorImagen = document.getElementById('modalImagen');
  if (urlImagen) {
    contenedorImagen.innerHTML = `<img src="${urlImagen}" alt="${escaparHTML(producto.nombre)}" onerror="this.parentElement.textContent='🧼'">`;
  } else {
    contenedorImagen.textContent = '🧼';
  }
  document.getElementById('modalNombre').textContent = producto.nombre;
  document.getElementById('modalRubro').textContent = rubro ? rubro.nombre : 'Sin rubro';
  document.getElementById('modalMarca').textContent = marca ? marca.nombre : 'Sin marca';
  document.getElementById('modalDescripcion').textContent = producto.descripcion;
  document.getElementById('modalPrecio').textContent = LimpiarteDB.formatearPrecio(producto.precio);

  const overlay = document.getElementById('modalOverlay');
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function cerrarModalProducto() {
  document.getElementById('modalOverlay').hidden = true;
  document.body.style.overflow = '';
}

/* ------------------------- formulario de contacto ------------------------- */

function inicializarFormularioContacto() {
  const form = document.getElementById('formContacto');
  if (!form) return;
  const mensaje = document.getElementById('mensajeContacto');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = form.elements.nombre.value.trim();
    const email = form.elements.email.value.trim();
    const asunto = form.elements.asunto.value.trim();
    const cuerpo = form.elements.mensaje.value.trim();

    if (!nombre || !email || !asunto || !cuerpo) {
      mostrarMensaje(mensaje, 'Completá todos los campos para enviar tu consulta.');
      return;
    }
    if (!REGEX_EMAIL.test(email)) {
      mostrarMensaje(mensaje, 'Ingresá un email válido.');
      return;
    }

    // No hay backend de correo: simulamos el envío guardando feedback visual.
    mostrarMensaje(mensaje, `¡Gracias ${nombre}! Recibimos tu consulta y te responderemos a la brevedad.`, 'exito');
    form.reset();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarCatalogo();
  inicializarFormularioContacto();
});
