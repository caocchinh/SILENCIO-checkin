"use client";
import { useDevices } from "@yudiel/react-qr-scanner";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCustomerInfoBySession } from "@/server/actions";
import dynamic from "next/dynamic";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, CheckCircle2, XCircle, Clock, User, Mail, Home, Ticket, QrCode, Users } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
  { ssr: false }
);

const AdminIndex = () => {
  const devices = useDevices();
  console.log(devices);
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>(
    undefined
  );
  const [scannedData, setScannedData] = useState<string>("");
  const [key, setKey] = useState<number>(0);
  const [scannerKey, setScannerKey] = useState<number>(0);
  const lastKeyUpdateRef = useRef<number>(0);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Fetch customer info when scannedData changes
  const {
    data: customerResponse,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["customerInfo", scannedData + key],
    queryFn: async () => {
      if (!scannedData) return null;
      const response = await getCustomerInfoBySession({
        sessionId: scannedData,
      });
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.code);
      }
    },
    enabled: !!scannedData,
    retry: false,
  });

  // Update scan status based on query results
  useEffect(() => {
    if (customerResponse) {
      setScanStatus('success');
      setStatusMessage('Customer found!');
      // Play success sound or haptic feedback here if needed
    } else if (error) {
      setScanStatus('error');
      setStatusMessage('Customer not found or invalid QR code');
    } else if (scannedData && !isLoading) {
      setScanStatus('idle');
    }
  }, [customerResponse, error, scannedData, isLoading]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
              <QrCode className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Admin Scanner</h1>
              <p className="text-slate-600">Scan customer QR codes to view check-in information</p>
            </div>
          </div>
        </div>

        {/* Camera Selection */}
        <div className="mb-6 bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
            <Camera className="w-4 h-4" />
            Camera Device
          </label>
          <Select
            onValueChange={(value) => {
              setSelectedDevice(value);
              setScannerKey((prev) => prev + 1);
            }}
            value={selectedDevice}
          >
            <SelectTrigger className="w-full max-w-md border-slate-300 focus:ring-blue-500">
              <SelectValue placeholder="Select a camera device" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner Section */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                QR Scanner
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs font-medium text-slate-600">Active</span>
              </div>
            </div>
            
            <div className="relative">
              <div
                className="w-full max-w-[500px] aspect-square mx-auto border-4 border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-slate-900 relative"
                style={{ transform: "scaleX(-1)" }}
              >
                <Scanner
                  key={scannerKey}
                  onScan={(result) => {
                    setScannedData(result[0].rawValue);
                    const now = Date.now();
                    const timeSinceLastUpdate = now - lastKeyUpdateRef.current;
                    if (!isFetching && timeSinceLastUpdate >= 2000) {
                      setKey((prevKey) => prevKey + 1);
                      lastKeyUpdateRef.current = now;
                    }
                  }}
                  allowMultiple={true}
                  scanDelay={0}
                  constraints={{
                    ...(selectedDevice && { deviceId: selectedDevice }),
                    aspectRatio: 1,
                  }}
                  sound={false}
                />
                {/* Scan overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{ transform: "scaleX(-1)" }}>
                  <div className="absolute inset-0 border-2 border-blue-500/50 rounded-2xl"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-500/30 animate-pulse"></div>
                </div>
              </div>
              
              {/* Status Indicator */}
              <AnimatePresence mode="wait">
                {scannedData && (
                  <motion.div 
                    className="mt-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {isLoading ? (
                      <motion.div 
                        className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg"
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.div 
                          className="w-5 h-5 border-3 border-blue-600 border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        <span className="text-sm font-medium text-blue-900">Verifying QR code...</span>
                      </motion.div>
                    ) : scanStatus === 'success' ? (
                      <motion.div 
                        className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg"
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 15 }}
                        >
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </motion.div>
                        <span className="text-sm font-medium text-green-900">{statusMessage}</span>
                      </motion.div>
                    ) : scanStatus === 'error' ? (
                      <motion.div 
                        className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg"
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 15 }}
                        >
                          <XCircle className="w-5 h-5 text-red-600" />
                        </motion.div>
                        <span className="text-sm font-medium text-red-900">{statusMessage}</span>
                      </motion.div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Customer Information Section */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Information
            </h2>
            
            <div className="min-h-[500px]">
              <AnimatePresence mode="wait">
                {!scannedData ? (
                  <motion.div 
                    key="empty"
                    className="flex flex-col items-center justify-center h-[500px] text-center"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div 
                      className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"
                      animate={{ 
                        scale: [1, 1.05, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <QrCode className="w-10 h-10 text-slate-400" />
                    </motion.div>
                    <motion.p 
                      className="text-slate-500 font-medium"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      No QR code scanned
                    </motion.p>
                    <motion.p 
                      className="text-sm text-slate-400 mt-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      Point the camera at a QR code to begin
                    </motion.p>
                  </motion.div>
                ) : isLoading ? (
                  <motion.div 
                    key="loading"
                    className="flex flex-col items-center justify-center h-[500px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.div 
                      className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mb-4"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.p 
                      className="text-slate-600 font-medium"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      Loading customer data...
                    </motion.p>
                  </motion.div>
                ) : customerResponse ? (
                <motion.div 
                  key="customer-data"
                  className="space-y-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* Check-in Status Badge */}
                  <motion.div 
                    className={`p-4 rounded-lg border-2 ${
                      customerResponse.hasCheckedIn 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-amber-50 border-amber-200'
                    }`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  >
                    <div className="flex items-center gap-2">
                      {customerResponse.hasCheckedIn ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      ) : (
                        <Clock className="w-6 h-6 text-amber-600" />
                      )}
                      <div>
                        <p className={`font-bold ${
                          customerResponse.hasCheckedIn ? 'text-green-900' : 'text-amber-900'
                        }`}>
                          {customerResponse.hasCheckedIn ? 'Checked In' : 'Not Checked In'}
                        </p>
                        <p className={`text-xs ${
                          customerResponse.hasCheckedIn ? 'text-green-700' : 'text-amber-700'
                        }`}>
                          {customerResponse.hasCheckedIn ? 'Customer has been verified' : 'Awaiting check-in'}
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Personal Information */}
                  <motion.div 
                    className="space-y-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Personal Details</h3>
                    
                    <motion.div 
                      className="bg-slate-50 p-4 rounded-lg space-y-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25 }}
                    >
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-slate-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 font-medium">Full Name</p>
                          <p className="text-base font-semibold text-slate-900">{customerResponse.name}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-slate-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 font-medium">Email Address</p>
                          <p className="text-base font-medium text-slate-900">{customerResponse.email}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center mt-0.5">
                            <span className="text-xs font-bold text-blue-700">ID</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">Student ID</p>
                            <p className="text-base font-semibold text-slate-900">{customerResponse.studentId}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <Home className="w-5 h-5 text-slate-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">Homeroom</p>
                            <p className="text-base font-semibold text-slate-900">{customerResponse.homeroom}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>

                  {/* Ticket Information */}
                  <motion.div 
                    className="space-y-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Ticket & Queue Info</h3>
                    
                    <motion.div 
                      className="bg-slate-50 p-4 rounded-lg space-y-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 }}
                    >
                      <div className="flex items-start gap-3">
                        <Ticket className="w-5 h-5 text-slate-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 font-medium">Ticket Type</p>
                          <p className="text-base font-semibold text-slate-900">{customerResponse.ticketType}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Home className="w-5 h-5 text-slate-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 font-medium">Haunted House</p>
                          <p className="text-base font-semibold text-slate-900">{customerResponse.hauntedHouseName}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Users className="w-5 h-5 text-slate-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 font-medium">Queue Number</p>
                          <motion.p 
                            className="text-2xl font-bold text-blue-600"
                            initial={{ scale: 1 }}
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                          >
                            #{customerResponse.queueNumber}
                          </motion.p>
                        </div>
                      </div>
                      
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">Queue Start</p>
                            <p className="text-sm font-medium text-slate-700">
                              {customerResponse.queueStartTime.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">Queue End</p>
                            <p className="text-sm font-medium text-slate-700">
                              {customerResponse.queueEndTime.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </motion.div>
              ) : error ? (
                <motion.div 
                  key="error"
                  className="flex flex-col items-center justify-center h-[500px] text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div 
                    className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <XCircle className="w-10 h-10 text-red-600" />
                  </motion.div>
                  <motion.p 
                    className="text-red-900 font-bold text-lg mb-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    Error Loading Data
                  </motion.p>
                  <motion.p 
                    className="text-red-600 text-sm mb-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    {error.message}
                  </motion.p>
                  <motion.p 
                    className="text-slate-500 text-xs"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    Please try scanning again
                  </motion.p>
                </motion.div>
              ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminIndex;
