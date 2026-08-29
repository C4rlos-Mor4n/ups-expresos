# Phase 8 — Development stack

Tras el cierre de Fase 8, el checkout principal de desarrollo es `~/ups-expresos`:

```bash
cd ~/ups-expresos
./scripts/dev-stack.sh
```

El script inicia/reutiliza el emulador, API, Metro y el development client.
Para parar solo los servicios de ese checkout:

```bash
./scripts/dev-stack.sh --stop
```

El cierre ya no usa patrones `pkill` amplios. Resuelve el listener de cada
puerto y señaliza únicamente la cadena conocida de `pnpm start:dev` o Expo,
evitando que un watcher deje una API antigua viva y evitando afectar otros
worktrees.

Tras cambios de identidad o dependencias nativas:

```bash
./scripts/dev-stack.sh --rebuild
```

Para cambios TypeScript, UI o API no nativa, el APK instalado se reutiliza y
Metro carga el bundle actual.
