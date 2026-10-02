# UPS GO mobile design system

## Direction

**Campus wayfinding board.** UPS GO presents the transport service as an operational guide: a calm navy header establishes location and role, white surfaces make each next decision explicit, and gold is reserved for the one action or signal that deserves immediate attention.

The conceptual seed’s surreal gravity-garden assignment was declined on factual grounds: it would obscure a timetable’s spatial hierarchy and reduce native trust in a time-critical task. The explicit UPS GO brief therefore determines this implementation.

## Foundations

- **Platform:** adaptive Expo / React Native; native back behavior, safe areas and compact bottom tabs are preserved.
- **Type:** Inter is used consistently because it is already shipped and is legible in dense operational information.
- **Color roles:** #07508E is the interaction and header blue; deep navy anchors branded surfaces; white and cool gray create information layers; gold draws attention only to the primary action or an important operational detail.
- **Spacing:** 4-point rhythm; 16px cards; 44px or greater touch targets; thin outline *or* elevation, never both as visual noise.
- **Status semantics:** labels and icons always accompany color. Programado, Asignado, En recorrido and Finalizado are distinct but never rely on hue alone.

## Information architecture

- **Student:** Inicio → Campus → Línea → Salida → Asignación por bus y paradas.
- **Driver:** Inicio → Mis servicios → Detalle de asignación → Iniciar → Recorrido actual → Finalizar.
- **Profile:** a shared, minimal account surface with the active role and a safe logout action.
- **Unsupported mobile role:** informs the person that the role has no mobile operational surface instead of silently showing student data.

## State behavior

Skeletons preserve the page layout while loading. Empty states explain why there is no information for the selected date/role. Error states name the recovery action. Offline/network failures keep existing authenticated state but never fabricate timetable or operation data.

## Deliberate exclusions

No map-tracking simulation, ETA, real-time position, invented alerts, manual role picker or new admin controls are introduced. The API response remains the authority for state and ownership.

## Ilustraciones

- Carpeta `apps/mobile/assets/images/illustrations/` (`ill-*.png`), registradas en `src/components/visual.tsx`
  (`illustrations` + componente `Illustration`). Usar siempre el registro, no `require` sueltos.
- Origen: **unDraw** (undraw.co). Licencia: uso comercial y personal gratuito, sin atribución; no se permite
  redistribuirlas como pack. Están **recoloreadas** a la paleta UPS GO: `#6C63FF → #07508E` (azul primario),
  acentos `#FF6584 → #F2B635` (dorado) y grises a azul grisáceo.
- Para agregar una: descargar el SVG desde unDraw, recolorear con la misma tabla, exportar PNG de 720 px de ancho,
  recortar márgenes transparentes y registrar su relación de aspecto en `visual.tsx`.
- Uso: estados vacíos/errores (`InlineState illustration="empty"`), "no hay más salidas" (`noMore`),
  recorrido (`route`), "¿Dónde lo tomas?" (`myStop`), bus por asignar (`busStop`), Servicios (`services`),
  búsqueda sin resultados (`search`), aviso de nombre (`welcome`). `bus` es la ilustración propia del bus UPS GO.
- Interacción: tarjetas tocables con `PressableScale` (leve escala al presionar). Degradados con `BrandGradient`
  (SVG, sin módulos nativos nuevos).
- Fotos reales de campus: la selección de campus está lista para mostrarlas, pero solo con fotos oficiales de la
  universidad (las de Wikimedia disponibles son de la sede Cuenca).
