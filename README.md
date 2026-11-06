# Auto Control — Hyundai Elantra 2013 / 2016

Aplicación web privada para llevar el historial de mantenimiento de dos vehículos Hyundai Elantra. Frontend React + Vite; datos en Supabase PostgreSQL.

## Seguridad

- El repositorio puede ser público, pero no contiene registros personales.
- Las tablas activan Row Level Security (RLS).
- Cada fila está asociada al UUID del usuario autenticado (`owner_id`).
- La aplicación usa solamente la clave publicable/anon de Supabase.
- **Nunca** publiques `service_role`, claves secretas, contraseñas ni el archivo `.env`.
- No cargues facturas ni documentos personales en el repositorio GitHub.

## Requisitos

- Node.js LTS
- Cuenta GitHub
- Cuenta Supabase

## Configuración de Supabase

1. Crea un proyecto en https://supabase.com.
2. En Authentication > Users, crea el usuario administrador (desactiva el registro público si la configuración del proyecto lo permite).
3. Abre SQL Editor y ejecuta el contenido de `supabase/schema.sql`.
4. Copia Project URL y la Publishable key (o anon key heredada) desde Project Settings > API.
5. Crea `.env` en la raíz copiando `.env.example` y agrega esos dos valores.
6. Inicia sesión con el usuario creado.

Después de iniciar sesión, inserta tus dos vehículos desde SQL Editor, sustituyendo `UUID_DEL_ADMIN` por el UUID real del usuario de Authentication:

```sql
insert into public.vehicles (owner_id, year, model, plate, current_mileage, mileage_unit)
values
('UUID_DEL_ADMIN', 2013, 'Hyundai Elantra GLS', 'HBN7218', 105340, 'millas'),
('UUID_DEL_ADMIN', 2016, 'Hyundai Elantra Limited', 'JDE3768', 150678, 'millas');
```

## Ejecutar localmente

```bash
npm install
npm run dev
```

## Compilar

```bash
npm run build
```

El directorio de publicación es `dist/`.

## Publicar en GitHub Pages

1. Crea un repositorio público llamado `control-mantenimiento-hyundai`.
2. Sube el contenido de este proyecto al repositorio (no subas `.env`).
3. En Settings > Pages, selecciona GitHub Actions.
4. Configura variables de repositorio para Vite: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Agrega un workflow de GitHub Actions para ejecutar `npm ci` y `npm run build`, y publicar `dist`.

Nota: este starter usa `base: '/control-mantenimiento-hyundai/'` en `vite.config.js`. Si eliges otro nombre de repositorio, ajusta esa ruta.

## Datos de referencia del Excel

- Hyundai Elantra GLS 2013 — placa HBN7218 — 105,340 millas.
- Hyundai Elantra Limited 2016 — placa JDE3768 — 150,678 millas.

El Excel original se conserva como fuente de migración; los registros históricos deben importarse y validarse antes de considerarlos migrados.
