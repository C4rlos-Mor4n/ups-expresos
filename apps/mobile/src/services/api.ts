import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Creamos la instancia de Axios utilizando la variable de entorno
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://robust-strong-cattle.ngrok-free.app',
  timeout: 10000, // 10 segundos
  headers: {
    'ngrok-skip-browser-warning': 'true', // Omitir advertencia de ngrok
  }
});

// Interceptor para agregar el token a todas las solicitudes
api.interceptors.request.use(
  async (config) => {
    // 👇 Agrega esto
    console.log(
      `[${new Date().toISOString()}] ${config.method?.toUpperCase()} ${config.url}`,
      config.params
    );
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // SecureStore no disponible en web, ignorar silenciosamente
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de respuestas para refrescar el token si es necesario
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
          
          if (response.data && response.data.accessToken) {
            await SecureStore.setItemAsync('access_token', response.data.accessToken);
            await SecureStore.setItemAsync('refresh_token', response.data.refreshToken);
            
            originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        await SecureStore.deleteItemAsync('user');
        return Promise.reject(refreshError);
      }
    }
    if (error.response) {
      console.log("STATUS:", error.response.status);
      console.log("URL:", error.config?.url);
      console.log("PARAMS:", error.config?.params);
      console.log("BODY:", error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
