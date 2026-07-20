import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Map as MapIcon, Users, FileBarChart, User, 
  Plus, Search, Compass, Shield, Phone, Truck, 
  MapPin, LogOut, CheckCircle2, AlertTriangle, 
  Download, Calendar, Sliders, ChevronRight,
  Edit, Trash2, Key, Info, Clock, AlertCircle, X, ChevronDown,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { UserProfile, Driver, TripReport, LocationLog } from '../types';
import { fetchApi } from '../lib/api';
import { isDriverOnline, getActiveReports } from '../lib/statusHelper';
import { subscribeToDrivers, subscribeToTripReports } from '../lib/firebaseClient';

// Helper component to auto-fit Google Map bounds dynamically for all active markers
function MapBoundsFitter({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0 || typeof google === 'undefined') return;

    const bounds = new google.maps.LatLngBounds();
    points.forEach((pt) => {
      if (typeof pt.lat === 'number' && typeof pt.lng === 'number' && !isNaN(pt.lat) && !isNaN(pt.lng)) {
        bounds.extend(pt);
      }
    });

    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    if (!northEast || !southWest) return;

    const latDiff = Math.abs(northEast.lat() - southWest.lat());
    const lngDiff = Math.abs(northEast.lng() - southWest.lng());

    // Center and set a nice zoom level if points are too close together
    if (latDiff < 0.0015 && lngDiff < 0.0015) {
      map.setCenter(points[0]);
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, {
        top: 60,
        right: 60,
        bottom: 60,
        left: 60
      });
    }
  }, [map, JSON.stringify(points)]);

  return null;
}

interface AdminDashboardProps {
  user: UserProfile;
  onLogout: () => void;
}

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'drivers' | 'reports' | 'profile'>('dashboard');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [reports, setReports] = useState<TripReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Driver Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPlate, setNewDriverPlate] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverPassword, setNewDriverPassword] = useState('');
  const [newDriverId, setNewDriverId] = useState('');
  const [newDriverDob, setNewDriverDob] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverAddress, setNewDriverAddress] = useState('');
  const [newDriverVehicleName, setNewDriverVehicleName] = useState('');
  const [newDriverLicenseNumber, setNewDriverLicenseNumber] = useState('');
  const [newDriverLicenseExpiry, setNewDriverLicenseExpiry] = useState('');
  const [newDriverEmergencyContact, setNewDriverEmergencyContact] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Driver Form States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPlate, setEditDriverPlate] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editDriverDob, setEditDriverDob] = useState('');
  const [editDriverEmail, setEditDriverEmail] = useState('');
  const [editDriverPassword, setEditDriverPassword] = useState('');
  const [editDriverAddress, setEditDriverAddress] = useState('');
  const [editDriverVehicleName, setEditDriverVehicleName] = useState('');
  const [editDriverLicenseNumber, setEditDriverLicenseNumber] = useState('');
  const [editDriverLicenseExpiry, setEditDriverLicenseExpiry] = useState('');
  const [editDriverEmergencyContact, setEditDriverEmergencyContact] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditingSubmitting, setIsEditingSubmitting] = useState(false);

  // Delete Driver States
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Reports Module Filters & Detail Selection States
  const [reportFilterDriver, setReportFilterDriver] = useState<string>('all');
  const [reportFilterRange, setReportFilterRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [reportFilterStartDate, setReportFilterStartDate] = useState<string>('');
  const [reportFilterEndDate, setReportFilterEndDate] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<TripReport | null>(null);
  const [selectedReportLogs, setSelectedReportLogs] = useState<LocationLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [showDeleteReportConfirm, setShowDeleteReportConfirm] = useState(false);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [deleteReportError, setDeleteReportError] = useState<string | null>(null);
  const [deleteReportSuccess, setDeleteReportSuccess] = useState<string | null>(null);

  // Profile Change Password States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Live Map Selection and Search states
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [mapSearchQuery, setMapSearchQuery] = useState('');

  // Settings
  const [pingInterval, setPingInterval] = useState('10');
  const [speedLimit, setSpeedLimit] = useState('100');

  // Real-time Firestore subscriptions for drivers and reports
  useEffect(() => {
    console.log('[AdminDashboard] Initiating real-time snapshot listeners for drivers and reports...');
    const unsubscribeDrivers = subscribeToDrivers((driversData) => {
      setDrivers(driversData);
    });

    const unsubscribeReports = subscribeToTripReports((reportsData) => {
      setReports(reportsData);
    });

    return () => {
      console.log('[AdminDashboard] Unsubscribing real-time listeners...');
      unsubscribeDrivers();
      unsubscribeReports();
    };
  }, []);

  // Derive active driver IDs from ongoing trip reports as the single source of truth
  const activeDriverIds = new Set<string>();
  getActiveReports(reports).forEach(r => {
    const matchingDriver = drivers.find(d => 
      d.id === r.driverId || 
      (d.email && r.driverId && d.email.toLowerCase() === r.driverId.toLowerCase()) ||
      (d.name && d.name.toLowerCase() === r.driverName.toLowerCase())
    );
    if (matchingDriver) {
      activeDriverIds.add(matchingDriver.id);
    } else {
      activeDriverIds.add(r.driverId);
    }
  });

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsSubmitting(true);

    if (!newDriverName || !newDriverId || !newDriverPhone || !newDriverEmail || !newDriverPassword || !newDriverPlate) {
      setAddError('Driver Name, Driver ID, Mobile Number, Email Address, Password, and Vehicle Number are required.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetchApi('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newDriverId,
          name: newDriverName,
          dob: newDriverDob,
          phone: newDriverPhone,
          email: newDriverEmail,
          password: newDriverPassword,
          address: newDriverAddress,
          vehiclePlate: newDriverPlate,
          vehicleNameType: newDriverVehicleName,
          licenseNumber: newDriverLicenseNumber,
          licenseExpiry: newDriverLicenseExpiry,
          emergencyContact: newDriverEmergencyContact
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add driver');

      setDrivers(prev => [...prev, data]);
      setNewDriverName('');
      setNewDriverId('');
      setNewDriverPlate('');
      setNewDriverPhone('');
      setNewDriverPassword('');
      setNewDriverDob('');
      setNewDriverEmail('');
      setNewDriverAddress('');
      setNewDriverVehicleName('');
      setNewDriverLicenseNumber('');
      setNewDriverLicenseExpiry('');
      setNewDriverEmergencyContact('');
      setShowAddModal(false);
    } catch (err: any) {
      setAddError(err.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    setEditError(null);
    setIsEditingSubmitting(true);

    if (!editDriverName || !editDriverPhone || !editDriverPlate) {
      setEditError('Driver Name, Mobile Number, and Vehicle Number are required.');
      setIsEditingSubmitting(false);
      return;
    }

    try {
      const res = await fetchApi(`/api/drivers/${editingDriver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editDriverName,
          dob: editDriverDob,
          phone: editDriverPhone,
          email: editDriverEmail,
          password: editDriverPassword,
          address: editDriverAddress,
          vehiclePlate: editDriverPlate,
          vehicleNameType: editDriverVehicleName,
          licenseNumber: editDriverLicenseNumber,
          licenseExpiry: editDriverLicenseExpiry,
          emergencyContact: editDriverEmergencyContact
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update driver');

      setShowEditModal(false);
      setEditingDriver(null);
      setEditDriverPassword('');
    } catch (err: any) {
      setEditError(err.message || 'Error occurred');
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  const handleDeleteDriver = (driver: Driver) => {
    setDriverToDelete(driver);
    setDeleteError(null);
  };

  const executeDeleteDriver = async () => {
    if (!driverToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetchApi(`/api/drivers/${driverToDelete.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete driver');
      
      setDriverToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting driver');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!selectedReport) return;
    setIsDeletingReport(true);
    setDeleteReportError(null);
    try {
      const res = await fetchApi(`/api/reports/${selectedReport.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete the report.');
      
      setReports((prev) => prev.filter((r) => r.id !== selectedReport.id));
      setSelectedReport(null);
      setShowDeleteReportConfirm(false);
      setDeleteReportSuccess('Report deleted successfully.');
      setTimeout(() => setDeleteReportSuccess(null), 4000);
    } catch (err: any) {
      console.error('Error deleting report:', err);
      setDeleteReportError(err.message || 'An error occurred while deleting the report.');
    } finally {
      setIsDeletingReport(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || !confirmPassword) {
      setPasswordError('New password and password confirmation are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await fetchApi('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          oldPassword,
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setPasswordSuccess('Password successfully updated.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Error changing password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const formatDuration = (startISO: string, endISO: string | null) => {
    const start = new Date(startISO).getTime();
    const end = endISO ? new Date(endISO).getTime() : Date.now();
    const diffMs = end - start;
    
    if (diffMs < 0) return '0m';
    
    const totalMin = Math.floor(diffMs / 60000);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handleOpenReportDetails = async (report: TripReport) => {
    setSelectedReport(report);
    setIsLoadingLogs(true);
    setSelectedReportLogs([]);
    try {
      const res = await fetchApi(`/api/locations/${report.driverId}`);
      if (res.ok) {
        const allLogs: LocationLog[] = await res.json();
        const start = new Date(report.startTime).getTime();
        const end = report.endTime ? new Date(report.endTime).getTime() : Date.now();
        
        const filteredLogs = allLogs.filter(log => {
          const logTime = new Date(log.timestamp).getTime();
          return logTime >= start && logTime <= end;
        });
        setSelectedReportLogs(filteredLogs);
      }
    } catch (err) {
      console.error('Error fetching logs for report:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handlePrintReport = (report: TripReport, logs: LocationLog[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print/download reports.');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>DN TRACKER - Shift Report #${report.id}</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="max-w-3xl mx-auto border border-slate-200 p-8 rounded-2xl bg-white">
            <div class="flex justify-between items-center border-b border-slate-200 pb-6 mb-6">
              <div>
                <h1 class="text-2xl font-black text-blue-600 tracking-tight">DN TRACKER</h1>
                <p class="text-xs text-slate-400 uppercase tracking-wider font-bold">Shift Performance Telemetry Report</p>
              </div>
              <div class="text-right">
                <span class="text-xs font-mono bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase border border-slate-200">${report.status}</span>
                <p class="text-xs text-slate-500 mt-2 font-medium">Report ID: <span class="font-mono">${report.id}</span></p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-6 mb-8 bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver Details</span>
                <h3 class="text-base font-bold text-slate-800">${report.driverName}</h3>
                <p class="text-xs text-slate-500 mt-1 font-medium">Vehicle Plate: <span class="font-mono font-bold uppercase text-slate-700">${report.vehiclePlate}</span></p>
              </div>
              <div class="text-right">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Date & Shift Period</span>
                <h3 class="text-sm font-bold text-slate-800">${report.date}</h3>
                <p class="text-xs text-slate-500 mt-1 font-mono">${new Date(report.startTime).toLocaleTimeString()} - ${report.endTime ? new Date(report.endTime).toLocaleTimeString() : 'Active'}</p>
              </div>
            </div>

            <div class="grid grid-cols-4 gap-4 mb-8 text-center">
              <div class="border border-slate-200 p-3 rounded-xl">
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Distance</span>
                <span class="text-lg font-black text-blue-600">${report.distanceKm} km</span>
              </div>
              <div class="border border-slate-200 p-3 rounded-xl">
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Duration</span>
                <span class="text-lg font-black text-slate-800">${formatDuration(report.startTime, report.endTime)}</span>
              </div>
              <div class="border border-slate-200 p-3 rounded-xl">
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Avg Speed</span>
                <span class="text-lg font-black text-slate-800">${report.avgSpeed || '0'} km/h</span>
              </div>
              <div class="border border-slate-200 p-3 rounded-xl">
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Max Speed</span>
                <span class="text-lg font-black text-red-600">${report.maxSpeed || '0'} km/h</span>
              </div>
            </div>

            <div class="space-y-4 mb-8">
              <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1.5">Route Telemetry Checkpoints</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <span class="text-[9px] font-bold text-blue-500 uppercase block mb-1">Start Location</span>
                  <span class="text-xs font-bold text-slate-700">${report.startLocation}</span>
                  <span class="text-[10px] text-slate-400 block mt-1 font-mono">${new Date(report.startTime).toLocaleString()}</span>
                </div>
                <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <span class="text-[9px] font-bold text-red-500 uppercase block mb-1">End Location</span>
                  <span class="text-xs font-bold text-slate-700">${report.endLocation || 'In Progress'}</span>
                  <span class="text-[10px] text-slate-400 block mt-1 font-mono">${report.endTime ? new Date(report.endTime).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1.5">Full Trip Timeline</h4>
              <div class="space-y-2">
                ${logs.map((log, index) => `
                  <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                    <div class="flex items-center gap-2">
                      <span class="w-1.5 h-1.5 rounded-full ${log.speed > 80 ? 'bg-red-500' : 'bg-slate-400'}"></span>
                      <span class="font-mono text-slate-400">${new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div class="text-right">
                      <span class="font-mono text-slate-600 font-semibold">Speed: ${log.speed} km/h</span>
                      <span class="text-[10px] text-slate-400 ml-3 font-mono">(${log.latitude.toFixed(5)}, ${log.longitude.toFixed(5)})</span>
                    </div>
                  </div>
                `).join('')}
                ${logs.length === 0 ? '<p class="text-xs text-slate-400 italic">No GPS logs recorded during this shift.</p>' : ''}
              </div>
            </div>

            <div class="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
              <span>Powered by DN DIGITAL SERVICES</span>
              <span>Generated on ${new Date().toLocaleString()}</span>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadCSV = (report: TripReport, logs: LocationLog[]) => {
    const headers = ['Timestamp', 'Latitude', 'Longitude', 'Speed(km/h)'];
    const rows = logs.map(l => [
      new Date(l.timestamp).toISOString(),
      l.latitude,
      l.longitude,
      l.speed
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DN_Report_${report.driverName.replace(/\s+/g, '_')}_${report.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Projection for the detailed report route
  const renderReportRouteSvg = (logs: LocationLog[]) => {
    if (logs.length === 0) {
      return (
        <div className="h-40 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400">
          <MapIcon size={24} className="opacity-50 mb-1" />
          <span className="text-[10px] font-medium">No GPS route telemetry recorded</span>
        </div>
      );
    }

    const svgWidth = 340;
    const svgHeight = 160;

    const latitudes = logs.map(l => l.latitude);
    const longitudes = logs.map(l => l.longitude);

    let minLat = Math.min(...latitudes);
    let maxLat = Math.max(...latitudes);
    let minLng = Math.min(...longitudes);
    let maxLng = Math.max(...longitudes);

    // Apply padding
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const padding = 0.001;

    if (latDiff < 0.0001) {
      minLat -= padding;
      maxLat += padding;
    } else {
      minLat -= latDiff * 0.15;
      maxLat += latDiff * 0.15;
    }

    if (lngDiff < 0.0001) {
      minLng -= padding;
      maxLng += padding;
    } else {
      minLng -= lngDiff * 0.15;
      maxLng += lngDiff * 0.15;
    }

    const projectPoint = (lat: number, lng: number) => {
      const y = svgHeight - (20 + ((lat - minLat) / (maxLat - minLat)) * (svgHeight - 40));
      const x = 20 + ((lng - minLng) / (maxLng - minLng)) * (svgWidth - 40);
      return { x, y };
    };

    // Build the SVG path string
    let pathD = '';
    logs.forEach((log, index) => {
      const { x, y } = projectPoint(log.latitude, log.longitude);
      if (index === 0) {
        pathD = `M ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
      }
    });

    const startPt = projectPoint(logs[0].latitude, logs[0].longitude);
    const endPt = projectPoint(logs[logs.length - 1].latitude, logs[logs.length - 1].longitude);

    return (
      <div className="relative border border-slate-100 bg-slate-50 rounded-2xl p-2 select-none overflow-hidden h-44 flex items-center justify-center">
        <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
          {/* Ambient Map Gridlines */}
          <g className="opacity-30">
            <line x1="0" y1="40" x2={svgWidth} y2="40" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,4" />
            <line x1="0" y1="80" x2={svgWidth} y2="80" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,4" />
            <line x1="0" y1="120" x2={svgWidth} y2="120" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,4" />
            <line x1="80" y1="0" x2="80" y2={svgHeight} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,4" />
            <line x1="170" y1="0" x2="170" y2={svgHeight} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,4" />
            <line x1="260" y1="0" x2="260" y2={svgHeight} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,4" />
          </g>

          {/* Connected Path */}
          <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-80" />
          
          {/* Dash Overlay for Directional flow */}
          <path d={pathD} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,4" />

          {/* Start Point marker */}
          <circle cx={startPt.x} cy={startPt.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" className="shadow-xs" />
          <text x={startPt.x + 8} y={startPt.y + 4} className="text-[8px] font-bold fill-emerald-600 font-sans" textAnchor="start">START</text>

          {/* End Point marker */}
          <circle cx={endPt.x} cy={endPt.y} r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" className="shadow-xs" />
          <text x={endPt.x + 8} y={endPt.y + 4} className="text-[8px] font-bold fill-red-600 font-sans" textAnchor="start">END</text>
        </svg>
        <span className="absolute bottom-2 right-2 text-[8px] bg-white border border-slate-100 rounded-full px-2 py-0.5 text-slate-400 font-semibold uppercase tracking-wider">GPS Route Vector</span>
      </div>
    );
  };

  // Projection logic for Map
  const renderMapComponent = (isPreview: boolean = false) => {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
    const hasGoogleMapsKey = googleMapsApiKey && googleMapsApiKey !== 'YOUR_GOOGLE_MAPS_API_KEY' && googleMapsApiKey.trim() !== '';

    // Filter drivers that are active (ongoing trip report)
    const activeDrivers = drivers.filter(d => activeDriverIds.has(d.id));
    
    // Filter active drivers based on map search query
    const searchedActiveDrivers = activeDrivers.filter(d => 
      d.name.toLowerCase().includes(mapSearchQuery.toLowerCase()) ||
      d.vehiclePlate.toLowerCase().includes(mapSearchQuery.toLowerCase())
    );

    // Apply smart circular/spiral offset for drivers with identical or very close coordinates
    const displayedDrivers = searchedActiveDrivers.map((driver, index) => {
      const lat = driver.lastLatitude ?? 30.2672;
      const lng = driver.lastLongitude ?? -97.7431;
      
      // Calculate how many preceding drivers share almost the exact same position
      let overlapCount = 0;
      for (let i = 0; i < index; i++) {
        const prevDriver = searchedActiveDrivers[i];
        const prevLat = prevDriver.lastLatitude ?? 30.2672;
        const prevLng = prevDriver.lastLongitude ?? -97.7431;
        
        const latDiff = Math.abs(lat - prevLat);
        const lngDiff = Math.abs(lng - prevLng);
        if (latDiff < 0.00015 && lngDiff < 0.00015) {
          overlapCount++;
        }
      }
      
      if (overlapCount === 0) {
        return {
          ...driver,
          displayLat: lat,
          displayLng: lng
        };
      }
      
      // Distribute overlapping markers in a neat spiral or circle
      const angle = (overlapCount * 2 * Math.PI) / 6; // support up to 6 markers per concentric ring
      const radius = 0.00025 * Math.ceil(overlapCount / 6); // roughly 25 meters per layer
      const displayLat = lat + Math.sin(angle) * radius;
      const displayLng = lng + Math.cos(angle) * radius;
      
      return {
        ...driver,
        displayLat,
        displayLng
      };
    });

    // SVG Map Fallback Projection calculations
    const svgWidth = 380;
    const svgHeight = 280;

    const backgroundMap = (
      <g className="opacity-40">
        <rect x="20" y="30" width="100" height="80" rx="8" fill="#dcfce7" />
        <rect x="220" y="160" width="120" height="90" rx="12" fill="#dcfce7" />
        <path d="M -20,150 C 100,140 200,190 420,170" fill="none" stroke="#dbeafe" strokeWidth="24" strokeLinecap="round" />
        <path d="M -20,150 C 100,140 200,190 420,170" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="0" x2="50" y2="300" stroke="#f1f5f9" strokeWidth="12" />
        <line x1="180" y1="0" x2="180" y2="300" stroke="#f1f5f9" strokeWidth="16" />
        <line x1="320" y1="0" x2="320" y2="300" stroke="#f1f5f9" strokeWidth="10" />
        <line x1="0" y1="80" x2="400" y2="80" stroke="#f1f5f9" strokeWidth="14" />
        <line x1="0" y1="210" x2="400" y2="210" stroke="#f1f5f9" strokeWidth="18" />
        <line x1="180" y1="0" x2="180" y2="300" stroke="#94a3b8" strokeWidth="1" strokeDasharray="5,5" />
        <line x1="0" y1="210" x2="400" y2="210" stroke="#94a3b8" strokeWidth="1" strokeDasharray="5,5" />
      </g>
    );

    // Dynamic projection function
    let project = (lat: number, lng: number) => {
      return { x: 190, y: 140 }; // center default
    };

    if (displayedDrivers.length > 0) {
      let minLat = Math.min(...displayedDrivers.map(d => d.displayLat));
      let maxLat = Math.max(...displayedDrivers.map(d => d.displayLat));
      let minLng = Math.min(...displayedDrivers.map(d => d.displayLng));
      let maxLng = Math.max(...displayedDrivers.map(d => d.displayLng));

      const padding = 0.005;
      if (maxLat - minLat < 0.0001) {
        minLat -= padding;
        maxLat += padding;
      } else {
        const diff = maxLat - minLat;
        minLat -= diff * 0.2;
        maxLat += diff * 0.2;
      }

      if (maxLng - minLng < 0.0001) {
        minLng -= padding;
        maxLng += padding;
      } else {
        const diff = maxLng - minLng;
        minLng -= diff * 0.2;
        maxLng += diff * 0.2;
      }

      project = (lat: number, lng: number) => {
        const y = svgHeight - (35 + ((lat - minLat) / (maxLat - minLat)) * (svgHeight - 70));
        const x = 35 + ((lng - minLng) / (maxLng - minLng)) * (svgWidth - 70);
        return { x, y };
      };
    }

    return (
      <div className="flex flex-col gap-3 w-full">
        {/* Search Map Overlay bar */}
        {!isPreview && (
          <div className="relative shrink-0 flex gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search driver on live map..."
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all shadow-xs"
              />
              {mapSearchQuery && (
                <button
                  onClick={() => setMapSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
            
            {hasGoogleMapsKey && (
              <div className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 size={12} /> Google Maps Connected
              </div>
            )}
          </div>
        )}

        {/* Map Stage Container */}
        <div className={`relative w-full ${isPreview ? 'h-[180px]' : 'h-[360px]'} bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-lg flex flex-col`}>
          {hasGoogleMapsKey ? (
            /* ==========================================
                REAL GOOGLE MAPS RENDER
               ========================================== */
            <APIProvider apiKey={googleMapsApiKey}>
              <div className="w-full h-full">
                <GoogleMap
                  mapId="dn_gps_tracker_map"
                  defaultCenter={{ lat: displayedDrivers[0]?.displayLat ?? 30.2672, lng: displayedDrivers[0]?.displayLng ?? -97.7431 }}
                  defaultZoom={12}
                  gestureHandling={'greedy'}
                  disableDefaultUI={true}
                >
                  {displayedDrivers.map((driver) => (
                    <AdvancedMarker
                      key={driver.id}
                      position={{ lat: driver.displayLat, lng: driver.displayLng }}
                      onClick={() => !isPreview && setSelectedDriver(driver)}
                    >
                      <Pin
                        background={driver.id === selectedDriver?.id ? '#dc2626' : '#2563eb'}
                        borderColor="#ffffff"
                        glyphColor="#ffffff"
                      />
                    </AdvancedMarker>
                  ))}
                  <MapBoundsFitter points={displayedDrivers.map(d => ({ lat: d.displayLat, lng: d.displayLng }))} />
                </GoogleMap>
              </div>
            </APIProvider>
          ) : (
            /* ==========================================
                VECTOR MAP FALLBACK WITH RADAR SWEEP
               ========================================== */
            <div className="relative w-full h-full flex flex-col">
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/70 text-blue-400 text-[9px] font-bold px-2 py-1 rounded-md border border-blue-500/20 shadow-md">
                <Compass size={10} className="shrink-0 animate-spin" />
                <span>FLEET VECTOR MAP ACTIVE</span>
              </div>

              {displayedDrivers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative">
                  <svg className="absolute inset-0 w-full h-full p-2" viewBox="0 0 380 280">
                    {backgroundMap}
                  </svg>
                  <div className="relative bg-slate-950/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-md max-w-[280px]">
                    <div className="mx-auto w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center mb-2">
                      <MapPin size={20} className="text-slate-400 animate-bounce" />
                    </div>
                    <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wide">No Fleet Signals Matched</h5>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                      Active drivers broadcasting GPS coordinates will appear here. Start a driver shift to stream coordinates.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 relative">
                  <svg className="w-full h-full p-4" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                    {backgroundMap}

                    {/* Radar scanline sweep */}
                    <line x1="0" y1="0" x2="380" y2="280" stroke="#3b82f6" strokeWidth="0.5" className="animate-[pulse_2s_infinite] opacity-30" />

                    {/* Render Driver Trails / Pins */}
                    {displayedDrivers.map((driver) => {
                      const { x, y } = project(driver.displayLat, driver.displayLng);
                      const isSelected = driver.id === selectedDriver?.id;
                      return (
                        <g 
                          key={driver.id} 
                          className={isPreview ? "pointer-events-none" : "cursor-pointer"} 
                          onClick={() => !isPreview && setSelectedDriver(driver)}
                        >
                          {/* Pulsing beacon glow ring */}
                          <circle cx={x} cy={y} r={isSelected ? "18" : "12"} fill={isSelected ? "#ef4444" : "#3b82f6"} fillOpacity="0.25" className="animate-ping" />
                          {/* Inner pin shadow */}
                          <circle cx={x} cy={y} r="6" fill={isSelected ? "#ef4444" : "#3b82f6"} stroke="#ffffff" strokeWidth="2" className="drop-shadow-md" />
                          
                          {/* Custom driver text badge overlay */}
                          <g transform={`translate(${x}, ${y - 12})`}>
                            <rect x="-30" y="-14" width="60" height="12" rx="3" fill={isSelected ? "#ef4444" : "#1e293b"} />
                            <polygon points="0,1 -3,-2 3,-2" fill={isSelected ? "#ef4444" : "#1e293b"} />
                            <text x="0" y="-5" fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">
                              {driver.name.split(' ')[0]}
                            </text>
                          </g>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* ==========================================
              DYNAMIC DRIVER INFORMATION BOTTOM SHEET
             ========================================== */}
          <AnimatePresence>
            {!isPreview && selectedDriver && (
              <motion.div
                initial={{ y: 150, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 150, opacity: 0 }}
                className="absolute bottom-0 inset-x-0 bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl z-40 p-4"
              >
                {/* Drag handle line */}
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3"></div>

                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-2.5 items-center">
                    <div className="bg-blue-50 text-blue-600 p-2 rounded-xl border border-blue-100">
                      <Truck size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{selectedDriver.name}</h4>
                      <p className="text-[9px] font-mono text-slate-400 uppercase font-bold tracking-wider">{selectedDriver.vehiclePlate}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDriver(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full border border-slate-100"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3.5 text-[10px]">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100/60">
                    <span className="text-[8px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Speed Telemetry</span>
                    <span className={`font-mono font-bold block text-xs ${
                      activeDriverIds.has(selectedDriver.id) ? 'text-blue-600 animate-pulse' : 'text-slate-500'
                    }`}>
                      {activeDriverIds.has(selectedDriver.id) ? 'Moving • ~55 km/h' : 'Stationary • 0 km/h'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100/60">
                    <span className="text-[8px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">Status Check</span>
                    <span className="font-mono font-bold block text-xs text-slate-700 capitalize">
                      {activeDriverIds.has(selectedDriver.id) ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                {/* Interactive buttons */}
                <div className="flex gap-2">
                  <a
                    href={`tel:${selectedDriver.phone || ''}`}
                    onClick={(e) => {
                      if (!selectedDriver.phone) {
                        e.preventDefault();
                        alert('No phone number recorded for this driver.');
                      } else {
                        alert(`Dialing driver ${selectedDriver.name} at ${selectedDriver.phone}...`);
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white rounded-xl py-2 px-3 text-xs font-bold hover:bg-blue-700 transition-all text-center flex items-center justify-center gap-1.5"
                  >
                    <Phone size={12} /> Call Driver
                  </a>
                  <button
                    onClick={() => {
                      // Trigger routing highlight or logs
                      const driverReports = reports.filter(r => r.driverId === selectedDriver.id);
                      if (driverReports.length > 0) {
                        alert(`Found ${driverReports.length} trip reports for ${selectedDriver.name}. Directing to Reports page...`);
                        setActiveTab('reports');
                      } else {
                        alert(`No historical shifts found on database for ${selectedDriver.name}.`);
                      }
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2 px-3 text-xs font-bold transition-all border border-slate-200"
                  >
                    View Shift Logs
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>


      </div>
    );
  };

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.vehiclePlate.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden relative">
      {/* Toast Notification for Report Deletion */}
      <AnimatePresence>
        {deleteReportSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 left-4 right-4 z-55 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-600 shrink-0" size={16} />
              <span className="text-xs font-semibold">{deleteReportSuccess}</span>
            </div>
            <button 
              onClick={() => setDeleteReportSuccess(null)}
              className="text-emerald-600 hover:text-emerald-800 shrink-0"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Sub-header detailing current tab */}
      <div className="bg-white border-b border-slate-100 py-3.5 px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg">
            {activeTab === 'dashboard' && <LayoutDashboard size={18} />}
            {activeTab === 'map' && <MapIcon size={18} />}
            {activeTab === 'drivers' && <Users size={18} />}
            {activeTab === 'reports' && <FileBarChart size={18} />}
            {activeTab === 'profile' && <User size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 capitalize">{activeTab}</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              DN Operational Hub
            </p>
          </div>
        </div>

        {activeTab === 'drivers' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white rounded-lg p-1.5 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-y-auto p-5 pb-8">
        
        {/* ==========================================
            TAB: DASHBOARD
           ========================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            {/* Status Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between h-24">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Total Drivers
                </span>
                <span className="text-2xl font-extrabold text-slate-800">
                  {drivers.length}
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between h-24">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Active Now
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold text-slate-800">
                    {getActiveReports(reports).length}
                  </span>
                  {getActiveReports(reports).length > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between h-24">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Total Reports
                </span>
                <span className="text-2xl font-extrabold text-slate-800">
                  {reports.length}
                </span>
              </div>
            </div>

            {/* Live Map Preview Card */}
            <div 
              onClick={() => setActiveTab('map')}
              className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer space-y-3 group relative"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Live Map Preview
                  </h4>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab('map');
                  }}
                  className="text-[10px] font-bold text-blue-600 bg-blue-50 group-hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-100 transition-all flex items-center gap-0.5"
                >
                  Expand Map <ChevronRight size={12} />
                </button>
              </div>

              {/* Status & Active count details */}
              <div className="flex items-center justify-between text-[10px] bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-slate-500" />
                  <span className="font-semibold text-slate-600">
                    Active Drivers: <strong className="text-slate-800">{getActiveReports(reports).length}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="relative flex h-1.5 w-1.5 mr-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-slate-500">
                    Status: <span className="text-emerald-600 font-bold uppercase tracking-wider">Live Tracking Active</span>
                  </span>
                </div>
              </div>

              <div className="pointer-events-none rounded-xl overflow-hidden">
                {renderMapComponent(true)}
              </div>
            </div>

            {/* Driver Fleet Statuses */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Fleet Signal Overview
              </h4>
              
              {drivers.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No drivers registered in DB. Add drivers to monitor network status.
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {drivers.map(driver => (
                    <div key={driver.id} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                          <Truck size={15} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{driver.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-mono">{driver.vehiclePlate}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          activeDriverIds.has(driver.id) 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {activeDriverIds.has(driver.id) ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: MAP
           ========================================== */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
              {renderMapComponent(false)}
            </div>

            {/* Live Signals list for simple interaction */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Live Transmitting Terminals
              </h4>

              {drivers.filter(d => activeDriverIds.has(d.id)).length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">
                  No terminals actively broadcasting GPS coordinates.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {drivers.filter(d => activeDriverIds.has(d.id)).map(driver => (
                    <div key={driver.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{driver.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono">
                          {driver.lastLatitude ? `Lat: ${driver.lastLatitude.toFixed(5)} • Lng: ${driver.lastLongitude?.toFixed(5)}` : 'Locating (GPS Initializing)...'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          Active
                        </span>
                        <p className="text-[8px] text-slate-400 mt-1">
                          {driver.lastActive ? new Date(driver.lastActive).toLocaleTimeString() : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: DRIVERS
           ========================================== */}
        {activeTab === 'drivers' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Search registered fleet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {/* Drivers list */}
            {filteredDrivers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <Users size={32} className="text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-700">No Drivers Registered</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Click the plus icon above to record a new field driver and register their vehicle plate.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDrivers.map(driver => (
                  <div key={driver.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                          <Truck size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">{driver.name}</h4>
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">{driver.vehiclePlate}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingDriver(driver);
                            setEditDriverName(driver.name);
                            setEditDriverPlate(driver.vehiclePlate);
                            setEditDriverPhone(driver.phone || '');
                            setEditDriverDob(driver.dob || '');
                            setEditDriverEmail(driver.email || '');
                            setEditDriverPassword(driver.password || '');
                            setEditDriverAddress(driver.address || '');
                            setEditDriverVehicleName(driver.vehicleNameType || '');
                            setEditDriverLicenseNumber(driver.licenseNumber || '');
                            setEditDriverLicenseExpiry(driver.licenseExpiry || '');
                            setEditDriverEmergencyContact(driver.emergencyContact || '');
                            setShowEditModal(true);
                          }}
                          className="text-slate-400 hover:text-blue-600 p-1 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all cursor-pointer"
                          title="Edit Driver Info"
                        >
                          <Edit size={11} />
                        </button>
                        <button
                          onClick={() => handleDeleteDriver(driver)}
                          className="text-slate-400 hover:text-red-600 p-1 bg-slate-50 rounded-lg border border-slate-100 hover:border-red-200 hover:bg-red-50 transition-all cursor-pointer"
                          title="Delete Driver"
                        >
                          <Trash2 size={11} />
                        </button>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ml-1.5 ${
                          activeDriverIds.has(driver.id) 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {activeDriverIds.has(driver.id) ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-50 pt-2.5 grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Phone size={12} className="text-slate-400" />
                        <span>{driver.phone || 'No Phone'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 justify-end">
                        <Compass size={12} className="text-slate-400" />
                        <span className="font-mono">
                          {driver.lastLatitude 
                            ? `${driver.lastLatitude.toFixed(3)}, ${driver.lastLongitude?.toFixed(3)}` 
                            : activeDriverIds.has(driver.id) 
                              ? 'Locating...' 
                              : 'No Signal'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB: REPORTS
           ========================================== */}
        {activeTab === 'reports' && (() => {
          // 1. Filter reports first
          const filteredReports = reports.filter(report => {
            // Filter by Driver
            if (reportFilterDriver !== 'all' && report.driverId !== reportFilterDriver) {
              return false;
            }

            // Filter by Date
            const reportTime = new Date(report.startTime).getTime();
            const now = new Date();
            
            if (reportFilterRange === 'today') {
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
              if (reportTime < todayStart) return false;
            } else if (reportFilterRange === 'week') {
              const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
              if (reportTime < oneWeekAgo) return false;
            } else if (reportFilterRange === 'month') {
              const oneMonthAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
              if (reportTime < oneMonthAgo) return false;
            } else if (reportFilterRange === 'custom') {
              if (reportFilterStartDate) {
                const startLimit = new Date(reportFilterStartDate + 'T00:00:00').getTime();
                if (reportTime < startLimit) return false;
              }
              if (reportFilterEndDate) {
                const endLimit = new Date(reportFilterEndDate + 'T23:59:59').getTime();
                if (reportTime > endLimit) return false;
              }
            }

            return true;
          });

          // 2. Group filtered reports by driver ID
          const reportsByDriver: { [driverId: string]: { driverName: string; reports: TripReport[] } } = {};
          filteredReports.forEach(report => {
            if (!reportsByDriver[report.driverId]) {
              reportsByDriver[report.driverId] = {
                driverName: report.driverName,
                reports: []
              };
            }
            reportsByDriver[report.driverId].reports.push(report);
          });

          const handleExportFilteredReportsCSV = () => {
            if (filteredReports.length === 0) {
              alert('No reports found to export.');
              return;
            }
            const headers = ['Report ID', 'Driver Name', 'Vehicle Plate', 'Date', 'Start Time', 'End Time', 'Distance(km)', 'Avg Speed', 'Max Speed', 'Status'];
            const rows = filteredReports.map(r => [
              r.id,
              r.driverName,
              r.vehiclePlate,
              r.date,
              r.startTime,
              r.endTime || 'Ongoing',
              r.distanceKm,
              r.avgSpeed || 0,
              r.maxSpeed || 0,
              r.status
            ]);
            
            const csvContent = "data:text/csv;charset=utf-8," 
              + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
              
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `DN_Fleet_Reports_Export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 3000);
          };

          return (
            <div className="space-y-4">
              {/* Header Box */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Fleet Trip Logs</h4>
                  <p className="text-[9px] text-slate-400">Recorded driver telemetry reports</p>
                </div>
                <button 
                  onClick={handleExportFilteredReportsCSV}
                  className={`${exportSuccess ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-100'} border rounded-xl px-2.5 py-1.5 hover:bg-blue-100 active:scale-95 transition-all flex items-center gap-1 text-[10px] font-semibold cursor-pointer`}
                >
                  <Download size={12} /> {exportSuccess ? 'Exported!' : 'Export CSV'}
                </button>
              </div>

              {/* Filters Panel */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-50">
                  <Sliders size={14} className="text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Search Filters</h4>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Driver Filter Dropdown */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Driver</label>
                    <select
                      value={reportFilterDriver}
                      onChange={(e) => setReportFilterDriver(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Drivers</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Preset Date Selector */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Time Interval</label>
                    <select
                      value={reportFilterRange}
                      onChange={(e) => setReportFilterRange(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Records</option>
                      <option value="today">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="custom">Custom Date Range</option>
                    </select>
                  </div>
                </div>

                {/* Custom Date Picker inputs */}
                {reportFilterRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">From Date</label>
                      <input
                        type="date"
                        value={reportFilterStartDate}
                        onChange={(e) => setReportFilterStartDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">To Date</label>
                      <input
                        type="date"
                        value={reportFilterEndDate}
                        onChange={(e) => setReportFilterEndDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Reports List */}
              {reports.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                  <FileBarChart size={32} className="text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-semibold text-slate-700">No Shift Reports</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Once a driver completes their active GPS tracking shift, automatic logs are compiled here.
                  </p>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                  <Info size={32} className="text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-semibold text-slate-700">No Matches Found</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Adjust your active search filters to locate shift records.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.keys(reportsByDriver).map(driverId => {
                    const group = reportsByDriver[driverId];
                    return (
                      <div key={driverId} className="space-y-2.5">
                        <div className="flex items-center gap-1.5 px-1 pt-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {group.driverName} &bull; {group.reports.length} {group.reports.length === 1 ? 'Report' : 'Reports'}
                          </h5>
                        </div>
                        <div className="grid gap-3">
                          {group.reports.map(report => (
                            <div 
                              key={report.id} 
                              onClick={() => handleOpenReportDetails(report)}
                              className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-500/50 hover:bg-slate-50/30 transition-all shadow-xs cursor-pointer space-y-3 relative group"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[9px] font-bold text-blue-600 font-mono uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                    {report.status}
                                  </span>
                                  <h4 className="text-xs font-bold text-slate-800 mt-2 group-hover:text-blue-600 transition-colors">Shift ID: {report.id}</h4>
                                  <p className="text-[9px] font-mono text-slate-400 uppercase">Vehicle: {report.vehiclePlate}</p>
                                </div>
                                <div className="text-right text-[10px] text-slate-400">
                                  <div className="flex items-center gap-1 justify-end font-medium text-slate-600">
                                    <Calendar size={11} />
                                    <span>{report.date}</span>
                                  </div>
                                  <p className="mt-1 font-mono">{new Date(report.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {report.endTime ? new Date(report.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Active'}</p>
                                </div>
                              </div>

                              <div className="border-t border-slate-50 pt-2.5 grid grid-cols-2 gap-2 text-[10px] font-medium">
                                <div>
                                  <span className="text-slate-400 block text-[8px] uppercase font-bold">Start Point</span>
                                  <span className="text-slate-700 block truncate">{report.startLocation}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-slate-400 block text-[8px] uppercase font-bold">Total Distance</span>
                                  <span className="text-slate-800 font-bold block">{report.distanceKm} km</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ==========================================
            TAB: PROFILE
           ========================================== */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {/* Identity */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-md mb-3">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <h4 className="text-sm font-bold text-slate-800">{user.name}</h4>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Fleet Administrator</p>
              <div className="mt-3 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 text-[10px] font-mono text-slate-500">
                {user.email}
              </div>
            </div>

            {/* Fleet Configuration Controls */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-50">
                <Sliders size={16} className="text-blue-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Fleet Controls</h4>
              </div>

              {/* Ping interval selection */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  GPS Tracking Resolution (Interval)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['5', '10', '30'].map(seconds => (
                    <button
                      key={seconds}
                      onClick={() => setPingInterval(seconds)}
                      className={`py-1.5 border rounded-lg text-[10px] font-semibold transition-all ${
                        pingInterval === seconds
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {seconds} Seconds
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed threshold warning */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Speed Limit Warning Threshold
                </label>
                <select
                  value={speedLimit}
                  onChange={(e) => setSpeedLimit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="60">60 km/h (Local)</option>
                  <option value="80">80 km/h (Highway Mini)</option>
                  <option value="100">100 km/h (Standard Highway)</option>
                  <option value="120">120 km/h (High-speed Express)</option>
                </select>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 rounded-xl py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-red-100 cursor-pointer"
            >
              <LogOut size={14} /> Log Out Account
            </button>
          </div>
        )}
      </div>

      {/* Slide-over / Modal for Adding Drivers */}
      <AnimatePresence>
        {showAddModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-2xl p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-2 shrink-0">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Add New Driver Profile</h4>
                  <p className="text-[9px] text-slate-400">All fields marked with * are required</p>
                </div>
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setAddError(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {addError && (
                <div className="bg-red-50 text-red-600 p-2.5 rounded-xl text-[10px] font-medium border border-red-100 mb-2 shrink-0">
                  {addError}
                </div>
              )}

              <form onSubmit={handleAddDriver} className="flex-1 overflow-y-auto pr-1 space-y-4">
                {/* SECTION 1: Personal Details */}
                <div className="space-y-3">
                  <h5 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest border-b border-slate-100 pb-1">1. Personal Details</h5>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Driver Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newDriverName}
                        onChange={(e) => setNewDriverName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Driver ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={newDriverId}
                        onChange={(e) => setNewDriverId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="e.g. DRV-1001"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={newDriverPhone}
                        onChange={(e) => setNewDriverPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="e.g. +1 (555) 019-2834"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Date of Birth (DOB)
                      </label>
                      <input
                        type="date"
                        value={newDriverDob}
                        onChange={(e) => setNewDriverDob(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Full Address
                    </label>
                    <input
                      type="text"
                      value={newDriverAddress}
                      onChange={(e) => setNewDriverAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      placeholder="e.g. 104 Industrial Area Rd, Sector 4"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Emergency Contact (Optional)
                      </label>
                      <input
                        type="tel"
                        value={newDriverEmergencyContact}
                        onChange={(e) => setNewDriverEmergencyContact(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="e.g. +1 (555) 012-3456"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Company Name (Auto)
                      </label>
                      <input
                        type="text"
                        disabled
                        value="DN Tracker"
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-500 focus:outline-none cursor-not-allowed font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Account Security */}
                <div className="space-y-3 pt-1">
                  <h5 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest border-b border-slate-100 pb-1">2. Account Credentials</h5>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Email Address (Login ID) *
                      </label>
                      <input
                        type="email"
                        required
                        value={newDriverEmail}
                        onChange={(e) => setNewDriverEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="driver@dntracker.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Account Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={newDriverPassword}
                        onChange={(e) => setNewDriverPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="Define password"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Vehicle Specs */}
                <div className="space-y-3 pt-1">
                  <h5 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest border-b border-slate-100 pb-1">3. Fleet Vehicle Details</h5>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Vehicle Plate Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={newDriverPlate}
                        onChange={(e) => setNewDriverPlate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 uppercase"
                        placeholder="e.g. TX-982-DN"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Vehicle Name / Type
                      </label>
                      <input
                        type="text"
                        value={newDriverVehicleName}
                        onChange={(e) => setNewDriverVehicleName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="e.g. Toyota Hilux (Optional)"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 4: Driving License */}
                <div className="space-y-3 pt-1">
                  <h5 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest border-b border-slate-100 pb-1">4. Driving License</h5>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        License Number
                      </label>
                      <input
                        type="text"
                        value={newDriverLicenseNumber}
                        onChange={(e) => setNewDriverLicenseNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 uppercase"
                        placeholder="e.g. DL-98103A"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        License Expiry Date
                      </label>
                      <input
                        type="date"
                        value={newDriverLicenseExpiry}
                        onChange={(e) => setNewDriverLicenseExpiry(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 pb-1 shrink-0">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:bg-blue-400"
                  >
                    {isSubmitting ? 'Registering Driver...' : 'Save Driver Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-over / Modal for Editing Drivers */}
      <AnimatePresence>
        {showEditModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-2xl p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-2 shrink-0">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Edit Driver Profile</h4>
                  <p className="text-[9px] text-slate-400">Driver ID & Email login cannot be altered</p>
                </div>
                <button 
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDriver(null);
                    setEditError(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {editError && (
                <div className="bg-red-50 text-red-600 p-2.5 rounded-xl text-[10px] font-medium border border-red-100 mb-2 shrink-0">
                  {editError}
                </div>
              )}

              <form onSubmit={handleEditDriverSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4">
                {/* SECTION 1: Personal Details */}
                <div className="space-y-3">
                  <h5 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest border-b border-slate-100 pb-1">1. Personal Details</h5>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Driver Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={editDriverName}
                        onChange={(e) => setEditDriverName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Driver ID (Read-only)
                      </label>
                      <input
                        type="text"
                        disabled
                        value={editingDriver?.id || ''}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-400 focus:outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={editDriverPhone}
                        onChange={(e) => setEditDriverPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="e.g. +1 (555) 019-2834"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Date of Birth (DOB)
                      </label>
                      <input
                        type="date"
                        value={editDriverDob}
                        onChange={(e) => setEditDriverDob(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Full Address
                    </label>
                    <input
                      type="text"
                      value={editDriverAddress}
                      onChange={(e) => setEditDriverAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      placeholder="e.g. 104 Industrial Area Rd, Sector 4"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Emergency Contact (Optional)
                      </label>
                      <input
                        type="tel"
                        value={editDriverEmergencyContact}
                        onChange={(e) => setEditDriverEmergencyContact(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="Emergency Contact"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Company Name (Auto)
                      </label>
                      <input
                        type="text"
                        disabled
                        value="DN Tracker"
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-500 focus:outline-none cursor-not-allowed font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Account Security */}
                <div className="space-y-3 pt-1">
                  <h5 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest border-b border-slate-100 pb-1">2. Account Credentials & Status</h5>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Email Address (Read-only)
                      </label>
                      <input
                        type="email"
                        disabled
                        value={editDriverEmail}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-400 focus:outline-none cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Change Password (Optional)
                      </label>
                      <input
                        type="password"
                        value={editDriverPassword}
                        onChange={(e) => setEditDriverPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="Leave blank to retain current"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Live Status (Controlled Automatically)
                    </label>
                    <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700">
                      <span className={`w-2 h-2 rounded-full ${
                        editingDriver && activeDriverIds.has(editingDriver.id) 
                          ? 'bg-emerald-500 animate-pulse' 
                          : 'bg-slate-400'
                      }`} />
                      <span className="capitalize">{editingDriver && activeDriverIds.has(editingDriver.id) ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Vehicle Specs */}
                <div className="space-y-3 pt-1">
                  <h5 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest border-b border-slate-100 pb-1">3. Fleet Vehicle Details</h5>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Vehicle Plate Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={editDriverPlate}
                        onChange={(e) => setEditDriverPlate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 uppercase"
                        placeholder="e.g. TX-982-DN"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Vehicle Name / Type
                      </label>
                      <input
                        type="text"
                        value={editDriverVehicleName}
                        onChange={(e) => setEditDriverVehicleName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        placeholder="e.g. Toyota Hilux"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 4: Driving License */}
                <div className="space-y-3 pt-1">
                  <h5 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest border-b border-slate-100 pb-1">4. Driving License</h5>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        License Number
                      </label>
                      <input
                        type="text"
                        value={editDriverLicenseNumber}
                        onChange={(e) => setEditDriverLicenseNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 uppercase"
                        placeholder="e.g. DL-98103A"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        License Expiry Date
                      </label>
                      <input
                        type="date"
                        value={editDriverLicenseExpiry}
                        onChange={(e) => setEditDriverLicenseExpiry(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 pb-1 shrink-0">
                  <button
                    type="submit"
                    disabled={isEditingSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:bg-blue-400"
                  >
                    {isEditingSubmitting ? 'Saving Changes...' : 'Save Updated Driver'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-over / Modal for Deleting Drivers */}
      <AnimatePresence>
        {driverToDelete && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center z-50 p-4">
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white w-full rounded-2xl p-5 shadow-2xl border border-slate-100 space-y-4 z-55"
            >
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-red-600">
                  <AlertCircle size={16} />
                  Delete Driver Profile?
                </h4>
                <button 
                  onClick={() => {
                    setDriverToDelete(null);
                    setDeleteError(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
              </div>

              {deleteError && (
                <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-[10px] font-medium border border-red-100">
                  {deleteError}
                </div>
              )}

              <p className="text-xs text-slate-500 leading-relaxed">
                Are you absolutely sure you want to delete <strong className="text-slate-800 font-semibold">{driverToDelete.name}</strong>? 
                This will permanently remove their driver document, login account, location tracking logs, and trip reports from Firestore. This action cannot be undone.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDriverToDelete(null);
                    setDeleteError(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeDeleteDriver}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer text-center"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-over / Modal for Deleting Trip Reports */}
      <AnimatePresence>
        {showDeleteReportConfirm && selectedReport && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center z-55 p-4">
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white w-full rounded-2xl p-5 shadow-2xl border border-slate-100 space-y-4 z-55"
            >
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-red-600">
                  <AlertCircle size={16} />
                  Delete Report?
                </h4>
                <button 
                  onClick={() => {
                    setShowDeleteReportConfirm(false);
                    setDeleteReportError(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
              </div>

              {deleteReportError && (
                <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-[10px] font-medium border border-red-100">
                  {deleteReportError}
                </div>
              )}

              <p className="text-xs text-slate-500 leading-relaxed">
                Delete this report permanently? <br />
                This action cannot be undone.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteReportConfirm(false);
                    setDeleteReportError(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteReport}
                  disabled={isDeletingReport}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer text-center"
                >
                  {isDeletingReport ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Details Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center z-50 p-4">
            <motion.div
              initial={{ y: 150, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 150, opacity: 0 }}
              className="bg-white w-full max-h-[85vh] rounded-t-3xl p-5 shadow-2xl border border-slate-100 flex flex-col overflow-hidden space-y-4"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-50 pb-3">
                <div>
                  <span className="text-[9px] font-bold text-blue-600 font-mono uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    Shift Report #{selectedReport.id}
                  </span>
                  <h4 className="text-sm font-bold text-slate-800 mt-1">{selectedReport.driverName}</h4>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase">Vehicle: {selectedReport.vehiclePlate} &bull; {selectedReport.date}</p>
                </div>
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Details */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {/* 4 Stats Grid */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Distance</span>
                    <span className="text-xs font-black text-blue-600">{selectedReport.distanceKm} km</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Duration</span>
                    <span className="text-xs font-black text-slate-800">{formatDuration(selectedReport.startTime, selectedReport.endTime)}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Avg Speed</span>
                    <span className="text-xs font-black text-slate-800">{selectedReport.avgSpeed || '0'} km/h</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Max Speed</span>
                    <span className="text-xs font-black text-red-600">{selectedReport.maxSpeed || '0'} km/h</span>
                  </div>
                </div>

                {/* Locations Start / End */}
                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-wider block mb-0.5">Start Location</span>
                    <span className="font-semibold text-slate-700 block truncate">{selectedReport.startLocation}</span>
                    <span className="text-[8px] text-slate-400 font-mono mt-0.5 block">{new Date(selectedReport.startTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                  </div>
                  <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[8px] font-bold text-red-500 uppercase tracking-wider block mb-0.5">End Location</span>
                    <span className="font-semibold text-slate-700 block truncate">{selectedReport.endLocation || 'Active Now'}</span>
                    <span className="text-[8px] text-slate-400 font-mono mt-0.5 block">{selectedReport.endTime ? new Date(selectedReport.endTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : 'Ongoing'}</span>
                  </div>
                </div>

                {/* Route Vector Map */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">GPS Route Visualization</label>
                  {isLoadingLogs ? (
                    <div className="h-44 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-1.5">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[10px] font-semibold">Loading telemetry trail...</span>
                    </div>
                  ) : (
                    renderReportRouteSvg(selectedReportLogs)
                  )}
                </div>

                {/* Full Timeline */}
                <div className="space-y-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Telemetry Logs Timeline</label>
                  <div className="border border-slate-100 rounded-xl divide-y divide-slate-50 max-h-40 overflow-y-auto bg-slate-50/30">
                    {selectedReportLogs.map((log, index) => (
                      <div key={index} className="flex items-center justify-between p-2 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${log.speed > 80 ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`}></span>
                          <span className="font-mono text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</span>
                        </div>
                        <div className="flex gap-2 items-center font-mono text-slate-600">
                          <span className="font-bold">{log.speed} km/h</span>
                          <span className="text-[8px] text-slate-400">({log.latitude.toFixed(4)}, {log.longitude.toFixed(4)})</span>
                        </div>
                      </div>
                    ))}
                    {selectedReportLogs.length === 0 && !isLoadingLogs && (
                      <div className="p-4 text-center text-[10px] text-slate-400 italic">No GPS timeline log entries found for this shift.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Print and Export CTA Footer */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2.5 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => handlePrintReport(selectedReport, selectedReportLogs)}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Printer size={13} /> Print Report
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadCSV(selectedReport, selectedReportLogs)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Download size={13} /> Export GPS CSV
                </button>
                {user.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteReportConfirm(true)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Trash2 size={13} /> Delete Report
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'map' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <MapIcon size={18} />
          <span className="text-[8px] uppercase tracking-wider">Map</span>
        </button>

        <button
          onClick={() => setActiveTab('drivers')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'drivers' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Users size={18} />
          <span className="text-[8px] uppercase tracking-wider">Drivers</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'reports' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileBarChart size={18} />
          <span className="text-[8px] uppercase tracking-wider">Reports</span>
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
