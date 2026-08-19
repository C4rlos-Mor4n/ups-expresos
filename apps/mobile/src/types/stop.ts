export interface Stop {
  id: string;
  name: string;
  reference: string | null;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface FavoriteStop {
  id: string;
  name: string;
  reference: string;
}
