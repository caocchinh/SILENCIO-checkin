/* eslint-disable @next/next/no-img-element */
"use client";
import { useDevices } from "@yudiel/react-qr-scanner";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCustomerInfoBySession, checkInUser } from "@/server/actions";
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
import { TICKET_IMAGE } from "@/constants/constants";
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
import { errorToast, successToast } from "@/lib/utils";
import useSound from "use-sound";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useAblyChannel } from "@/hooks/useAblyChannel";
import { CHANNELS, CustomerUpdateMessage, EVENT_NAMES } from "@/lib/ably";
import { AllCustomerInfoResponse } from "@/constants/types";

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

  useEffect(() => {
    isCheckInConfirmDialogOpenRef.current = isCheckInConfirmDialogOpen;
  }, [isCheckInConfirmDialogOpen]);

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
      personalInfoRef.current?.scrollIntoView({ behavior: "smooth" });
      setIsCustomerAlreadyCheckedInError(false);
      setIsCheckInConfirmDialogOpen(false);
      const response = await getCustomerInfoBySession({
        sessionId: scannedData,
      });
      if (response.success) {
        return response.data;
      } else {
        throw new Error(getErrorMessage(response.code ?? "unknown-error"));
      }
    },
    enabled: !!scannedData,
    retry: false,
  });

  // Mutation for checking in user
  const checkInMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const response = await checkInUser({ customerId });
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.code);
      }
    },
    onSuccess: () => {
      // Update the cached customer info with new check-in status
      setIsCheckInConfirmDialogOpen(false);
      successToast({
        message: "Thành công",
        description: "Khách hàng đã được check in thành công",
      });
    },
    onError: (error) => {
      if (error instanceof Error) {
        if (error.message === ERROR_CODES.CUSTOMER_ALREADY_CHECKED_IN) {
          setIsCustomerAlreadyCheckedInError(true);
          setIsCheckInConfirmDialogOpen(false);
          queryClient.setQueryData(
            ["customerInfo", scannedData + key],
            (oldData: typeof customerResponse) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                hasCheckedIn: true,
              };
            }
          );
        }
        errorToast({
          message: "Thất bại",
          description: getErrorMessage(error.message ?? "unknown-error"),
        });
      }
    },
  });

  // Load selected device from localStorage on mount
  useEffect(() => {
    const savedDevice = localStorage.getItem("admin-scanner-device");
    if (savedDevice) {
      setSelectedDevice(savedDevice);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowScanner(true);
    }, 1000);

    return () => {
      clearTimeout(timer);
      setShowScanner(false);
    };
  }, [scannerKey]);

  const handleAblyMessage = useCallback(
    (message: CustomerUpdateMessage) => {
      console.log("Received Ably message:", message);
      if (message.type === EVENT_NAMES.CHECKED_IN && message.data?.studentId) {
        if (message.data.studentId === customerResponse?.studentId) {
          queryClient.setQueryData(
            ["customerInfo", scannedData + key],
            (oldData: typeof customerResponse) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                hasCheckedIn: true,
              };
            }
          );
        }
        if (
          message.data.studentId === customerResponse?.studentId &&
          !isFetching &&
          !customerResponse.hasCheckedIn
        ) {
          setIsCheckInConfirmDialogOpen(false);
          setIsCustomerAlreadyCheckedInError(true);
          errorToast({
            message: "Chú ý!",
            description: "Khách hàng đã check in rồi.",
          });
        }
        // Update React Query cache with the checked-in customer
        queryClient.setQueryData(
          ["allCustomerInfo"],
          (oldData: AllCustomerInfoResponse | undefined) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              customers: oldData.customers.map((customer) => {
                if (customer.studentId === message.data?.studentId) {
                  return {
                    ...customer,
                    hasCheckedIn: true,
                  };
                }
                return customer;
              }),
            };
          }
        );
      } else if (message.type === "refresh_all") {
        // Refetch all data
        queryClient.invalidateQueries({ queryKey: ["allCustomerInfo"] });
      }
    },
    [
      customerResponse?.hasCheckedIn,
      customerResponse?.studentId,
      isFetching,
      key,
      queryClient,
      scannedData,
    ]
  );

  // Initialize Ably connection
  const { isConnected, connectionState } = useAblyChannel({
    channelName: CHANNELS.CUSTOMER_UPDATES,
    onMessage: handleAblyMessage,
  });

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
                setSelectedDevice(value);
                localStorage.setItem("admin-scanner-device", value);
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
                    if (!isFetching && timeSinceLastUpdate >= 2000) {
                      if (play) play();
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
              Thông tin khách hàng
            </h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    {isConnected ? (
                      <Wifi className="w-5 h-5 text-green-500" />
                    ) : connectionState === "connecting" ? (
                      <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-500  animate-pulse" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {isConnected
                      ? "Đã kết nối thời gian thực"
                      : connectionState === "connecting"
                      ? "Đang kết nối..."
                      : "Mất kết nối"}
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
                    Không có mã QR
                  </motion.p>
                  <motion.p
                    className="text-sm text-slate-400 mt-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    Hãy dùng camera để quét mã QR từ điện thoại của khách
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
                    Đang lấy thông tin...
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
                              ? "Đã check in trước đó"
                              : "Đã check in"
                            : "Đang chờ check in"}
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
                              ? "Vui lòng không đeo vòng tay cho khách này"
                              : null
                            : "Vui lòng kiểm tra lại thông tin khách hàng"}
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
                      Thông tin cá nhân
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
                              Họ và tên
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
                              Mã số HS
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
                              Lớp
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
                      Thông tin vé & nhà ma
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
                              Hạng vé
                            </p>
                            <p className="text-base font-semibold text-slate-900">
                              {customerResponse.ticketType}
                            </p>
                          </div>
                        </div>
                        <img
                          src={
                            TICKET_IMAGE[
                              customerResponse.ticketType.toLowerCase() as keyof typeof TICKET_IMAGE
                            ]
                          }
                          alt={customerResponse.ticketType}
                          className="rounded-sm"
                        />
                      </div>

                      <div className="flex items-start gap-3">
                        <GhostIcon className="w-5 h-5 text-slate-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 font-medium">
                            Nhà ma
                          </p>
                          <p className="text-base font-semibold text-slate-900">
                            {customerResponse.hauntedHouseName
                              ? customerResponse.hauntedHouseName
                              : "Không có"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <ListOrdered className="w-5 h-5 text-slate-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 font-medium">
                            Lượt đi nhà ma
                          </p>
                          <p className="text-2xl font-bold text-[#0084ff]">
                            #
                            {customerResponse.queueNumber
                              ? customerResponse.queueNumber
                              : "Không có"}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">
                              Nhà ma bắt đầu lúc:
                            </p>
                            <p className="text-sm font-medium text-slate-700">
                              {customerResponse.queueStartTime
                                ? new Date(
                                    customerResponse.queueStartTime
                                  ).toLocaleString("vi-VN")
                                : "Không có"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">
                              Nhà ma kết thúc lúc:
                            </p>
                            <p className="text-sm font-medium text-slate-700">
                              {customerResponse.queueEndTime
                                ? new Date(
                                    customerResponse.queueEndTime
                                  ).toLocaleString("vi-VN")
                                : "Không có"}
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
                            disabled={checkInMutation.isPending || !isConnected}
                          >
                            {checkInMutation.isPending ? (
                              "Đang check in..."
                            ) : !isConnected ? (
                              <>
                                Không có kết nối{" "}
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
                              Xác nhận check in
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Bạn có chắc chắn muốn check in cho khách hàng:
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
                              Hủy
                            </AlertDialogCancel>
                            <Button
                              className="cursor-pointer"
                              disabled={
                                checkInMutation.isPending || !isConnected
                              }
                              onClick={() =>
                                checkInMutation.mutate(
                                  customerResponse.studentId
                                )
                              }
                            >
                              {!isConnected ? (
                                <>
                                  Không có kết nối{" "}
                                  <WifiOff className=" animate-pulse" />
                                </>
                              ) : (
                                <>
                                  Xác nhận{" "}
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
