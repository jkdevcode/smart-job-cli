# Job Search Rules

## Perfil objetivo

Busqueda orientada al perfil de Dario Zamora:

- backend developer con Node.js y NestJS
- APIs REST, JWT, Prisma, PostgreSQL y MySQL
- nivel junior a mid
- prioridad a remoto
- foco en ofertas para LATAM, Colombia y Bogota
- preferencia por ofertas en espanol

## Configuracion activa del CLI

El scraper puede leer estas listas como apoyo a la configuracion de `.env`.

```yaml
search_keyword_variants:
  - backend developer nodejs nestjs typescript
  - nodejs backend developer api
  - nestjs developer typescript backend
  - express nodejs backend developer

target_locations:
  - Latin America
  - Colombia

colombia_cities:
  - Bogota, Colombia

required_spanish_locations:
  - Colombia
  - Bogota, Colombia

preferred_spanish_locations:
  - Latin America

strict_english_rejection_locations:
  - Colombia
  - Bogota, Colombia

allow_mixed_language_locations:
  - Latin America
  - Colombia
  - Bogota, Colombia

english_required_phrases:
  - english only
  - fluent english
  - advanced english
  - professional english
  - must have english
  - english required
  - written and spoken english

english_preferred_phrases:
  - english is a plus
  - basic english
  - nice to have english
  - intermediate english
  - conversational english

spanish_markers:
  - desarrollador
  - ingeniero
  - vacante
  - empleo
  - requisitos
  - experiencia
  - anos
  - tiempo completo
  - remoto
  - hibrido
  - colombia
  - bogota

english_markers:
  - full time
  - contract
  - requirements
  - experience
  - required
  - must have
  - years
  - english
  - remote
  - developer
  - engineer

positive_keywords:
  - backend
  - backend developer
  - nodejs
  - node.js
  - nestjs
  - nest.js
  - express
  - typescript
  - javascript
  - api
  - rest api
  - jwt
  - prisma
  - postgresql
  - mysql
  - docker
  - remote
  - colombia
  - bogota
  - spanish
  - espanol
  - junior
  - mid level

negative_keywords:
  - senior
  - sr.
  - staff
  - principal
  - architect
  - manager
  - director
  - lead
  - onsite
  - frontend
  - react native
  - ios
  - android
  - php
  - wordpress
  - laravel
  - 4+ years
  - 5+ years
  - 6+ years
  - english only
```

## Notas

- `positive_keywords` y `negative_keywords` se usan para priorizar y descartar ofertas.
- `search_keyword_variants` permite probar varias busquedas rapidamente.
- `target_locations` define regiones base.
- `colombia_cities` agrega ciudades concretas de interes.
- `required_spanish_locations` indica en que ubicaciones el filtro debe rechazar ofertas claramente en ingles.
- `preferred_spanish_locations` indica donde el sistema debe priorizar resultados en espanol sin descartar automaticamente otros casos.
- `strict_english_rejection_locations` endurece el descarte de anuncios en ingles.
- `allow_mixed_language_locations` permite anuncios mixtos cuando siguen siendo utiles.
- `english_required_phrases` y `english_preferred_phrases` ayudan a detectar si el ingles es obligatorio o solo un plus.
- `spanish_markers` y `english_markers` mejoran la heuristica de idioma del anuncio.
