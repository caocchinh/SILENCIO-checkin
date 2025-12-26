/* eslint-disable @next/next/no-img-element */
"use client";
import { useDevices } from "@yudiel/react-qr-scanner";
import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import useSound from "use-sound";
import { useAbly } from "@/hooks/useAbly";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Mail,
  Home,
  Ticket,
  QrCode,
  IdCardLanyard,
  UserRoundCheck,
  Loader2,
  GhostIcon,
  ListOrdered,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ERROR_CODES, getErrorMessage } from "@/constants/errors";
import {
  EMAIL_HAUNTED_HOUSE_TICKET_INFO,
  TICKET_IMAGE,
} from "@/constants/constants";
import { CustomerInfo } from "@/constants/types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  errorToast,
  successToast,
  updateCustomerCheckInStatus,
  updateAllCustomersCheckInStatus,
} from "@/lib/utils";
import { Scanner } from "@yudiel/react-qr-scanner";
import { CustomerUpdateMessage, EVENT_NAMES } from "@/lib/ably";

const AdminOnlinePage = () => {
  const devices = useDevices();
  const [play] = useSound("/assets/qrsound.mp3");
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>(
    undefined
  );
  const [scannedData, setScannedData] = useState<string>("");
  const [key, setKey] = useState<number>(0);
  const [scannerKey, setScannerKey] = useState<number>(0);
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const lastKeyUpdateRef = useRef<number>(0);
  const personalInfoRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const [isCheckInConfirmDialogOpen, setIsCheckInConfirmDialogOpen] =
    useState(false);
  const [isCustomerAlreadyCheckedInError, setIsCustomerAlreadyCheckedInError] =
    useState(false);
  const isCheckInConfirmDialogOpenRef = useRef(isCheckInConfirmDialogOpen);
  const [isMounted, setIsMounted] = useState(false);
  const [customerResponse, setCustomerResponse] = useState<CustomerInfo | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Mutation for checking in user via Ably
  const checkInMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const response = await ablyCheckInCustomer(customerId);
      if (response.success) {
        return;
      } else {
        throw new Error(response.code || "unknown-error");
      }
    },
    onSuccess: () => {
      // Update the cached customer info with new check-in status
      setIsCheckInConfirmDialogOpen(false);
      updateCustomerCheckInStatus(queryClient, [
        "customerInfo",
        scannedData + key,
      ]);
      successToast({
        message: "Success!",
        description: "Customer checked in successfully!",
      });
    },
    onError: (error) => {
      if (error instanceof Error) {
        if (error.message === ERROR_CODES.CUSTOMER_ALREADY_CHECKED_IN) {
          setIsCustomerAlreadyCheckedInError(true);
          setIsCheckInConfirmDialogOpen(false);
          updateCustomerCheckInStatus(queryClient, [
            "customerInfo",
            scannedData + key,
          ]);
        }
        errorToast({
          message: "Thất bại",
          description: getErrorMessage(error.message ?? "unknown-error"),
        });
      }
    },
  });

  // Handle Ably messages for customer updates
  const handleCheckinResponse = useCallback(
    async (message: CustomerUpdateMessage) => {
      if (message.type === EVENT_NAMES.CHECKED_IN && message.data?.studentId) {
        if (
          message.data.studentId === customerResponse?.studentId &&
          !isLoading &&
          !customerResponse.hasCheckedIn &&
          !checkInMutation.isPending
        ) {
          setIsCheckInConfirmDialogOpen(false);
          setIsCustomerAlreadyCheckedInError(true);
          errorToast({
            message: "Chú ý!",
            description: "Khách hàng đã check in rồi.",
          });
        }
        // Update local customer state if it matches
        if (message.data.studentId === customerResponse?.studentId) {
          setCustomerResponse((prev) =>
            prev
              ? {
                  ...prev,
                  hasCheckedIn: true,
                }
              : null
          );
        }
        updateAllCustomersCheckInStatus(queryClient, message.data?.studentId);
      } else if (message.type === "refresh_all") {
        // Refetch all data
        queryClient.invalidateQueries({ queryKey: ["allCustomerInfo"] });
      }
    },
    [
      customerResponse?.studentId,
      customerResponse?.hasCheckedIn,
      isLoading,
      checkInMutation.isPending,
      queryClient,
    ]
  );

  // Initialize unified Ably hook for all real-time communication
  const {
    isConnected: isAblyConnected,
    connectionState: ablyConnectionState,
    scanQRCode,
    checkInCustomer: ablyCheckInCustomer,
  } = useAbly({
    onCustomerUpdate: handleCheckinResponse,
  });

  useEffect(() => {
    setTimeout(() => {
      setIsMounted(true);
    }, 0);
  }, []);

  useEffect(() => {
    isCheckInConfirmDialogOpenRef.current = isCheckInConfirmDialogOpen;
  }, [isCheckInConfirmDialogOpen]);

  // Scan QR code using Ably when scannedData changes
  useEffect(() => {
    if (!scannedData) return;

    const performScan = async () => {
      setIsLoading(true);
      setError(null);
      setIsCustomerAlreadyCheckedInError(false);
      setIsCheckInConfirmDialogOpen(false);
      personalInfoRef.current?.scrollIntoView({ behavior: "smooth" });

      console.log("🔍 Starting QR scan:", {
        sessionId: scannedData,
        isAblyConnected,
        ablyConnectionState,
      });

      try {
        const response = await scanQRCode(scannedData);
        console.log("✅ QR scan response:", response);

        if (response.success && response.data) {
          setCustomerResponse(response.data);
        } else {
          console.error("❌ QR scan failed:", response);
          throw new Error(getErrorMessage(response.code ?? "unknown-error"));
        }
      } catch (err) {
        console.error("❌ QR scan error:", err);
        setError(err instanceof Error ? err : new Error("Scan failed"));
        setCustomerResponse(null);
      } finally {
        setIsLoading(false);
      }
    };

    performScan();
  }, [scannedData, key, scanQRCode, isAblyConnected, ablyConnectionState]);

  // Load selected device from localStorage on mount or select the first device available
  useEffect(() => {
    if (isMounted && typeof window !== "undefined" && devices.length > 0) {
      const savedDevice = localStorage.getItem("admin-scanner-device");
      const availableDeviceIds = devices
        .filter((device) => device.deviceId && device.deviceId.trim() !== "")
        .map((device) => device.deviceId);

      if (savedDevice && availableDeviceIds.includes(savedDevice)) {
        setSelectedDevice(savedDevice);
      } else {
        // If saved device doesn't exist or is not available, use the first available device
        const firstDevice = availableDeviceIds[0];
        setSelectedDevice(firstDevice);
        localStorage.setItem("admin-scanner-device", firstDevice);
      }
    }
  }, [isMounted, devices]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowScanner(true);
    }, 1111);

    return () => {
      clearTimeout(timer);
      setShowScanner(false);
    };
  }, [scannerKey]);

  return (
    <div className="min-h-screen flex items-start justify-center w-full  p-2 md:p-4">
      {/* Main Content Grid */}
      <div className="flex flex-row flex-wrap gap-6 w-full md:items-start items-center justify-center">
        {/* Scanner Section */}
        <div className="bg-white h-max rounded-xl shadow-lg p-6 border border-slate-200 flex-1 w-full min-w-[90%] sm:min-w-[420px]  max-w-[550px]">
          <div className=" bg-white rounded-xl mb-3">
            <label className="flex items-center gap-2 text-xl font-semibold text-black  mb-3">
              <Camera />
              Camera
            </label>
            <Select
              onValueChange={(value) => {
                if (value) {
                  setSelectedDevice(value);
                  localStorage.setItem("admin-scanner-device", value);
                }
                setScannerKey((prev) => prev + 1);
              }}
              value={selectedDevice}
            >
              <SelectTrigger className="w-full border-slate-300 focus:ring-blue-500 cursor-pointer">
                <SelectValue placeholder="Select a camera device" />
              </SelectTrigger>
              <SelectContent>
                {devices
                  .filter(
                    (device) => device.deviceId && device.deviceId.trim() !== ""
                  )
                  .map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId}`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <div className="w-full max-w-[500px] aspect-square mx-auto border-4 border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-slate-900 relative">
              {showScanner && (
                <Scanner
                  key={scannerKey}
                  onScan={(result) => {
                    if (isCheckInConfirmDialogOpenRef.current) {
                      return;
                    }
                    const scannedValue = result[0].rawValue;

                    // Validate session ID length (must be 32 characters)
                    if (scannedValue.length !== 32) {
                      return;
                    }

                    setScannedData(scannedValue);

                    const now = Date.now();
                    const timeSinceLastUpdate = now - lastKeyUpdateRef.current;
                    if (!isLoading && timeSinceLastUpdate >= 2000) {
                      if (play) play();
                      setKey((prevKey) => prevKey + 1);
                      lastKeyUpdateRef.current = now;
                    }
                  }}
                  allowMultiple={false}
                  scanDelay={0}
                  constraints={{
                    ...(selectedDevice && { deviceId: selectedDevice }),
                    aspectRatio: 1,
                  }}
                  sound={false}
                />
              )}
              {/* Scan overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ transform: "scaleX(-1)" }}
              >
                <div className="absolute inset-0 border-2 border-blue-500/50 rounded-2xl"></div>
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-500/30 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Information Section */}
        <div
          className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 flex-1 w-full min-w-[90%] sm:min-w-[420px]  max-w-[550px] "
          ref={personalInfoRef}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Information
            </h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    {isAblyConnected ? (
                      <Wifi className="w-5 h-5 text-green-500" />
                    ) : ablyConnectionState === "connecting" ? (
                      <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-500  animate-pulse" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {isAblyConnected
                      ? "Connected in real-time"
                      : ablyConnectionState === "connecting"
                      ? "Connecting..."
                      : "Disconnected"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

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
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
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
                    No QR code yet!
                  </motion.p>
                  <motion.p
                    className="text-sm text-slate-400 mt-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    Please use your phone to scan the QR code from the
                    customer&apos;s phone
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
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <motion.p
                    className="text-slate-600 font-medium"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    Fetching info...
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
                        ? isCustomerAlreadyCheckedInError
                          ? "bg-red-50 border-red-200"
                          : "bg-green-50 border-green-200"
                        : "bg-amber-50 border-amber-200"
                    }`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.1,
                      type: "spring",
                      stiffness: 200,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {customerResponse.hasCheckedIn ? (
                        <CheckCircle2
                          className={`w-6 h-6 ${
                            isCustomerAlreadyCheckedInError
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        />
                      ) : (
                        <Clock className="w-6 h-6 text-amber-600" />
                      )}
                      <div>
                        <p
                          className={`font-bold ${
                            customerResponse.hasCheckedIn
                              ? isCustomerAlreadyCheckedInError
                                ? "text-red-900"
                                : "text-green-900"
                              : "text-amber-900"
                          }`}
                        >
                          {customerResponse.hasCheckedIn
                            ? isCustomerAlreadyCheckedInError
                              ? "Already checked-in before"
                              : "Checked-in"
                            : "Waiting for check-in"}
                        </p>
                        <p
                          className={`text-xs ${
                            customerResponse.hasCheckedIn
                              ? isCustomerAlreadyCheckedInError
                                ? "text-red-700"
                                : "text-green-700"
                              : "text-amber-700"
                          }`}
                        >
                          {customerResponse.hasCheckedIn
                            ? isCustomerAlreadyCheckedInError
                              ? "Please do not wear a bracelet for this customer"
                              : null
                            : "Please check the customer's information"}
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
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                      Personal Information
                    </h3>

                    <motion.div
                      className="bg-slate-50 p-4 rounded-lg space-y-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25 }}
                    >
                      <div className="flex items-center justify-center  flex-wrap ">
                        {" "}
                        <div className="flex items-start gap-3 flex-1 min-w-[150px]">
                          <User className="w-5 h-5 text-slate-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">
                              Name
                            </p>
                            <p className="text-base font-semibold text-slate-900 whitespace-pre-wrap wrap-anywhere max-w-[200px]">
                              {customerResponse.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 flex-1 min-w-[150px]">
                          <Mail className="w-5 h-5 text-slate-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium ">
                              Email
                            </p>
                            <p className="text-base font-medium text-slate-900 whitespace-pre-wrap wrap-anywhere max-w-[200px]">
                              {customerResponse.email}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center  flex-wrap">
                        <div className="flex items-start gap-2 flex-1 min-w-[150px]">
                          <IdCardLanyard className="w-5 h-5 text-slate-600 mt-0.5" />

                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">
                              Student ID
                            </p>
                            <p className="text-base font-semibold text-slate-900">
                              {customerResponse.studentId}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 flex-1 min-w-[150px]">
                          <Home className="w-5 h-5 text-slate-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">
                              Class
                            </p>
                            <p className="text-base font-semibold text-slate-900">
                              {customerResponse.homeroom}
                            </p>
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
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                      Ticket & Haunted House Information
                    </h3>

                    <motion.div
                      className="bg-slate-50 p-4 rounded-lg space-y-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 }}
                    >
                      <div className="flex items-start gap-3 w-full flex-col justify-start">
                        <div className="flex items-center gap-2">
                          <Ticket className="w-5 h-5 text-slate-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">
                              Ticket Type
                            </p>
                            <p className="text-base font-semibold text-slate-900">
                              {customerResponse.ticketType}
                            </p>
                          </div>
                        </div>
                        <img
                          src={
                            TICKET_IMAGE[
                              customerResponse.ticketType as keyof typeof TICKET_IMAGE
                            ]
                          }
                          alt={customerResponse.ticketType}
                          className="rounded-sm"
                        />
                      </div>

                      <div className="flex items-start gap-1 flex-col">
                        <div className="flex items-center gap-2">
                          <GhostIcon className="w-5 h-5 text-slate-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">
                              Haunted House
                            </p>
                            <p className="text-base font-semibold text-slate-900">
                              {customerResponse.hauntedHouseName
                                ? customerResponse.hauntedHouseName
                                : "Not available"}
                            </p>
                          </div>
                        </div>
                        {customerResponse.hauntedHouseName && (
                          <img
                            src={
                              EMAIL_HAUNTED_HOUSE_TICKET_INFO[
                                customerResponse.hauntedHouseName
                              ].ticketImageUrl
                            }
                            alt={customerResponse.hauntedHouseName}
                            className="rounded-sm"
                          />
                        )}
                      </div>

                      <div className="flex items-start gap-3">
                        <ListOrdered className="w-5 h-5 text-slate-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 font-medium">
                            Haunted House Queue Number
                          </p>
                          <p className="text-2xl font-bold text-[#0084ff]">
                            #
                            {customerResponse.queueNumber
                              ? customerResponse.queueNumber
                              : "Not available"}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">
                              Haunted House Start Time:
                            </p>
                            <p className="text-sm font-medium text-slate-700">
                              {customerResponse.queueStartTime
                                ? new Date(
                                    customerResponse.queueStartTime
                                  ).toLocaleString("vi-VN", {
                                    timeZone: "Asia/Ho_Chi_Minh",
                                  })
                                : "None"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">
                              Haunted House End Time:
                            </p>
                            <p className="text-sm font-medium text-slate-700">
                              {customerResponse.queueEndTime
                                ? new Date(
                                    customerResponse.queueEndTime
                                  ).toLocaleString("vi-VN", {
                                    timeZone: "Asia/Ho_Chi_Minh",
                                  })
                                : "None"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    {!customerResponse.hasCheckedIn && (
                      <AlertDialog
                        open={isCheckInConfirmDialogOpen}
                        onOpenChange={setIsCheckInConfirmDialogOpen}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            className="w-full -mt-2 cursor-pointer"
                            disabled={
                              checkInMutation.isPending || !isAblyConnected
                            }
                          >
                            {checkInMutation.isPending ? (
                              "Checking in..."
                            ) : !isAblyConnected ? (
                              <>
                                No connection{" "}
                                <WifiOff className=" animate-pulse" />
                              </>
                            ) : (
                              <>
                                Check in <UserRoundCheck />
                              </>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Confirm check in
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to check in for customer:
                              <br /> <strong>
                                {customerResponse.name}
                              </strong> - {customerResponse.studentId}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel
                              className="cursor-pointer"
                              disabled={checkInMutation.isPending}
                            >
                              Cancel
                            </AlertDialogCancel>
                            <Button
                              className="cursor-pointer"
                              disabled={
                                checkInMutation.isPending || !isAblyConnected
                              }
                              onClick={() =>
                                checkInMutation.mutate(
                                  customerResponse.studentId
                                )
                              }
                            >
                              {!isAblyConnected ? (
                                <>
                                  No connection{" "}
                                  <WifiOff className=" animate-pulse" />
                                </>
                              ) : (
                                <>
                                  Confirm{" "}
                                  {checkInMutation.isPending && (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  )}
                                </>
                              )}
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
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
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                    }}
                  >
                    <XCircle className="w-10 h-10 text-red-600" />
                  </motion.div>
                  <motion.p
                    className="text-red-900 font-bold text-lg mb-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    Không tìm thấy thông tin
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
                    Vui lòng thử lại, hoặc kêu khách hàng refresh website.
                  </motion.p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOnlinePage;
