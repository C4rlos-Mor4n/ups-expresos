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
