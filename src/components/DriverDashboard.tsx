import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, MapPin, ClipboardList, User,
  Play, Square, Compass, RefreshCw, Radio,
  Clock, Map, Shield, Phone, Truck, AlertCircle
} from 'lucide-react';
import { UserProfile, TripReport } from '../types';
import { fetchApi } from '../lib/api';

interface DriverDashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onProfileUpdate?: (updatedUser: UserProfile) => void;
}

export default function DriverDashboard({ user, onLogout, onProfileUpdate }: DriverDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'location' | 'summary' | 'profile'>('dashboard');
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [activeTrip, setActiveTrip] = useState<TripReport | null>(null);
  
  // Real Geolocation or Emulated coordinates
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'locked' | 'error' | 'emulated'>('acquiring');
  
  // Emulation toggles for demoing GPS movement
  const [isEmulating, setIsEmulating] = useState(false);
  const [transmissionLogs, setTransmissionLogs] = useState<string[]>([]);
  const [shiftDuration, setShiftDuration] = useState(0);
  
  // Profile Forms
  const [profileName, setProfileName] = useState(user.name);
  const [profilePhone, setProfilePhone] = useState(user.phone || '');
  const [profilePlate, setProfilePlate] = useState(user.vehiclePlate || '');
  // Action Error/Success feedback states (replacing window.alert)
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardSuccess, setDashboardSuccess] = useState<string | null>(null);

  // Summary list
  const [myTrips, setMyTrips] = useState<TripReport[]>([]);

  const watchIdRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);

  // Load Driver Shift and Report History
  const fetchMyHistory = async () => {
    try {
      const res = await fetchApi('/api/reports');
      const data = await res.json();
      const filtered = data.filter((r: TripReport) => r.driverId === user.id);
      setMyTrips(filtered);
      
      const ongoing = filtered.find((r: TripReport) => r.status === 'ongoing');
      if (ongoing) {
        setIsShiftActive(true);
        setActiveTrip(ongoing);
      }
    } catch (err) {
      console.error('Error fetching driver history:', err);
    }
  };

  useEffect(() => {
    fetchMyHistory();

    // Always load the logged-in driver's latest profile details directly from Firestore
    const syncProfileFromFirestore = async () => {
      try {
        const res = await fetchApi(`/api/profile/${user.id}`);
        if (res.ok) {
          const freshData = await res.json();
          setProfileName(freshData.name || '');
          setProfilePhone(freshData.phone || '');
          setProfilePlate(freshData.vehiclePlate || '');
        }
      } catch (err) {
        console.error('Failed to sync profile from Firestore:', err);
      }
    };
    syncProfileFromFirestore();
  }, [user.id]);

  // Log transmitter log helper
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTransmissionLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  // Shift Timer / Clock
  useEffect(() => {
    if (isShiftActive) {
      if (activeTrip?.startTime) {
        const start = new Date(activeTrip.startTime).getTime();
        durationIntervalRef.current = setInterval(() => {
          setShiftDuration(Math.floor((Date.now() - start) / 1000));
        }, 1000);
      }
    } else {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      setShiftDuration(0);
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [isShiftActive, activeTrip]);

  // Handle Geolocation Watcher
  useEffect(() => {
    if (isShiftActive && !isEmulating) {
      if ('geolocation' in navigator) {
        setGpsStatus('acquiring');
        addLog('Requesting Core GPS Hardware Lock...');
        
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            setLatitude(pos.coords.latitude);
            setLongitude(pos.coords.longitude);
            // speed is in m/s, convert to km/h
            const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
            setSpeed(speedKmh);
            setGpsStatus('locked');
            addLog(`GPS Fixed • Precision ±${Math.round(pos.coords.accuracy)}m`);
          },
          (err) => {
            console.error('GPS Watch Error:', err);
            setGpsStatus('error');
            addLog('GPS Access Denied or Timed Out. Switched to Emulated signals.');
            // Fallback to static base
            setLatitude(30.2672);
            setLongitude(-97.7431);
            setIsEmulating(true);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      } else {
        setGpsStatus('error');
        addLog('No browser GPS hardware found. Emulating telemetry.');
        setLatitude(30.2672);
        setLongitude(-97.7431);
        setIsEmulating(true);
      }
    } else {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isShiftActive, isEmulating]);

  // GPS Signal Transmitter interval
  useEffect(() => {
    if (isShiftActive && latitude !== null && longitude !== null) {
      const transmitGPS = async () => {
        try {
          const res = await fetchApi('/api/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverId: user.id,
              latitude,
              longitude,
              speed
            })
          });
          
          if (res.ok) {
            addLog(`Telemetry Sent OK • Speed ${speed} km/h`);
          } else {
            addLog('Telemetry Rejected • Server response failed');
          }
        } catch (err) {
          addLog('Telemetry Failed • Signal Connection timeout');
        }
      };

      // Instantly transmit first coordinate
      transmitGPS();

      // Transmit periodically every 8s
      pingIntervalRef.current = setInterval(transmitGPS, 8000);
    } else {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    }

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [isShiftActive, latitude, longitude, speed, user.id]);

  // Simulation drift interval (if emulating)
  useEffect(() => {
    let emulationInterval: any = null;
    if (isShiftActive && isEmulating) {
      setGpsStatus('emulated');
      emulationInterval = setInterval(() => {
        setLatitude(prev => {
          if (!prev) return 30.2672;
          // Add a tiny coordinate offset to simulate moving down a road
          const offset = (Math.random() - 0.3) * 0.0004;
          return Number((prev + offset).toFixed(6));
        });
        setLongitude(prev => {
          if (!prev) return -97.7431;
          const offset = (Math.random() - 0.2) * 0.0004;
          return Number((prev + offset).toFixed(6));
        });
        setSpeed(Math.floor(45 + Math.random() * 25)); // Emulate normal truck speed
      }, 4000);
    } else {
      if (emulationInterval) clearInterval(emulationInterval);
    }
    return () => {
      if (emulationInterval) clearInterval(emulationInterval);
    };
  }, [isShiftActive, isEmulating]);

  // Start Shift Trigger
  const handleStartShift = async () => {
    setDashboardError(null);
    setDashboardSuccess(null);
    try {
      const res = await fetchApi('/api/reports/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: user.id,
          driverName: user.name,
          vehiclePlate: profilePlate,
          startLocation: 'Satellite Terminal'
        })
      });

      if (!res.ok) throw new Error('Start failed');
      const trip = await res.json();
      
      setActiveTrip(trip);
      setIsShiftActive(true);
      addLog('System Online • Shift initialized');
      setDashboardSuccess('Shift tracking successfully started.');
    } catch (err) {
      setDashboardError('Failed to initialize shift with server.');
    }
  };

  // Stop Shift Trigger
  const handleStopShift = async () => {
    setDashboardError(null);
    setDashboardSuccess(null);
    try {
      const res = await fetchApi('/api/reports/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: user.id,
          endLocation: 'Shift Terminated'
        })
      });

      if (!res.ok) throw new Error('Stop failed');
      
      setIsShiftActive(false);
      setActiveTrip(null);
      setLatitude(null);
      setLongitude(null);
      setSpeed(0);
      setGpsStatus('acquiring');
      addLog('System Offline • Shift Terminated');
      setDashboardSuccess('Shift tracking successfully completed.');
      fetchMyHistory();
    } catch (err) {
      setDashboardError('Failed to stop shift on server.');
    }
  };

  // Helper to format duration seconds to HH:MM:SS
  const formatDuration = (sec: number) => {
    const hrs = Math.floor(sec / 3600).toString().padStart(2, '0');
    const mins = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const secs = (sec % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden relative">
      
      {/* Sub-header detailing current state */}
      <div className="bg-white border-b border-slate-100 py-3.5 px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg">
            {activeTab === 'dashboard' && <LayoutDashboard size={18} />}
            {activeTab === 'location' && <Compass size={18} />}
            {activeTab === 'summary' && <ClipboardList size={18} />}
            {activeTab === 'profile' && <User size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 capitalize">
              {activeTab === 'location' ? 'Live Telemetry' : activeTab}
            </h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Driver Workspace
            </p>
          </div>
        </div>

        {/* Pulsing signal on header if actively tracking */}
        {isShiftActive && (
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
            <Radio size={12} className="animate-pulse" />
            <span>TRANSMITTING</span>
          </div>
        )}
      </div>

      {/* Primary scroll area */}
      <div className="flex-1 overflow-y-auto p-5 pb-8">
        {dashboardError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-[10px] font-semibold border border-red-100 flex justify-between items-center">
            <span>{dashboardError}</span>
            <button onClick={() => setDashboardError(null)} className="text-red-400 hover:text-red-600 font-bold ml-2">X</button>
          </div>
        )}

        {dashboardSuccess && (
          <div className="mb-4 bg-emerald-50 text-emerald-600 p-3 rounded-xl text-[10px] font-semibold border border-emerald-100 flex justify-between items-center">
            <span>{dashboardSuccess}</span>
            <button onClick={() => setDashboardSuccess(null)} className="text-emerald-400 hover:text-emerald-600 font-bold ml-2">X</button>
          </div>
        )}

        {/* ==========================================
            TAB: DASHBOARD
           ========================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            {/* Main Shift control panel card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-5 text-center">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                  Shift Tracker
                </span>
                
                {isShiftActive ? (
                  <div className="space-y-1">
                    <span className="text-3xl font-black text-slate-800 font-mono">
                      {formatDuration(shiftDuration)}
                    </span>
                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                      Shift in progress
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-3xl font-black text-slate-300 font-mono">
                      00:00:00
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Off Duty Status
                    </p>
                  </div>
                )}
              </div>

              {/* Big primary CTA Button */}
              {isShiftActive ? (
                <button
                  onClick={handleStopShift}
                  className="w-full bg-red-600 hover:bg-red-700 text-white rounded-2xl py-4 font-bold text-sm transition-all flex items-center justify-center gap-2.5 shadow-md active:scale-[0.98] cursor-pointer"
                >
                  <Square size={16} fill="white" /> Stop Tracking Shift
                </button>
              ) : (
                <button
                  onClick={handleStartShift}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-bold text-sm transition-all flex items-center justify-center gap-2.5 shadow-md active:scale-[0.98] cursor-pointer"
                >
                  <Play size={16} fill="white" /> Start Tracking Shift
                </button>
              )}
            </div>

            {/* Vehicle Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                  <Truck size={20} />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Unit</span>
                  <span className="text-sm font-extrabold text-slate-800 uppercase font-mono">{profilePlate || 'Not Set'}</span>
                </div>
              </div>
              
              <div className="text-right">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Unit Class</span>
                <span className="text-xs font-bold text-slate-600">Light Duty Delivery</span>
              </div>
            </div>

            {/* Shift Analytics Progress */}
            {isShiftActive && (
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Shift Statistics</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Logged Distance</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono">{activeTrip?.distanceKm || 0} km</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Est. Transmission Count</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono">{transmissionLogs.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB: LOCATION (COCKPIT HUD)
           ========================================== */}
        {activeTab === 'location' && (
          <div className="space-y-4">
            {/* Live GPS Telemetry Grid */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    !isShiftActive 
                      ? 'bg-slate-600'
                      : gpsStatus === 'locked'
                      ? 'bg-emerald-500 animate-pulse'
                      : gpsStatus === 'emulated'
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-amber-500 animate-pulse'
                  }`}></span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    GPS Receiver Status: {gpsStatus}
                  </span>
                </div>

                {isShiftActive && (
                  <button
                    onClick={() => setIsEmulating(!isEmulating)}
                    className="text-[9px] text-blue-400 font-bold hover:underline"
                  >
                    {isEmulating ? 'Use Real GPS' : 'Emulate Drive'}
                  </button>
                )}
              </div>

              {/* Coordinates displays */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Latitude</span>
                  <span className="text-sm font-bold font-mono text-blue-400">
                    {latitude !== null ? latitude.toFixed(6) : '---'}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Longitude</span>
                  <span className="text-sm font-bold font-mono text-blue-400">
                    {longitude !== null ? longitude.toFixed(6) : '---'}
                  </span>
                </div>
              </div>

              {/* Speed HUD Gauges */}
              <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 bg-slate-900 rounded-full border-2 border-dashed border-blue-500/40 flex items-center justify-center">
                    <Radio size={18} className="text-blue-500 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Telemetric Speed</span>
                    <span className="text-xl font-black font-mono text-slate-100">{speed} <span className="text-xs text-slate-500 font-normal">km/h</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transmission Logging Terminal Console */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Transmitted Signal Logs</span>
              
              <div className="h-[140px] overflow-y-auto font-mono text-[9px] text-slate-300 space-y-1 bg-black/40 p-2.5 rounded-lg border border-slate-900">
                {transmissionLogs.length === 0 ? (
                  <div className="text-slate-500 italic text-center pt-10">
                    Waiting for active shift telemetry streams...
                  </div>
                ) : (
                  transmissionLogs.map((log, index) => (
                    <div key={index} className="leading-relaxed border-b border-slate-900/40 pb-1 last:border-b-0">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: SUMMARY (HISTORICAL SHIFTS)
           ========================================== */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Historical Trips summary</h4>
            
            {myTrips.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <ClipboardList size={32} className="text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-700">No shift histories</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Shift histories and total odometer logs are recorded automatically once shifts end.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myTrips.map(trip => (
                  <div key={trip.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          trip.status === 'completed'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse'
                        }`}>
                          {trip.status}
                        </span>
                        <p className="text-xs font-bold text-slate-800 mt-2">Odometer: {trip.distanceKm} km</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">{trip.date}</span>
                    </div>

                    <div className="border-t border-slate-50 pt-2.5 text-[10px] text-slate-500">
                      <div className="flex justify-between">
                        <span>Started at</span>
                        <span className="font-mono">{new Date(trip.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      {trip.endTime && (
                        <div className="flex justify-between mt-1">
                          <span>Ended at</span>
                          <span className="font-mono">{new Date(trip.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB: PROFILE
           ========================================== */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-md mb-3">
                {(profileName || user.name || 'D').charAt(0).toUpperCase()}
              </div>
              <h4 className="text-sm font-bold text-slate-800">{profileName || user.name}</h4>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Field Driver</p>
              <div className="mt-3 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 text-[10px] font-mono text-slate-500">
                {user.email}
              </div>
            </div>

            {/* Read-Only Profile Details */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-50">
                <Shield size={16} className="text-blue-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Driver Assignment Details</h4>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="p-2 bg-white rounded-lg border border-slate-100 text-slate-500">
                    <User size={14} />
                  </div>
                  <div className="flex-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</span>
                    <span className="text-xs font-bold text-slate-700">{profileName || user.name}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="p-2 bg-white rounded-lg border border-slate-100 text-slate-500">
                    <Phone size={14} />
                  </div>
                  <div className="flex-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Mobile Number</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">{profilePhone || 'Not Set'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="p-2 bg-white rounded-lg border border-slate-100 text-slate-500">
                    <Truck size={14} />
                  </div>
                  <div className="flex-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Vehicle</span>
                    <span className="text-xs font-bold text-slate-700">Delivery Truck (Standard Fleet)</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="p-2 bg-white rounded-lg border border-slate-100 text-slate-500">
                    <Compass size={14} />
                  </div>
                  <div className="flex-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle Number</span>
                    <span className="text-xs font-bold text-slate-700 font-mono uppercase">{profilePlate || 'Not Set'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="p-2 bg-white rounded-lg border border-slate-100 text-slate-500">
                    <Shield size={14} />
                  </div>
                  <div className="flex-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Company Name</span>
                    <span className="text-xs font-bold text-slate-700">DN GPS Tracker</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="p-2 bg-white rounded-lg border border-slate-100 text-slate-500">
                    <Clock size={14} />
                  </div>
                  <div className="flex-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Driver ID</span>
                    <span className="text-xs font-bold text-slate-700 font-mono text-slate-500">{user.id}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 rounded-xl py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-red-100 cursor-pointer"
            >
              Log Out Driver
            </button>
          </div>
        )}
      </div>

      {/* Bottom Nav Bar */}
      <div 
        id="bottom-navigation-bar" 
        className="h-14 bg-white border-t border-slate-100 flex items-center justify-around shrink-0 z-40"
      >
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'dashboard' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <LayoutDashboard size={18} />
          <span className="text-[8px] uppercase tracking-wider">Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('location')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'location' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Compass size={18} />
          <span className="text-[8px] uppercase tracking-wider">Live Track</span>
        </button>

        <button
          onClick={() => setActiveTab('summary')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'summary' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ClipboardList size={18} />
          <span className="text-[8px] uppercase tracking-wider">Summary</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'profile' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <User size={18} />
          <span className="text-[8px] uppercase tracking-wider">Profile</span>
        </button>
      </div>
    </div>
  );
}
