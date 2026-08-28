export interface CreateTripFeedbackInput {
  routeId: string;
  driverId?: string | null;
  rating: number;
  comment?: string;
  travelDate?: string;
}

export interface TripFeedback {
  id: string;
  userId: string;
  routeId: string;
  driverId: string | null;
  rating: number;
  comment: string | null;
  travelDate: string | null;
  createdAt: string;
}

export interface TripFeedbackPaginatedResponse {
  data: TripFeedback[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}