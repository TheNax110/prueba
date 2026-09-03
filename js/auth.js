const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------- header dinámico ------------------------- */

async function actualizarHeader() {
  const sesion = await LimpiarteDB.getSesion();
  const zonaSesion = document.querySelector('[data-zona-sesion]');
  if (!zonaSesion) return;

  if (!sesion) {
    zonaSesion.innerHTML = `
      <a href="login.html" class="btn btn-outline">Iniciar sesión</a>
      <a href="registro.html" class="btn btn-primary">Registrarse</a>
    `;
    return;
  }

  const linkAdmin = sesion.rol === 'admin'
    ? `<a href="admin.html" class="btn btn-ghost">Panel de administración</a>`
    : '';

  zonaSesion.innerHTML = `
    <span class="saludo-usuario">Hola, ${escaparHTML(sesion.nombre)}</span>
    ${linkAdmin}
    <button class="btn btn-outline" id="btnCerrarSesion" type="button">Cerrar sesión</button>
  `;

  document.getElementById('btnCerrarSesion').addEventListener('click', async () => {
    await LimpiarteDB.cerrarSesion();
    window.location.href = 'index.html';
  });
}

function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

/* ------------------------- protección de rutas ------------------------- */

async function protegerRutaAdmin() {
  const sesion = await LimpiarteDB.getSesion();
  if (!sesion || sesion.rol !== 'admin') {
    window.location.href = 'login.html';
    return null;
  }
  return sesion;
}

async function redirigirSiYaLogueado() {
  const sesion = await LimpiarteDB.getSesion();
  if (sesion) {
    window.location.href = sesion.rol === 'admin' ? 'admin.html' : 'index.html';
  }
}

/* ------------------------- feedback visual ------------------------- */

function mostrarMensaje(contenedor, texto, tipo = 'error') {
  contenedor.textContent = texto;
  contenedor.className = `mensaje-form mensaje-${tipo}`;
  contenedor.hidden = false;
}

function ocultarMensaje(contenedor) {
  contenedor.hidden = true;
  contenedor.textContent = '';
}

/* ------------------------- formulario de registro ------------------------- */

function inicializarFormularioRegistro() {
  const form = document.getElementById('formRegistro');
  if (!form) return;

  const mensaje = document.getElementById('mensajeRegistro');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarMensaje(mensaje);

    const nombre = form.elements.nombre.value.trim();
    const apellido = form.elements.apellido.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const confirmar = form.elements.confirmarPassword.value;

    if (!nombre || !apellido || !email || !password || !confirmar) {
      mostrarMensaje(mensaje, 'Completá todos los campos obligatorios.');
      return;
    }
    if (!REGEX_EMAIL.test(email)) {
      mostrarMensaje(mensaje, 'Ingresá un email válido.');
      return;
    }
    if (password.length < 8) {
      mostrarMensaje(mensaje, 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmar) {
      mostrarMensaje(mensaje, 'Las contraseñas no coinciden.');
      return;
    }

    const botonSubmit = form.querySelector('button[type="submit"]');
    botonSubmit.disabled = true;

    const resultado = await LimpiarteDB.crearUsuario({ nombre, apellido, email, password });

    botonSubmit.disabled = false;

    if (!resultado.ok) {
      mostrarMensaje(mensaje, resultado.motivo);
      return;
    }

    mostrarMensaje(mensaje, '¡Cuenta creada con éxito! Redirigiendo a inicio de sesión...', 'exito');
    form.reset();
    setTimeout(() => { window.location.href = 'login.html'; }, 1600);
  });
}

/* ------------------------- formulario de login ------------------------- */

function inicializarFormularioLogin() {
  const form = document.getElementById('formLogin');
  if (!form) return;

  const mensaje = document.getElementById('mensajeLogin');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarMensaje(mensaje);

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    if (!email || !password) {
      mostrarMensaje(mensaje, 'Completá email y contraseña.');
      return;
    }

    const botonSubmit = form.querySelector('button[type="submit"]');
    botonSubmit.disabled = true;

    const resultado = await LimpiarteDB.iniciarSesion(email, password);

    botonSubmit.disabled = false;

    if (!resultado.ok) {
      mostrarMensaje(mensaje, resultado.motivo);
      return;
    }

    mostrarMensaje(mensaje, `¡Bienvenido/a, ${resultado.usuario.nombre}! Redirigiendo...`, 'exito');
    setTimeout(() => {
      window.location.href = resultado.usuario.rol === 'admin' ? 'admin.html' : 'index.html';
    }, 900);
  });
}

/* ------------------------- menú hamburguesa ------------------------- */

function inicializarMenuMovil() {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.nav-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const abierto = menu.classList.toggle('abierto');
    toggle.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  actualizarHeader();
  inicializarMenuMovil();
});
