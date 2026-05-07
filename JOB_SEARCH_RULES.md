# Job Search Rules

## 1. Proposito

Este CLI no esta limitado a ofertas de desarrollo de software. La misma logica de busqueda puede adaptarse a cualquier area profesional si ajustas bien las palabras clave y revisas manualmente los resultados.

Areas comunes donde puede usarse:

- desarrollo de software
- marketing
- diseno
- atencion al cliente
- ventas
- administrativo
- operaciones
- recursos humanos
- analisis de datos
- soporte tecnico

La clave no es el sector, sino definir bien que tipo de oferta quieres encontrar y cuales quieres evitar.

## 2. Configuracion De Busqueda

La busqueda debe construirse con terminos concretos. Conviene combinar:

- rol principal
- seniority o nivel
- especialidad
- modalidad o ubicacion

Elementos que puedes cambiar:

- `keywords`: termino principal de busqueda
- rol: nombre del puesto
- tecnologias o herramientas: si aplican
- ubicacion: remoto, ciudad o pais

Ejemplos utiles de keywords:

- `nodejs backend`
- `marketing digital junior`
- `asistente administrativo`
- `customer support remote`
- `ux ui designer junior`
- `sales development representative`
- `data analyst entry level`

Buenas combinaciones:

- `backend developer remote`
- `frontend react junior madrid`
- `marketing digital practicas`
- `customer support english remote`
- `administrative assistant bogota`

Consejos practicos:

- Usa entre 2 y 5 terminos por busqueda.
- Si la busqueda es muy amplia, anade nivel o ubicacion.
- Si es muy estrecha, elimina una tecnologia o cambia el rol a un termino mas general.
- Si buscas remoto, incluye `remote` o `remoto` en la keyword cuando tenga sentido.
- Si buscas por ciudad o pais, prueba variantes en ingles y en espanol.

## 3. Definicion De Perfil Del Usuario

Antes de hacer scraping, define un perfil claro. Eso evita perder tiempo revisando ofertas irrelevantes.

Plantilla recomendada:

```yaml
roles:
  - backend developer
  - fullstack developer

level:
  - junior
  - mid

skills:
  - nodejs
  - javascript
  - sql
  - api rest

positive_keywords:
  - remote
  - trainee
  - early career
  - junior

negative_keywords:
  - senior
  - 5+ years
  - manager
  - director
  - principal
```

Como definir cada bloque:

- `roles`: puestos a los que realmente aplicarias
- `level`: nivel realista segun tu experiencia
- `skills`: herramientas, idiomas o capacidades que si puedes defender
- `positive_keywords`: senales de que una oferta encaja contigo
- `negative_keywords`: senales claras para descartarla rapido

Ejemplo para marketing:

```yaml
roles:
  - marketing digital junior
  - social media assistant
  - content marketing

level:
  - junior

skills:
  - meta ads
  - google analytics
  - copywriting
  - canva

positive_keywords:
  - junior
  - assistant
  - trainee
  - growth

negative_keywords:
  - senior
  - lead
  - 4+ years
  - head of marketing
```

Ejemplo para atencion al cliente:

```yaml
roles:
  - customer support
  - customer success associate
  - support specialist

level:
  - entry level
  - junior

skills:
  - english
  - crm
  - communication
  - ticketing

positive_keywords:
  - remote
  - onboarding
  - chat support

negative_keywords:
  - sales quota
  - manager
  - senior
```

## 4. Filtros Recomendados

Para que el sistema sea util de verdad, no basta con descargar ofertas. Hay que filtrarlas con criterio.

Buenas practicas:

- Evita ofertas demasiado senior si tu perfil no encaja.
- Descarta ofertas que pidan demasiadas responsabilidades para un puesto junior.
- Prioriza ofertas recientes.
- Revisa si el mismo puesto aparece duplicado en varias plataformas o versiones.
- Desconfia de titulos vagos como `rockstar`, `ninja` o `all-in-one` cuando esconden exceso de tareas.
- Revisa si el rol coincide con la descripcion real. A veces el titulo dice una cosa y la oferta pide otra.

Senales de alerta utiles:

- piden 3-5 anos para un puesto junior
- mezclan tareas de varios puestos en uno solo
- no explican salario, equipo ni responsabilidades
- parecen publicaciones recicladas o repetidas
- usan demasiados requisitos excluyentes sin contexto

Senales positivas:

- descripcion concreta del dia a dia
- stack o herramientas claras
- requisitos razonables para el nivel
- modalidad y ubicacion bien definidas
- fecha reciente de publicacion

## 5. Estrategia De Aplicacion

Aplicar mejor suele dar mas resultado que aplicar mas.

Estrategia recomendada:

- Aplica a 5-10 ofertas diarias bien elegidas.
- Prioriza calidad sobre cantidad.
- Lee la oferta completa antes de aplicar.
- Revisa si de verdad cumples al menos una parte razonable del perfil.
- Personaliza el mensaje aunque sea en una o dos lineas.

Regla practica:

- Si la oferta encaja en rol, nivel y al menos parte de tus skills, merece revision manual.
- Si falla en dos o tres criterios clave, descartala y sigue.

Mini estructura para personalizar una aplicacion:

1. Menciona el rol exacto.
2. Di en una frase por que encajas.
3. Destaca una skill relevante.
4. Cierra con interes claro y directo.

Ejemplo corto:

```text
Me interesa la posicion de Customer Support Associate. Tengo experiencia atendiendo usuarios por chat y email, manejo herramientas tipo CRM y puedo trabajar en ingles. Creo que encajo bien por mi perfil orientado a soporte y comunicacion.
```

## 6. Buenas Practicas

- No hagas scraping agresivo.
- Evita automatizar aplicaciones masivas.
- Revisa manualmente cada oferta antes de aplicar.
- Usa el sistema como asistente, no como reemplazo de criterio humano.
- Ajusta keywords y filtros cada pocos dias segun la calidad de los resultados.
- Guarda solo ofertas que realmente valga la pena revisar o seguir.

Esto reduce ruido, evita perder tiempo y baja el riesgo de terminar aplicando a puestos que no encajan.

## 7. Ejemplos De Uso

### Buscar Trabajo Como Desarrollador

Objetivo:

- backend o fullstack junior/mid

Keywords sugeridas:

- `nodejs backend`
- `backend developer remote`
- `fullstack javascript junior`

Positive keywords:

- `junior`
- `remote`
- `api`
- `nodejs`

Negative keywords:

- `senior`
- `staff`
- `principal`
- `manager`

### Buscar Trabajo En Marketing

Objetivo:

- marketing digital junior o content marketing

Keywords sugeridas:

- `marketing digital junior`
- `content marketing remote`
- `social media assistant`

Positive keywords:

- `junior`
- `campaigns`
- `content`
- `seo`

Negative keywords:

- `head of marketing`
- `director`
- `5+ years`

### Buscar Trabajo Remoto Sin Experiencia

Objetivo:

- puestos entry-level o junior con onboarding claro

Keywords sugeridas:

- `customer support remote`
- `virtual assistant junior`
- `data entry remote`
- `administrative assistant remote`

Positive keywords:

- `entry level`
- `training`
- `junior`
- `remote`

Negative keywords:

- `senior`
- `supervisor`
- `team lead`
- `3+ years`

## 8. Formato De Trabajo Recomendado

Para usar este CLI de forma consistente:

1. Define tu perfil real.
2. Elige una keyword concreta.
3. Ejecuta la busqueda.
4. Lista resultados y revisa manualmente.
5. Marca como aplicadas o ignoradas las ofertas revisadas.
6. Ajusta keywords segun la calidad de lo que aparezca.

Ejemplo de iteracion util:

1. Buscas `marketing digital junior`.
2. Ves demasiadas ofertas senior.
3. Cambias a `marketing assistant remote`.
4. Encuentras resultados mas alineados.
5. Guardas solo las que encajan y descartas el resto.

## Resumen Practico

Este proyecto sirve mejor cuando:

- defines un objetivo laboral concreto
- eliges keywords utiles
- filtras con criterio
- revisas manualmente antes de aplicar
- mantienes un ritmo de aplicacion sostenible

La herramienta debe ayudarte a encontrar mejores oportunidades, no a aplicar sin pensar.
