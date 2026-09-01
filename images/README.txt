Esta carpeta se deja preparada para alojar imágenes reales de productos
(por ejemplo: detergente-ultra.jpg, lavandina.jpg, etc).

En este prototipo, cada producto usa un emoji como imagen de ejemplo
(campo "imagen" en la base de datos simulada) para no depender de archivos
binarios externos. Para usar fotos reales, alcanza con:

1. Colocar los archivos de imagen en esta carpeta.
2. Cambiar el campo "imagen" del producto en la base de datos (o desde el
   panel de administración) por la ruta relativa, por ejemplo:
   "images/detergente-ultra.jpg"
3. Reemplazar en css/styles.css la regla que muestra el emoji
   (.tarjeta-producto-imagen, .modal-producto-imagen) por un <img> real.
