# job-bot

CLI en Node.js para buscar ofertas de empleo en LinkedIn, filtrarlas con reglas simples, guardarlas en SQLite y gestionarlas desde la terminal.

## Stack

- Node.js
- Playwright
- SQLite (`sqlite3`)
- Commander
- Chalk

## Que Hace El Sistema

- Busca ofertas publicadas en las ultimas 24 horas.
- Permite busquedas dinamicas por keyword.
- Soporta modalidad `remote`, `hybrid` o `both`.
- Aplica filtros automáticos basados en `JOB_SEARCH_RULES.md`.
- Guarda ofertas en SQLite.
- Evita duplicados por `link`.
- Guarda la modalidad detectada de cada oferta.
- Lista ofertas por estado y modalidad.
- Permite marcar ofertas como aplicadas o ignoradas.

## Estructura

```text
job-bot/
├── src/
│   ├── cli/
│   │   └── commands.js
│   ├── scraper/
│   │   └── linkedin.js
│   ├── services/
│   │   └── jobService.js
│   ├── storage/
│   │   └── db.js
│   └── utils/
│       ├── jobRules.js
│       ├── modality.js
│       └── normalize.js
├── data/
│   ├── .gitkeep
│   └── jobs.db
├── JOB_SEARCH_RULES.md
├── index.js
├── package.json
├── package-lock.json
├── .env.example
└── README.md
```

## Como Funciona

1. `fetch` abre LinkedIn Jobs con la keyword indicada.
2. Aplica el filtro de ultimas 24 horas.
3. Filtra por modalidad segun `remote`, `hybrid` o `both`.
4. Hace scroll automatico para cargar mas resultados.
5. Deduplica ofertas por `link`.
6. Aplica reglas positivas y negativas desde `JOB_SEARCH_RULES.md`.
7. Guarda las ofertas filtradas en SQLite.
8. `list` muestra las ofertas guardadas con estado, modalidad y prioridad visual.

## Instalacion

1. Instala dependencias:

```bash
npm install
```

2. Instala navegadores de Playwright:

```bash
npx playwright install
```

## Uso Basico

Buscar ofertas usando la keyword por defecto:

```bash
node index.js fetch
```

Buscar con una keyword concreta:

```bash
node index.js fetch --keyword="backend developer junior nodejs"
```

Buscar solo remoto:

```bash
node index.js fetch --keyword="customer support remote" --modality=remote
```

Buscar solo hibrido:

```bash
node index.js fetch --keyword="marketing digital junior" --modality=hybrid
```

Buscar remoto e hibrido:

```bash
node index.js fetch --keyword="backend developer" --modality=both --limit=30
```

Listar ofertas nuevas:

```bash
node index.js list
```

Listar ofertas aplicadas:

```bash
node index.js list --status=applied
```

Listar ofertas nuevas solo remotas:

```bash
node index.js list --status=new --modality=remote
```

Marcar una oferta como aplicada:

```bash
node index.js apply 1
```

Marcar una oferta como ignorada:

```bash
node index.js ignore 2
```

## Comandos Disponibles

### `fetch`

Obtiene ofertas desde LinkedIn, aplica filtros y las guarda en SQLite.

Opciones:

- `--keyword <keyword>`: keyword de busqueda
- `--limit <number>`: maximo de ofertas a revisar, default `50`
- `--modality <modality>`: `both|remote|hybrid`, default `both`
- `--remote`: atajo para buscar solo remoto

Ejemplos:

- `node index.js fetch --keyword="customer support remote"`
- `node index.js fetch --keyword="data analyst junior" --limit=20`
- `node index.js fetch --keyword="backend developer" --modality=hybrid`

### `list`

Lista ofertas guardadas en la base de datos.

Opciones:

- `--status <status>`: `new|applied|ignored`, default `new`
- `--modality <modality>`: `all|remote|hybrid|onsite|unknown`, default `all`

Ejemplos:

- `node index.js list`
- `node index.js list --status=ignored`
- `node index.js list --status=new --modality=remote`
- `node index.js list --status=applied --modality=hybrid`

### `apply`

Marca una oferta como aplicada.

```bash
node index.js apply <id>
```

### `ignore`

Marca una oferta como ignorada.

```bash
node index.js ignore <id>
```

## Reglas De Filtrado

Si existe `JOB_SEARCH_RULES.md`, el sistema intenta leer:

- `positive_keywords`
- `negative_keywords`

Comportamiento:

- elimina ofertas que coincidan con palabras negativas
- prioriza ofertas que coincidan con palabras positivas
- si el archivo no existe o falla el parseo, el CLI continua sin romperse

## Base De Datos

La tabla `jobs` guarda estos campos principales:

- `id`
- `title`
- `company`
- `link`
- `modality`
- `status`
- `createdAt`

Notas:

- `link` es unico y evita duplicados
- `modality` puede ser `remote`, `hybrid`, `onsite` o `unknown`
- si una oferta vieja no tenia modalidad guardada, puede aparecer como `unknown`

## Variables De Entorno Opcionales

Puedes copiar `.env.example` a `.env` y definir:

```env
LINKEDIN_KEYWORDS=nodejs
JOB_DB_PATH=./data/jobs.db
LINKEDIN_MAX_JOBS=50
```

Resolucion de keyword en `fetch`:

1. `--keyword`
2. `LINKEDIN_KEYWORDS`
3. fallback final `nodejs`

## Notas Importantes

- LinkedIn cambia su HTML con frecuencia, por lo que a veces puede ser necesario ajustar selectores en `src/scraper/linkedin.js`.
- El navegador se abre en modo visible (`headless: false`) para facilitar el diagnostico.
- El sistema esta pensado como asistente de busqueda, no como aplicador automatico masivo.
- Las reglas en `JOB_SEARCH_RULES.md` mejoran mucho la calidad de resultados si estan bien definidas.
