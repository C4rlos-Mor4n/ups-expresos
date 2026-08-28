import api from "../api/client";
import { CreateTripFeedbackInput, TripFeedback, TripFeedbackPaginatedResponse } from "../types/feedback";

export const tripFeedbackService = {
  /**
   * Envía la calificación de un viaje. rating debe estar entre 1 y 5.
   */
  submit: async (input: CreateTripFeedbackInput): Promise<TripFeedback> => {
    const response = await api.post<TripFeedback>('/trip-feedback', input);
    return response.data;
  },

  /**
   * Consulta el historial de calificaciones del usuario autenticado.
   */
  getHistory: async (params?: { page?: number; limit?: number }): Promise<TripFeedbackPaginatedResponse> => {
    const response = await api.get('/trip-feedback', { params });
    return response.data;
  },
};