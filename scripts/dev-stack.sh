#!/usr/bin/env bash
# =============================================================================
# UPS GO — Dev Stack launcher (WSL + emulador Windows)
#
# Levanta el stack completo para probar la app en el emulador:
#   1. Base de datos (Docker Desktop en Windows -> postgres en 5432)
#   2. Emulador Android (AVD Medium_Phone, corre en Windows)
#   3. API NestJS (WSL, puerto 3000)
#   4. Metro bundler (WSL, puerto 8081)
#   5. Instala y lanza la app dev-client en el emulador
#
# Uso:
#   scripts/dev-stack.sh            # levanta el stack con el código actual
#   scripts/dev-stack.sh --rebuild  # regenera Android y recompila el APK
#   scripts/dev-stack.sh --stop     # detiene API y Metro
#   scripts/dev-stack.sh --status   # muestra el estado de cada servicio
#
# Nota: si android/ no existe, genera la configuración nativa de UPS GO antes
# de compilar e instalar el dev-client.
# =============================================================================

set -u

# ── Configuración ────────────────────────────────────────────────────────────
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$REPO/apps/api"
MOBILE_DIR="$REPO/apps/mobile"
ANDROID_DIR="$MOBILE_DIR/android"
API_ENV_FILE="${API_ENV_FILE:-$API_DIR/.env}"

JAVA_HOME="${JAVA_HOME:-$HOME/jdk/jdk-21.0.12.1+1}"
ANDROID_SDK_LINUX="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/android-sdk}}"
ANDROID_SDK_WINDOWS="${ANDROID_SDK_WINDOWS:-}"
if [ -z "$ANDROID_SDK_WINDOWS" ]; then
  for CANDIDATE_SDK in /mnt/c/Users/*/AppData/Local/Android/Sdk; do
    if [ -d "$CANDIDATE_SDK" ]; then
      ANDROID_SDK_WINDOWS="$CANDIDATE_SDK"
      break
    fi
  done
fi
ADB_WIN="$ANDROID_SDK_WINDOWS/platform-tools/adb.exe"
EMULATOR_BIN="$ANDROID_SDK_WINDOWS/emulator/emulator.exe"
AVD_NAME="${UPS_GO_AVD_NAME:-Medium_Phone}"
APP_PACKAGE="ec.edu.ups.expresos"
WSL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
API_URL="http://${WSL_IP:-localhost}:3000"
METRO_URL="http://${WSL_IP:-localhost}:8081"
DEV_SCHEME="exp+ups-go://expo-development-client/?url=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$METRO_URL'))" 2>/dev/null || echo "http%3A%2F%2F172.29.112.25%3A8081")"
AAPT_BIN="$ANDROID_SDK_LINUX/build-tools/36.0.0/aapt"
REBUILD=0

LOG_DIR="$REPO/.logs"
mkdir -p "$LOG_DIR"
API_LOG="$LOG_DIR/api.log"
METRO_LOG="$LOG_DIR/metro.log"

export JAVA_HOME
export PATH="$JAVA_HOME/bin:$HOME/bin:$ANDROID_SDK_LINUX/platform-tools:$PATH"

# ── Helpers ──────────────────────────────────────────────────────────────────
c_green() { printf '\033[32m%s\033[0m\n' "$1"; }
c_yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
c_red() { printf '\033[31m%s\033[0m\n' "$1"; }
c_cyan() { printf '\033[36m%s\033[0m\n' "$1"; }

port_open() { ss -tln 2>/dev/null | grep -q ":$1 " ; }
log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$1"; }
apk_package() { "$AAPT_BIN" dump badging "$1" 2>/dev/null | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -1; }

database_port() {
  local PORT
  PORT="$(sed -n 's|^DATABASE_URL=.*:\([0-9][0-9]*\)/.*|\1|p' "$API_ENV_FILE" 2>/dev/null | head -1)"
  printf '%s\n' "${PORT:-5432}"
}

DB_PORT="$(database_port)"

require_android_tooling() {
  if [ ! -x "$ADB_WIN" ] || [ ! -x "$EMULATOR_BIN" ]; then
    c_red "No se encontró Android SDK de Windows. Define ANDROID_SDK_WINDOWS o instala el SDK."
    return 1
  fi
  if [ ! -x "$AAPT_BIN" ]; then
    c_red "No se encontró aapt en $AAPT_BIN. Define ANDROID_SDK_ROOT o instala build-tools 36.0.0."
    return 1
  fi
}

# Devuelve el proceso que escucha el puerto. Si no se puede resolver, se
# considera inseguro reutilizarlo: podría pertenecer a otro checkout.
listener_pid() {
  ss -ltnp "sport = :$1" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -1
}

listener_owned_by() {
  local PORT="$1"
  local EXPECTED_CWD="$2"
  local PID CWD
  PID="$(listener_pid "$PORT")"
  if [ -z "$PID" ]; then
    c_red "No se pudo identificar el proceso que escucha en $PORT. No se reutilizará."
    return 1
  fi
  CWD="$(readlink -f "/proc/$PID/cwd" 2>/dev/null || true)"
  if [[ "$CWD" != "$EXPECTED_CWD" && "$CWD" != "$EXPECTED_CWD/"* ]]; then
    c_red "El puerto $PORT pertenece a otro checkout: ${CWD:-desconocido}."
    c_red "Detén ese proceso desde su checkout antes de continuar."
    return 1
  fi
}

stop_owned_listener() {
  local PORT="$1"
  local EXPECTED_CWD="$2"
  local LABEL="$3"
  local PID

  port_open "$PORT" || return 0
  listener_owned_by "$PORT" "$EXPECTED_CWD" || return 1
  PID="$(listener_pid "$PORT")"
  log "Deteniendo $LABEL del checkout actual (pid $PID)..."
  kill "$PID" 2>/dev/null || return 1
  for _ in $(seq 1 10); do
    port_open "$PORT" || return 0
    sleep 1
  done
  c_yellow "$LABEL aún escucha en $PORT; no se matará ningún proceso adicional."
  return 1
}

api_needs_build() {
  [ "$REBUILD" = "1" ] || [ ! -f "$API_DIR/dist/main.js" ] || find "$API_DIR/src" -type f -newer "$API_DIR/dist/main.js" -print -quit | grep -q .
}

# Actualiza EXPO_PUBLIC_API_URL del .env con la IP actual de WSL (puede cambiar entre reinicios).
# Pone ENV_CHANGED=1 si el .env fue modificado (Metro debe reiniciarse para tomarlo).
ENV_CHANGED=0
sync_env_ip() {
  local ENV_FILE="$MOBILE_DIR/.env"
  if [ -z "$WSL_IP" ]; then
    c_yellow "No se pudo detectar la IP de WSL. El .env quedará como esté."
    return
  fi
  if [ -f "$ENV_FILE" ]; then
    local CURRENT
    CURRENT=$(grep '^EXPO_PUBLIC_API_URL=' "$ENV_FILE" | head -1)
    local NEW="EXPO_PUBLIC_API_URL=http://${WSL_IP}:3000"
    if [ "$CURRENT" != "$NEW" ]; then
      sed -i "s|^EXPO_PUBLIC_API_URL=.*|$NEW|" "$ENV_FILE"
      ENV_CHANGED=1
      log "EXPO_PUBLIC_API_URL actualizado → http://${WSL_IP}:3000"
    fi
  fi
}

# ── 0. Estado ────────────────────────────────────────────────────────────────
status() {
  echo "── Estado del stack ────────────────────────────────"
  echo "WSL IP: ${WSL_IP:-?}"
  port_open "$DB_PORT" && c_green "  BD ($DB_PORT):          UP" || c_red "  BD ($DB_PORT):          DOWN"
  local SERIAL=$("$ADB_WIN" devices 2>/dev/null | tr -d '\r' | awk '$2=="device"{print $1; exit}')
  [ -n "$SERIAL" ] && c_green "  Emulador:           UP ($SERIAL)" || c_red "  Emulador:           DOWN"
  port_open 3000 && c_green "  API (3000):         UP" || c_red "  API (3000):         DOWN"
  port_open 8081 && c_green "  Metro (8081):       UP" || c_red "  Metro (8081):       DOWN"
  "$ADB_WIN" shell pm list packages 2>/dev/null | grep -q "$APP_PACKAGE" && c_green "  App instalada:      SÍ" || c_red "  App instalada:      NO"
  echo "──────────────────────────────────────────────────"
}

# ── 1. Base de datos ─────────────────────────────────────────────────────────
start_db() {
  if port_open "$DB_PORT"; then log "BD ya está en el puerto $DB_PORT"; return 0; fi
  local DB_CONTAINER="${UPS_GO_DB_CONTAINER:-ups-go-postgres}"
  log "BD no responde en $DB_PORT. Intentando iniciar contenedor UPS GO: $DB_CONTAINER..."
  if command -v docker >/dev/null 2>&1; then
    docker start "$DB_CONTAINER" >/dev/null 2>&1 || true
  elif command -v docker.exe >/dev/null 2>&1; then
    docker.exe start "$DB_CONTAINER" >/dev/null 2>&1 || true
  fi
  for i in $(seq 1 30); do
    port_open "$DB_PORT" && { log "BD lista (postgres en $DB_PORT)"; return 0; }
    sleep 5
  done
  c_red "No se pudo levantar la BD ($DB_PORT). Inicia PostgreSQL de UPS GO o define UPS_GO_DB_CONTAINER."
  return 1
}

# ── 2. Emulador ──────────────────────────────────────────────────────────────
start_emulator() {
  require_android_tooling || return 1
  if "$ADB_WIN" get-state >/dev/null 2>&1; then
    log "Emulador ya activo: $("$ADB_WIN" devices 2>/dev/null | tr -d '\r' | awk '$2=="device"{print $1; exit}')"
    return 0
  fi
  log "Lanzando emulador AVD=$AVD_NAME (puede tardar 30-60s)..."
  ( cd "$ANDROID_SDK_WINDOWS/emulator" && setsid "$EMULATOR_BIN" -avd "$AVD_NAME" -no-snapshot-load \
      </dev/null >"$LOG_DIR/emulator.log" 2>&1 & disown )
  for i in $(seq 1 30); do
    if "$ADB_WIN" get-state >/dev/null 2>&1; then
      local BOOT
      for j in $(seq 1 20); do
        BOOT="$("$ADB_WIN" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
        [ "$BOOT" = "1" ] && { log "Emulador booteado ✅"; return 0; }
        sleep 5
      done
    fi
    sleep 5
  done
  c_red "El emulador no arrancó. Revisa $LOG_DIR/emulator.log"
  return 1
}

# ── 3. API ───────────────────────────────────────────────────────────────────
start_api() {
  if port_open 3000; then
    listener_owned_by 3000 "$API_DIR" || return 1
    if ! api_needs_build; then
      log "API ya corre en 3000 desde este checkout"
      return 0
    fi
    log "La API actual requiere recompilación; reiniciando su proceso..."
    stop_owned_listener 3000 "$API_DIR" "API" || return 1
  fi
  if api_needs_build; then
    c_yellow "Compilando API actual..."
    ( cd "$API_DIR" && pnpm run build )
  fi
  log "Arrancando API (puerto 3000)..."
  ( cd "$API_DIR" && setsid bash -c "cd '$API_DIR' && exec node dist/main.js" </dev/null >"$API_LOG" 2>&1 & disown )
  for i in $(seq 1 20); do
    port_open 3000 && { log "API lista ✅ (http://${WSL_IP}:3000)"; return 0; }
    sleep 3
  done
  c_red "La API no arrancó. Revisa $API_LOG"
  tail -5 "$API_LOG" 2>/dev/null
  return 1
}

# ── 4. Metro ─────────────────────────────────────────────────────────────────
start_metro() {
  if port_open 8081 && [ "$ENV_CHANGED" = "0" ]; then
    listener_owned_by 8081 "$MOBILE_DIR" || return 1
    log "Metro ya corre en 8081 desde este checkout"
    return 0
  fi
  if port_open 8081 && [ "$ENV_CHANGED" = "1" ]; then
    c_yellow "El .env cambió (nueva IP). Reiniciando Metro..."
    stop_owned_listener 8081 "$MOBILE_DIR" "Metro" || return 1
  fi
  log "Arrancando Metro (puerto 8081)..."
  ( cd "$MOBILE_DIR" && setsid bash -c "cd '$MOBILE_DIR' && exec npx expo start --dev-client --port 8081 --clear" </dev/null >"$METRO_LOG" 2>&1 & disown )
  for i in $(seq 1 30); do
    port_open 8081 && { log "Metro listo ✅ (http://${WSL_IP}:8081)"; return 0; }
    sleep 3
  done
  c_red "Metro no arrancó. Revisa $METRO_LOG"
  return 1
}

# ── 5. adb reverse + app ─────────────────────────────────────────────────────
launch_app() {
  require_android_tooling || return 1
  log "Configurando adb reverse (8081, 3000)..."
  "$ADB_WIN" reverse tcp:8081 tcp:8081
  "$ADB_WIN" reverse tcp:3000 tcp:3000

  local APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
  if [ "$REBUILD" = "1" ]; then
    c_yellow "Regenerando Android desde app.json..."
    ( cd "$MOBILE_DIR" && npx expo prebuild --platform android --no-install --clean ) || return 1
  fi
  if ! "$ADB_WIN" shell pm list packages 2>/dev/null | grep -q "$APP_PACKAGE" || [ "$REBUILD" = "1" ]; then
    if [ ! -d "$ANDROID_DIR" ]; then
      c_yellow "Proyecto Android no existe. Generando configuración nativa de UPS GO..."
      ( cd "$MOBILE_DIR" && npx expo prebuild --platform android --no-install )
    fi
    if [ "$REBUILD" = "1" ] || [ ! -f "$APK" ] || [ "$(apk_package "$APK")" != "$APP_PACKAGE" ]; then
      if [ -f "$APK" ]; then
        c_yellow "APK existente no corresponde a $APP_PACKAGE. Recompilando..."
      fi
      c_yellow "Compilando APK de UPS GO (Gradle, usa SDK Linux)..."
      if [ ! -f "$ANDROID_DIR/local.properties" ]; then
        printf 'sdk.dir=%s\n' "$ANDROID_SDK_LINUX" > "$ANDROID_DIR/local.properties"
      fi
      ( cd "$ANDROID_DIR" && ./gradlew app:assembleDebug -x lint -x test -PreactNativeArchitectures=x86_64 )
    fi
    log "Instalando app..."
    "$ADB_WIN" install -r "$APK"
  fi

  log "Lanzando app (dev-client)..."
  "$ADB_WIN" shell am start -a android.intent.action.VIEW -d "$DEV_SCHEME"
  log "App lanzada. Espera a que cargue el bundle JS desde Metro."
}

# ── Stop ─────────────────────────────────────────────────────────────────────
stop() {
  log "Deteniendo solamente Metro y API de este checkout..."
  local STOP_FAILED=0
  stop_owned_listener 8081 "$MOBILE_DIR" "Metro" || STOP_FAILED=1
  stop_owned_listener 3000 "$API_DIR" "API" || STOP_FAILED=1
  port_open 3000 && c_yellow "  API aún en 3000" || c_green "  API detenido"
  port_open 8081 && c_yellow "  Metro aún en 8081" || c_green "  Metro detenido"
  return "$STOP_FAILED"
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
  case "${1:-}" in
    --stop)   stop ;;
    --status) status ;;
    --rebuild)
      REBUILD=1
      status
      echo ""
      c_cyan "▶ Reconstruyendo stack..."
      sync_env_ip
      start_db || exit 1
      start_emulator || exit 1
      start_api || exit 1
      start_metro || exit 1
      launch_app
      echo ""
      status
      c_cyan "▶ Reconstrucción lista."
      ;;
    -h|--help)
      sed -n '1,24p' "$0" | sed 's/^# \{0,1\}//'
      ;;
    *)
      status
      echo ""
      c_cyan "▶ Levantando stack..."
      sync_env_ip
      start_db        || exit 1
      start_emulator  || exit 1
      start_api       || exit 1
      start_metro     || exit 1
      launch_app
      echo ""
      status
      c_cyan "▶ Todo listo. La app debería estar abriéndose en el emulador."
      c_cyan "▶ API en ${API_URL}  ·  Metro en ${METRO_URL}"
      ;;
  esac
}

main "$@"
