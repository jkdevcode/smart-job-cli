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
- Permite busquedas dinamicas por keyword y por variantes de keyword.
- Soporta modalidad `remote`, `hybrid` o `both`.
- Permite repetir la busqueda por varias ubicaciones objetivo.
- Aplica filtros automáticos basados en `JOB_SEARCH_RULES.md`.
- Guarda ofertas en SQLite.
- Evita duplicados por `link`.
- Guarda modalidad, ubicacion e idioma detectados de cada oferta.
- Guarda confianza, requisito de ingles y evidencia del analisis de idioma.
- Lista ofertas por estado, modalidad, ubicacion e idioma.
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

1. `fetch` abre LinkedIn Jobs con la keyword indicada o con varias variantes si asi lo configuras.
2. Aplica el filtro de ultimas 24 horas.
3. Filtra por modalidad segun `remote`, `hybrid` o `both`.
4. Puede repetir la busqueda por varias ubicaciones.
5. Hace scroll automatico para cargar mas resultados.
6. Deduplica ofertas por `link`.
7. Detecta modalidad e intenta inferir idioma.
8. Aplica reglas positivas y negativas desde `JOB_SEARCH_RULES.md`.
9. Guarda las ofertas filtradas en SQLite.
10. `list` muestra las ofertas guardadas con estado, modalidad, ubicacion, idioma y prioridad visual.

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

Buscar usando las ubicaciones y variantes configuradas en `.env` y `JOB_SEARCH_RULES.md`:

```bash
node index.js fetch --remote
```

Buscar con una keyword concreta:

```bash
node index.js fetch --keyword="backend developer junior nodejs"
```

Buscar solo remoto:

```bash
node index.js fetch --keyword="customer support remote" --modality=remote
```

Buscar solo en una ubicacion concreta:

```bash
node index.js fetch --keyword="backend developer nodejs" --location="Colombia" --remote
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
- `--limit <number>`: maximo total de ofertas a revisar. Si no se pasa, usa `LINKEDIN_MAX_JOBS`
- `--modality <modality>`: `both|remote|hybrid`. Si no se pasa, usa `LINKEDIN_DEFAULT_MODALITY`
- `--location <location>`: fuerza una ubicacion concreta para esa ejecucion
- `--remote`: atajo para buscar solo remoto

Ejemplos:

- `node index.js fetch --keyword="customer support remote"`
- `node index.js fetch --keyword="data analyst junior" --limit=20`
- `node index.js fetch --keyword="backend developer" --modality=hybrid`
- `node index.js fetch --remote`
- `node index.js fetch --location="Bogota, Colombia" --remote`

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
- `search_keyword_variants`
- `target_locations`
- `colombia_cities`
- `required_spanish_locations`
- `preferred_spanish_locations`
- `strict_english_rejection_locations`
- `allow_mixed_language_locations`
- `english_required_phrases`
- `english_preferred_phrases`
- `spanish_markers`
- `english_markers`

Comportamiento:

- elimina ofertas que coincidan con palabras negativas
- prioriza ofertas que coincidan con palabras positivas
- puede definir variantes de busqueda y ubicaciones objetivo
- puede exigir espanol en ubicaciones configuradas
- puede preferir espanol en otras ubicaciones sin descartar automaticamente
- puede detectar si el ingles parece obligatorio o solo deseable
- el filtro de idioma es heuristico, no una deteccion perfecta
- si el archivo no existe o falla el parseo, el CLI continua sin romperse

## Base De Datos

La tabla `jobs` guarda estos campos principales:

- `id`
- `title`
- `company`
- `link`
- `location`
- `modality`
- `language`
- `languageConfidence`
- `englishRequirement`
- `languageEvidence`
- `status`
- `createdAt`

Notas:

- `link` es unico y evita duplicados
- `modality` puede ser `remote`, `hybrid`, `onsite` o `unknown`
- `language` puede ser `spanish`, `english`, `mixed` o `unknown`
- `englishRequirement` puede ser `required`, `preferred`, `none` o `unknown`
- si una oferta vieja no tenia modalidad guardada, puede aparecer como `unknown`

## Variables De Entorno Opcionales

Puedes copiar `.env.example` a `.env` y definir:

```env
LINKEDIN_KEYWORDS=backend developer nodejs nestjs typescript
LINKEDIN_KEYWORD_VARIANTS=backend developer nodejs nestjs typescript;nodejs backend developer api;nestjs developer typescript backend;express nodejs backend developer
JOB_DB_PATH=./data/jobs.db
LINKEDIN_MAX_JOBS=60
LINKEDIN_DEFAULT_MODALITY=remote
LINKEDIN_TARGET_LOCATIONS=Latin America;Colombia
LINKEDIN_COLOMBIA_CITIES=Bogota, Colombia
LINKEDIN_REQUIRED_SPANISH_LOCATIONS=Colombia;Bogota, Colombia
LINKEDIN_PREFERRED_SPANISH_LOCATIONS=Latin America
LINKEDIN_STRICT_ENGLISH_REJECTION_LOCATIONS=Colombia;Bogota, Colombia
LINKEDIN_ALLOW_MIXED_LANGUAGE_LOCATIONS=Latin America;Colombia;Bogota, Colombia
```

Resolucion de keyword en `fetch`:

1. `--keyword`
2. `LINKEDIN_KEYWORD_VARIANTS`
3. `LINKEDIN_KEYWORDS`
4. fallback final `nodejs`

Resolucion de ubicaciones en `fetch`:

1. `--location`
2. `LINKEDIN_TARGET_LOCATIONS` + `LINKEDIN_COLOMBIA_CITIES`
3. `target_locations` + `colombia_cities`
4. sin filtro fijo de ubicacion

Resolucion de espanol obligatorio:

1. `LINKEDIN_REQUIRED_SPANISH_LOCATIONS`
2. `required_spanish_locations`
3. sin filtro obligatorio de idioma

Resolucion de preferencia de espanol:

1. `LINKEDIN_PREFERRED_SPANISH_LOCATIONS`
2. `preferred_spanish_locations`
3. sin prioridad especial por idioma

Resolucion de rechazo estricto en ingles:

1. `LINKEDIN_STRICT_ENGLISH_REJECTION_LOCATIONS`
2. `strict_english_rejection_locations`

Resolucion de idioma mixto permitido:

1. `LINKEDIN_ALLOW_MIXED_LANGUAGE_LOCATIONS`
2. `allow_mixed_language_locations`

## Notas Importantes

- LinkedIn cambia su HTML con frecuencia, por lo que a veces puede ser necesario ajustar selectores en `src/scraper/linkedin.js`.
- El navegador se abre en modo visible (`headless: false`) para facilitar el diagnostico.
- El sistema esta pensado como asistente de busqueda, no como aplicador automatico masivo.
- Las reglas en `JOB_SEARCH_RULES.md` mejoran mucho la calidad de resultados si estan bien definidas.
- La deteccion de idioma se basa en heuristicas sobre el texto visible de la tarjeta de LinkedIn.
- Para Colombia la configuracion recomendada es rechazo estricto de anuncios claramente en ingles.
- Para LATAM la configuracion recomendada es priorizar espanol y permitir anuncios mixtos si siguen siendo relevantes.
