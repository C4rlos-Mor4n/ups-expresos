import api from './api';
import { PaginatedResponse } from '../types/api';
import { Route, RouteDetailResponse, RouteStop, Schedule } from '../types/route';
import { Notice } from '../types/notice';

export const mobileService = {
  getRoutes: async (params?: { page?: number; limit?: number; status?: string; search?: string }): Promise<PaginatedResponse<Route>> => {
    const response = await api.get('/mobile/routes', { params });
    return response.data;
  },

  getRouteDetail: async (id: string): Promise<RouteDetailResponse> => {
    const response = await api.get(`/mobile/routes/${id}`);
    return response.data;
  },

  getRouteStops: async (id: string): Promise<RouteStop[]> => {
    const response = await api.get(`/mobile/routes/${id}/stops`);
    return response.data;
  },

  getRouteSchedules: async (id: string, params?: { dayOfWeek?: string; direction?: string }): Promise<Schedule[]> => {
    const response = await api.get(`/mobile/routes/${id}/schedules`, { params });
    return response.data;
  },

  getNotices: async (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Notice>> => {
    const response = await api.get('/mobile/notices', { params });
    return response.data;
  },
};
