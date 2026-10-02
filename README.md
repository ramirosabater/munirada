# Rada Tilly · Servicios al vecino

App web (se puede instalar en el celular) para la Municipalidad de Rada Tilly.
Toma como base la app de la Academia de Pakua —inscripciones, cuotas con
comprobante, asistencia y cobranzas— y la amplía a los servicios del municipio.

Stack: React + Vite, Supabase (base de datos, usuarios, archivos) y Netlify.
Mismo esquema de despliegue que Pakua.

---

## Qué hace

### Para el vecino (se registra solo, con DNI y correo)
| Sección | Qué puede hacer |
|---|---|
| **Inicio** | Avisos del municipio (cortes, alertas), estado de cuotas, qué actividades tiene hoy, próximos turnos, reclamos abiertos y teléfonos útiles. |
| **Actividades** | Catálogo de deportes, talleres de arte, adultos mayores, infancias y eventos (ej. Trekking de la luna llena). Filtros, cupos en vivo, edad recomendada. Se inscribe a sí mismo o a alguien de su **grupo familiar**. Si el cupo está lleno queda en lista de espera; si la actividad requiere aprobación, queda pendiente. |
| **Mis inscripciones** | Estado de cada inscripción, % de asistencia y baja. |
| **Pagos** | Informa el pago de la cuota con comprobante (igual que Pakua). Queda "en revisión" hasta que el área lo aprueba. |
| **Reclamos** | Alumbrado, baches, agua, residuos, poda, animales sueltos, ruidos… Con dirección, ubicación GPS y foto. Recibe un número y ve el historial de novedades. |
| **Turnos** | Elige servicio, día y horario libre (castraciones, atención en Hacienda, o los que se configuren). Puede cancelar. |
| **Trámites y teléfonos** | Enlaces a los sistemas que ya existen: pago de tasas, e-boleta, turnero de licencias, alquileres temporarios, boletín oficial, etc. |
| **Mi cuenta** | Datos personales, grupo familiar, contraseña. |

### Para el personal municipal (pestaña "Gestión")
| Rol | Ve y gestiona |
|---|---|
| **Profesor/a** | Sus grupos: inscriptos y toma de asistencia (con planilla mensual descargable). |
| **Agente de un área** (Deportes, Cultura, Obras, Ambiente, Hacienda…) | Lo de su área: actividades y cupos, aprobar inscripciones, revisar pagos, cobranzas del mes, bandeja de reclamos con cambio de estado y mensajes al vecino, agenda de turnos, avisos. |
| **Administración** | Todo, más asignar roles y áreas a los usuarios. |

Los reclamos llegan solos al área correcta según la categoría
(alumbrado → Obras Públicas, poda → Ambiente, ruidos → Seguridad, etc.).
Todas las listas se pueden descargar como planilla (CSV para Excel).

---

## 1. Configurar Supabase

1. Creá un proyecto en https://supabase.com
2. **SQL Editor > New query**: pegá todo `supabase/schema.sql` y ejecutá (Run).
   Crea tablas, reglas de seguridad, archivos privados y **carga las actividades
   reales del sitio** (deportes y Taller de Arte, con sedes, horarios y docentes).
3. **Authentication > URL Configuration**: poné la URL de Netlify como *Site URL*
   (para que funcionen los correos de confirmación y de cambio de contraseña).
4. Para probar rápido podés desactivar la confirmación por correo en
   **Authentication > Providers > Email > Confirm email**. En producción, dejala activa.
5. **Project Settings > API**: copiá `Project URL` y la `anon public key`.

## 2. Correr localmente

```bash
npm install
cp .env.example .env     # completá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

## 3. Crear el primer administrador

1. Registrate desde la app (quedás como vecino/a).
2. En Supabase **SQL Editor**:
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'tu@correo.com');
   ```
3. Volvé a entrar: aparece el botón **Gestión**. Desde **Gestión > Usuarios**
   asignás profesores y agentes (a los agentes les elegís el área).

## 4. Publicar en Netlify

Igual que Pakua: subí el repo a GitHub, importalo en Netlify y cargá las dos
variables de entorno. `netlify.toml` ya trae el build y el redirect para las rutas.

---

## Antes de publicar: revisar

- [x] **Logo y colores**: ya usan la identidad del Municipio (turquesa del logo,
      verde petróleo, amarillo, mostaza y oliva). Están en el primer bloque de
      `src/index.css`. El logo (`public/logo-blanco.png`) salió de una captura:
      si conseguís el PNG original en alta calidad, reemplazalo con el mismo nombre.
- [ ] **Cuotas**: los montos cargados son **de ejemplo** ($8.000 / $10.000 / $15.000).
      Corregilos en Gestión > Actividades.
- [ ] **Días y horarios de los talleres de arte**: el sitio no los publica; quedaron
      "a confirmar".
- [ ] **Servicios de turnos**: "Esterilización de mascotas" y "Atención en Hacienda"
      son ejemplos. Ajustá días, horarios y requisitos reales.
- [ ] **Datos para transferir** (alias/CBU): `src/lib/municipio.js` → `DATOS_TRANSFERENCIA`.
- [ ] Teléfonos y enlaces: también en `src/lib/municipio.js`.
- [ ] Términos de uso y política de privacidad: la app guarda DNI, domicilio y datos
      de menores. Conviene que el área legal los revise (Ley 25.326).

## Seguridad

La protección real está en la base de datos (políticas RLS), no en la pantalla:
- Un vecino solo ve sus inscripciones, pagos, reclamos y turnos.
- Un vecino no puede cambiarse el rol, aprobarse un pago ni marcar su reclamo como resuelto.
- Un agente de Deportes no ve ni toca lo de Cultura u Obras.
- Cupos y turnos se validan en el servidor (no se pueden pisar dos personas el mismo lugar).
- Comprobantes y fotos van a carpetas privadas; el personal los abre con enlaces temporales.

## Ideas para una segunda etapa

- **Pago online con Mercado Pago** (necesita una función de servidor en Supabase
  Edge Functions para crear el cobro y recibir la confirmación automática).
- Avisos por **WhatsApp o notificaciones push** cuando cambia un reclamo o se acerca un turno.
- **Reserva de espacios** (SUM, canchas, quinchos) reutilizando el módulo de turnos.
- **Credencial digital** del vecino con QR para el gimnasio o la colonia de vacaciones.
- Mapa de calor de reclamos para planificar cuadrillas.
- Inscripción a la **Colonia de vacaciones** con ficha médica y autorización de padres.

## Estructura

```
supabase/schema.sql          tablas, seguridad (RLS), triggers y datos iniciales
src/lib/municipio.js         teléfonos, enlaces, áreas, datos de transferencia
src/lib/formato.js           fechas, montos, planillas
src/components/              Layout, marca, íconos, avisos
src/pages/Ingresar.jsx       ingreso
src/pages/Registro.jsx       alta de vecinos
src/pages/vecino/            inicio, actividades, pagos, reclamos, turnos, cuenta
src/pages/gestion/           panel, actividades, asistencia, pagos, cobranzas,
                             reclamos, turnos, avisos, usuarios
```
