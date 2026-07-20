export type UserRole = 'admin' | 'driver';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  vehiclePlate?: string;
  password?: string;
  createdAt: string;
}

export interface Driver {
  id: string;
  name: string;
  vehiclePlate: string;
  phone: string;
  status: 'active' | 'inactive' | 'offline';
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastActive: string | null;
  
  // New Admin Driver fields
  dob?: string;
  email?: string;
  password?: string;
  address?: string;
  vehicleNameType?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  emergencyContact?: string;
  companyName?: string;
}

export interface LocationLog {
  id: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speed: number; // in km/h
  timestamp: string;
}

export interface TripReport {
  id: string;
  driverId: string;
  driverName: string;
  vehiclePlate: string;
  date: string;
  startTime: string;
  endTime: string | null;
  startLocation: string;
  endLocation: string | null;
  distanceKm: number;
  status: 'completed' | 'ongoing';
  avgSpeed?: number;
  maxSpeed?: number;
  speedCount?: number;
  speedSum?: number;
}
