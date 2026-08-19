export interface Stop {
  id: string;
  name: string;
  reference: string;
  description?: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface FavoriteStop {
  id: string;
  name: string;
  reference: string;
}
