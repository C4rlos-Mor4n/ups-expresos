// La validación de configuración del cliente HTTP es fail-fast: si falta
// EXPO_PUBLIC_API_URL, el módulo lanza un error explícito. Para los tests
// definimos un valor válido de antemano.
process.env.EXPO_PUBLIC_API_URL = "https://api.example.com";
