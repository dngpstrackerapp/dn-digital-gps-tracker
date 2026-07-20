import { TripReport } from '../types';

/**
 * Single Source of Truth helper to derive whether a driver is online.
 * A driver is ONLINE if and only if they have an active trip report
 * where status is 'ongoing' and endTime is null (or undefined).
 */
export function isDriverOnline(reports: TripReport[], driverId: string): boolean {
  return reports.some(r => 
    r.driverId === driverId && 
    r.status === 'ongoing' && 
    (r.endTime === null || r.endTime === undefined || !r.endTime)
  );
}

/**
 * Shared helper to filter all active/ongoing trip reports.
 */
export function getActiveReports(reports: TripReport[]): TripReport[] {
  return reports.filter(r => 
    r.status === 'ongoing' && 
    (r.endTime === null || r.endTime === undefined || !r.endTime)
  );
}
