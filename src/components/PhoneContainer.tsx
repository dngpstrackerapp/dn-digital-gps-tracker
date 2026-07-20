import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Signal, ArrowLeft, RefreshCw } from 'lucide-react';

interface PhoneContainerProps {
  children: React.ReactNode;
  onResetApp?: () => void;
  screen?: 'splash' | 'login' | 'admin' | 'driver';
}

export default function PhoneContainer({ children, onResetApp, screen }: PhoneContainerProps) {
  const [timeStr, setTimeStr] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(98);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setTimeStr(`${hours}:${minutes} ${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    // Slowly drain battery a little or keep it realistic
    const batteryInterval = setInterval(() => {
      setBatteryLevel(prev => (prev > 15 ? prev - 1 : 98));
    }, 300000);

    return () => {
      clearInterval(interval);
      clearInterval(batteryInterval);
    };
  }, []);

  return (
    <div id="phone-wrapper" className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-0 md:p-6 font-sans select-none overflow-hidden">
      {/* Reset button at top-right on desktop for testing */}
      <div className="hidden md:flex justify-end w-full max-w-[420px] mb-2 px-1">
        <button
          onClick={onResetApp}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors bg-white px-2.5 py-1 rounded-full shadow-xs border border-slate-200"
          title="Simulate restarting the app from Splash screen"
        >
          <RefreshCw size={12} />
          Reset to Splash
        </button>
      </div>

      {/* Outer Phone Shell */}
      <div 
        id="phone-shell" 
        className="relative w-full max-w-[430px] h-screen md:h-[860px] bg-slate-900 md:rounded-[48px] md:shadow-2xl md:border-[12px] md:border-slate-800 flex flex-col overflow-hidden transition-all duration-300"
      >
        {/* Dynamic Punch Hole Camera (hidden on pure mobile viewports to save space) */}
        <div className="hidden md:block absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rounded-full z-50"></div>

        {/* Company Marquee Banner (Conditional) */}
        {screen !== 'splash' && (
          <div 
            id="company-marquee-banner" 
            className="h-8 bg-blue-600 text-white flex items-center overflow-hidden select-none z-40 shrink-0 shadow-sm relative border-b border-blue-500"
          >
            <div className="w-full whitespace-nowrap overflow-hidden">
              <span className="animate-marquee font-bold text-[10px] uppercase tracking-widest block py-1">
                DN TRACKER &bull; Powered by DN DIGITAL SERVICES &nbsp;&nbsp;&nbsp;&nbsp;&bull;&nbsp;&nbsp;&nbsp;&nbsp; DN TRACKER &bull; Powered by DN DIGITAL SERVICES &nbsp;&nbsp;&nbsp;&nbsp;&bull;&nbsp;&nbsp;&nbsp;&nbsp; DN TRACKER &bull; Powered by DN DIGITAL SERVICES
              </span>
            </div>
          </div>
        )}

        {/* Screen Area */}
        <div id="screen-content" className="flex-1 bg-white relative flex flex-col overflow-hidden">
          {children}
        </div>

        {/* Android Gesture Navigation Bar */}
        <div 
          id="gesture-bar" 
          className="h-6 bg-slate-900 flex items-center justify-center select-none shrink-0 z-40"
        >
          {/* Virtual swipe bar */}
          <div className="w-32 h-1 bg-slate-700 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
