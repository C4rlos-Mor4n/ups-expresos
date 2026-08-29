# Phase 7 — Mobile Implementation

## Scope delivered locally

- UPS GO branding in the Expo display name, slug and deep-link scheme while retaining the existing iOS/Android package IDs for update compatibility.
- A role-aware Expo Router structure: Student, Driver and unsupported-role surfaces are separated before data is requested, including cross-role deep-link rejection.
- Student flow: home, campuses, lines, direction/date departures and per-bus departure detail with planned window and route-path stops.
- Driver flow: home, daily assignments, owned assignment detail, confirmed start, current run and confirmed finish.
- A single typed `operationalService` backed by the authenticated Axios client for every Phase 6 endpoint, with dependency-free runtime response checks before rendering.
- Unified visual tokens, accessible state badges, skeletons, empty/error/offline states and a shared profile/logout surface.
- A mechanical removal of dead mobile legacy screens, contexts, services, models, utilities, tests and their direct unused dependencies.

## Architecture

```text
AuthUser.role
  ├─ STUDENT → /(student)/(tabs)
  │              └─ campus → service line → scheduled departure → assignments
  ├─ DRIVER  → /(driver)/(tabs)
  │              └─ assignment → ServiceRun start/current/finish
  └─ other   → /unsupported-role

operationalService → existing Axios client → existing refresh + SecureStore session
```

`src/types/operational.ts` mirrors only the public mobile projections returned by Phase 6. No Prisma type, database model or server implementation is imported into the app.

## Native identity compatibility

- `name`, `slug` and `scheme` now identify UPS GO.
- The application IDs remain `ec.edu.ups.expresos`; changing them would create a new installed app rather than an update and is outside Phase 7.
- The splash background remains `#208AEF`, as previously requested.
- Android predictive Back is enabled; the new stack routes use native back navigation rather than a custom history implementation.

## Legacy / dead-code gate

| Item touched | Classification | Disposition |
| --- | --- | --- |
| `/mobile/*` client and screens | DEAD | Removed: new paths use only Phase 6 operational APIs. |
| `Trip`, `RouteAssignment`, `currentOperation` mobile projections | DEAD in mobile | Removed from mobile; backend contracts remain untouched. |
| Map / Leaflet WebView | DEAD | Removed with its direct WebView dependency. |
| Local route and stop favourites | DEAD | Removed with their AsyncStorage dependency. |
| Feedback flow | DEAD for Phase 7 | Removed because it was not part of the authorized operational flow. |
| Existing Axios + SecureStore auth and refresh | ACTIVE | Preserved and reused. |
| API package legacy endpoints | COMPATIBILITY outside mobile scope | Untouched; their server consumers must be audited separately before removal. |

No commented-out adapter, feature flag or parallel data client was introduced.

## Local developer commands

```bash
cd apps/mobile
npm ci
npm run verify
npm run android
```

Because the display/deep-link identity changed, an existing development client built for the previous scheme may need to be rebuilt with `npm run android` before it can open `exp+upsgo://` links.

## Validation evidence

On 2026-08-29, `npm run verify` passed (Expo lint, TypeScript and 46 Jest tests), Expo resolved the public UPS GO configuration, and `expo export --platform android` generated an Android JavaScript bundle successfully. A real local API health check returned HTTP 200 and `adb reverse` was active for ports 3000 and 8081.

The subsequent development-client installation reached Gradle but could not compile because the user’s Android SDK build-tools `36.0.0` installation is missing `aapt`. That environment repair is intentionally not part of this repository change.
