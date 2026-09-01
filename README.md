# LIMPIARTE — Sitio Web Comercial

Proyecto académico desarrollado para la **Olimpíada Nacional de Informática**.

Sitio web completo para **LIMPIARTE**, una empresa ficticia de artículos de
limpieza (~100 empleados) con sede en Mar del Plata, Buenos Aires.
Slogan: *"Soluciones de limpieza para cada espacio."*

---

## 1. Qué hace el proyecto

Sitio web dinámico y funcional que incluye:

- **Vista de usuario**: catálogo de productos con buscador, filtros (rubro,
  marca) y ordenamiento; ficha de detalle en modal; información institucional
  ("Nosotros"); medios de contacto y formulario de consultas; registro e
  inicio de sesión.
- **Vista de administrador**: panel separado con dashboard de estadísticas y
  gestión completa (alta, edición y baja) de **productos**, **rubros** y
  **marcas**, además de un listado de **usuarios** registrados.
- **Sistema de roles**: diferencia usuarios normales de administradores; el
  panel de administración está protegido y es inaccesible para un usuario
  normal.

Todos los botones son funcionales: registrarse registra de verdad, el login
autentica contra la base simulada, los filtros filtran en tiempo real, y las
altas/ediciones/bajas del panel se reflejan inmediatamente en el catálogo
público.

---

## 2. Tecnologías utilizadas

- **HTML5** semántico (5 páginas independientes).
- **CSS3** propio (sin frameworks), con variables CSS, Flexbox, Grid y diseño
  responsive con menú hamburguesa.
- **JavaScript (ES6+)**, sin frameworks ni librerías externas, organizado en
  módulos por responsabilidad.
- **Persistencia**: `localStorage` (datos) y `sessionStorage` (sesión activa)
  simulando una base de datos real, con una capa de acceso a datos
  (`js/data.js`) pensada para poder reemplazarse por llamadas a una API REST
  real sin tener que modificar el resto del sitio (las pantallas solo llaman
  a funciones como `LimpiarteDB.getProductos()`, nunca acceden a
  `localStorage` directamente).

> **Nota de seguridad (educativa):** por tratarse de un prototipo sin
> backend, las contraseñas se transforman con un hash simple del lado del
> cliente solo para no guardarlas 100% en texto plano; **esto no es
> criptografía segura**. En un entorno de producción real, la autenticación,
> el hash de contraseñas (bcrypt/argon2) y el almacenamiento de datos deben
> resolverse siempre del lado del servidor.

---

## 3. Cómo ejecutar el proyecto

No requiere instalación ni backend. Alcanza con abrir el sitio con un
servidor estático local (recomendado, para que las rutas relativas y los
módulos funcionen sin restricciones del navegador):

```bash
cd proyecto
python3 -m http.server 8080
# luego abrir http://localhost:8080/index.html
```

También puede abrirse `index.html` directamente con doble clic en la mayoría
de los navegadores modernos.

### Usuario administrador de prueba

| Campo        | Valor                     |
|--------------|---------------------------|
| Email        | `admin@limpiarte.com.ar`  |
| Contraseña   | `Admin123!`               |

### Usuarios de prueba (rol usuario)

| Email                        | Contraseña     |
|-------------------------------|----------------|
| juan.perez@ejemplo.com        | Usuario123!    |
| maria.gomez@ejemplo.com       | Usuario123!    |

Los datos se generan automáticamente la primera vez que se abre el sitio
(ver `LimpiarteDB.seed()` en `js/data.js`).

---

## 4. Estructura de carpetas

```text
/proyecto
│
├── index.html          → Página principal (catálogo, nosotros, contacto)
├── login.html           → Inicio de sesión
├── registro.html         → Registro de nuevos usuarios
├── admin.html            → Panel de administración (protegido, solo admin)
│
├── css/
│   └── styles.css        → Estilos de todo el sitio
│
├── js/
│   ├── data.js            → Capa de datos: CRUD de productos, rubros,
│   │                         marcas, usuarios y sesión (localStorage)
│   ├── auth.js             → Registro, login, logout, header dinámico,
│   │                          protección de rutas, menú móvil
│   ├── productos.js         → Catálogo: búsqueda, filtros, orden, modal
│   │                          de detalle y formulario de contacto
│   └── admin.js              → Panel de administración: dashboard y CRUD
│                                completo de productos/rubros/marcas
│
├── images/                → Carpeta preparada para imágenes reales de
│                             productos (el prototipo usa emojis)
│
└── README.md              → Este archivo
```

---

## 5. Cómo funciona la gestión de productos

Desde **Panel de administración → Productos**:

- **Agregar producto**: botón "+ Agregar producto" abre un formulario modal
  con nombre, rubro (select dinámico), marca (select dinámico), descripción,
  precio e ícono/imagen.
- **Editar producto**: botón ✏️ en cada fila precarga el formulario con los
  datos actuales y actualiza el registro existente.
- **Eliminar producto**: botón 🗑️ solicita confirmación explícita
  ("¿Estás seguro de que querés eliminar este producto?") antes de borrar.

Todos los cambios impactan de inmediato en `localStorage` y se reflejan tanto
en la tabla del panel como en el catálogo público (`index.html`).

## 6. Cómo funciona la gestión de rubros

Desde **Panel de administración → Rubros** se pueden crear, editar y eliminar
rubros. La tabla muestra cuántos productos tiene asociados cada rubro. No se
permite eliminar un rubro que tenga productos asociados (se debe reasignar o
eliminar esos productos primero), para mantener la integridad referencial de
la base de datos simulada.

## 7. Cómo funciona la gestión de marcas

Análogo a los rubros: desde **Panel de administración → Marcas** se pueden
crear, editar y eliminar marcas, con la misma validación de integridad
referencial (no se puede eliminar una marca con productos asociados).

## 8. Persistencia de datos

- Las **entidades** (`productos`, `rubros`, `marcas`, `usuarios`) se guardan
  en `localStorage`, cada una bajo su propia clave (`limpiarte_productos`,
  `limpiarte_rubros`, `limpiarte_marcas`, `limpiarte_usuarios`), simulando
  tablas independientes de una base de datos relacional.
- Un producto se relaciona con su rubro y su marca mediante `rubro_id` y
  `marca_id`, tal como lo haría una clave foránea en una base de datos real.
- La **sesión activa** se guarda en `sessionStorage`
  (clave `limpiarte_sesion`), separada de los datos persistentes, y se borra
  automáticamente al cerrar la pestaña o al hacer clic en "Cerrar sesión".
- Toda la lógica de acceso a datos está centralizada en el objeto
  `LimpiarteDB` (`js/data.js`). Para migrar a una base de datos real (por
  ejemplo, Node.js + Express + PostgreSQL/MySQL), alcanza con reemplazar el
  cuerpo de cada función de `LimpiarteDB` por un `fetch()` a los endpoints
  correspondientes de una API REST, sin modificar el resto del sitio.

---

## 9. Roles y permisos

| Acción                                   | Usuario | Administrador |
|-------------------------------------------|:-------:|:--------------:|
| Ver catálogo, buscar y filtrar             | ✅      | ✅             |
| Ver información de la empresa y contacto   | ✅      | ✅             |
| Registrarse / iniciar / cerrar sesión      | ✅      | ✅             |
| Acceder al panel de administración         | ❌      | ✅             |
| Gestionar productos, rubros y marcas       | ❌      | ✅             |
| Ver listado de usuarios registrados        | ❌      | ✅             |

`admin.html` verifica al cargar que exista una sesión activa con
`rol === 'admin'` (función `protegerRutaAdmin()` en `js/auth.js`); si no es
así, redirige automáticamente a `login.html`.

---

## 10. Datos iniciales cargados

- 14 productos de ejemplo.
- 7 rubros: Lavavajillas, Desinfectantes, Limpieza de pisos, Desengrasantes,
  Higiene personal, Accesorios de limpieza, Aromatizantes.
- 5 marcas: LimpioMax, Brillo, HogarPlus, EcoClean, Sanit.
- 1 usuario administrador y 2 usuarios de prueba (ver sección 3).

Todos estos datos pueden modificarse libremente desde el panel de
administración una vez logueado como administrador.
