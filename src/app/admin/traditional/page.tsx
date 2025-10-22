/* eslint-disable @next/next/no-img-element */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AllCustomerInfoResponse, CustomerInfo } from "@/constants/types";
import {
  Loader2,
  AlertCircle,
  Search,
  RefreshCw,
  X,
  Receipt,
  User,
  FileText,
  Mail,
  Ticket,
  GhostIcon,
  ListOrdered,
  UserCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import { useState, useMemo, useCallback } from "react";
import { useAblyChannel } from "@/hooks/useAblyChannel";
import { CHANNELS, EVENT_NAMES, type CustomerUpdateMessage } from "@/lib/ably";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  cn,
  errorToast,
  successToast,
  updateAllCustomersCheckInStatus,
} from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { TICKET_IMAGE } from "@/constants/constants";
import { checkInUser } from "@/server/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getErrorMessage } from "@/constants/errors";

const AdminTraditionalPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentAccordionItem, setCurrentAccordionItem] = useState<string>("");
  const [isCheckInConfirmDialogOpen, setIsCheckInConfirmDialogOpen] =
    useState(false);
  const [chosenCustomer, setChosenCustomer] = useState<CustomerInfo | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const result = await checkInUser({ customerId });
      if (!result.success) {
        throw new Error(result.code || "Failed to check in customer");
      }
      return result.data;
    },
    onSuccess: () => {
      successToast({
        message: "Thành công!",
        description: "Khách hàng đã được check in.",
      });
      setIsCheckInConfirmDialogOpen(false);
      if (chosenCustomer?.studentId) {
        updateAllCustomersCheckInStatus(queryClient, chosenCustomer.studentId);
      }
      setChosenCustomer(null);
    },
    onError: (error: Error) => {
      const message = getErrorMessage(
        error.message || "Không thể check in khách hàng."
      );
      setErrorMessage(message);
      errorToast({
        message: message,
      });
    },
  });

  // Ably real-time message handler
  const handleAblyMessage = useCallback(
    (message: CustomerUpdateMessage) => {
      if (message.type === EVENT_NAMES.CHECKED_IN && message.data?.studentId) {
        if (
          message.data.studentId === chosenCustomer?.studentId &&
          !checkInMutation.isPending &&
          !chosenCustomer?.hasCheckedIn
        ) {
          setIsCheckInConfirmDialogOpen(false);
          setChosenCustomer(null);
          errorToast({
            message: "Chú ý!",
            description: "Khách hàng đã check in rồi.",
          });
        }
        // Update React Query cache with the checked-in customer
        updateAllCustomersCheckInStatus(queryClient, message.data?.studentId);
      } else if (message.type === "refresh_all") {
        // Refetch all data
        queryClient.invalidateQueries({ queryKey: ["allCustomerInfo"] });
      }
    },
    [
      checkInMutation.isPending,
      chosenCustomer?.hasCheckedIn,
      chosenCustomer?.studentId,
      queryClient,
    ]
  );

  // Initialize Ably connection
  const { isConnected, connectionState } = useAblyChannel({
    channelName: CHANNELS.CUSTOMER_UPDATES,
    onMessage: handleAblyMessage,
  });

  const {
    data: customerData,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery<AllCustomerInfoResponse>({
    queryKey: ["allCustomerInfo"],
    queryFn: async () => {
      const response = await fetch("/api/allCustomerInfo");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch customer data");
      }

      return response.json();
    },
    refetchInterval: 60000, // Auto-refresh every 2 minutes
  });

  // Fuzzy search filter
  const filteredCustomers = useMemo((): CustomerInfo[] => {
    if (!customerData?.customers) return [];
    if (!searchQuery.trim()) return customerData.customers;

    const query = searchQuery.toLowerCase().trim();

    return customerData.customers.filter((customer) => {
      const name = customer.name.toLowerCase();
      const studentId = customer.studentId.toLowerCase();
      const email = customer.email.toLowerCase();

      // Check if query matches name, studentId, or email
      return (
        name.includes(query) ||
        studentId.includes(query) ||
        email.includes(query)
      );
    });
  }, [customerData?.customers, searchQuery]);

  // Memoized customer data formatting to avoid recalculation on every render
  const formattedCustomers = useMemo((): (CustomerInfo & {
    formattedStartTime: string;
    formattedEndTime: string;
    ticketImage: string;
  })[] => {
    if (!filteredCustomers) return [];

    return filteredCustomers.map((customer: CustomerInfo) => {
      const startTime = customer.queueStartTime
        ? new Date(customer.queueStartTime).toLocaleString("vi-VN")
        : "Không có";
      const endTime = customer.queueEndTime
        ? new Date(customer.queueEndTime).toLocaleString("vi-VN")
        : "Không có";
      const ticketImage =
        TICKET_IMAGE[
          customer.ticketType.toLowerCase() as keyof typeof TICKET_IMAGE
        ];

      return {
        ...customer,
        formattedStartTime: startTime,
        formattedEndTime: endTime,
        ticketImage,
      };
    });
  }, [filteredCustomers]);

  const handleCheckIn = useCallback((customer: CustomerInfo) => {
    setIsCheckInConfirmDialogOpen(true);
    setChosenCustomer(customer);
  }, []);

  const handleAccordionValueChange = useCallback((value: string) => {
    setCurrentAccordionItem(value);
  }, []);

  return (
    <>
      <div className="min-h-screen w-full p-4">
        <div className=" flex items-start gap-4 justify-center flex-wrap">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-4 border border-slate-200 min-w-[90%] sm:min-w-[400px] max-w-[450px] flex-1">
            <div className="flex items-center sm:items-start justify-between sm:flex-row flex-col gap-4">
              <div className="flex items-start gap-3 justify-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-900">
                      Dữ liệu khách hàng
                    </h1>
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
                  <div className="text-sm text-slate-500 text-center sm:text-left">
                    {customerData ? (
                      searchQuery ? (
                        `${filteredCustomers.length} / ${customerData.total} khách hàng`
                      ) : (
                        <div className="flex-col flex items-start justify-center gap-1">
                          <span> Tổng số: {customerData.total} khách hàng</span>
                          <span>
                            Khách hàng đã check in:{" "}
                            {
                              customerData.customers.filter(
                                (customer) => customer.hasCheckedIn
                              ).length
                            }
                          </span>
                        </div>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => refetch()}
                disabled={isRefetching}
                className="px-4 py-2 bg-[#0084ff] sm:w-auto w-full hover:bg-[#0084ff]/80 cursor-pointer"
              >
                {isRefetching ? "Đang tải" : "Làm mới"}
                <RefreshCw
                  className={cn("w-4 h-4 ml-2", isRefetching && "animate-spin")}
                />
              </Button>
            </div>

            {/* Search Bar */}
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Tìm kiếm theo tên, mã số HS, hoặc email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {searchQuery && (
                <X
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-semibold"
                />
              )}
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <motion.div
              className="flex flex-col items-center justify-center py-20 max-w-7xl flex-1 w-[90%] min-w-[90%] sm:min-w-[700px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Loader2 className="w-12 h-12 text-[#0084ff] animate-spin mb-4" />
              <p className="text-slate-600 font-medium">
                Đang tải thông tin khách hàng...
              </p>
            </motion.div>
          ) : error ? (
            <motion.div
              className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center max-w-7xl w-[90%] min-w-[90%] sm:min-w-[700px]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-red-900 mb-2">
                Không thể tải dữ liệu
              </h3>
              <p className="text-red-700">{error.message}</p>
              <Button
                onClick={() => refetch()}
                variant="destructive"
                className="mt-2 cursor-pointer min-w-[150px]"
              >
                Thử lại
              </Button>
            </motion.div>
          ) : filteredCustomers.length > 0 ? (
            <motion.div
              className="bg-white relative rounded-xl shadow-lg border border-slate-200 overflow-hidden max-w-7xl flex-1 w-[90%] min-w-[90%] sm:min-w-[700px]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {!isConnected && (
                <div className="absolute top-0 text-white gap-2 left-0 w-full h-full bg-black/40  z-10 flex items-center justify-center">
                  <WifiOff className="w-12 h-12 text-red-500 animate-pulse" />
                  Đang đồng bộ hóa dữ liệu
                </div>
              )}
              <div className="flex flex-col gap-2 mt-0 p-4">
                <ScrollArea className="h-[75vh] pr-2 w-full" type="always">
                  <div>
                    <Accordion
                      type="single"
                      collapsible
                      className="w-full"
                      value={currentAccordionItem}
                      onValueChange={handleAccordionValueChange}
                    >
                      {formattedCustomers.map((customer, orderIndex) => {
                        return (
                          <AccordionItem
                            key={customer.studentId}
                            value={customer.studentId}
                          >
                            <AccordionTrigger
                              className={cn(
                                "cursor-pointer mx-2",
                                currentAccordionItem === customer.studentId &&
                                  "text-[#0084ff]"
                              )}
                            >
                              <div className="flex items-center justify-between w-full pr-4 flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                  {orderIndex + 1}.
                                  <div className="text-left flex items-center gap-2 flex-wrap">
                                    <div>
                                      {" "}
                                      {customer.name} - {customer.studentId}{" "}
                                    </div>
                                    {customer.hasCheckedIn ? (
                                      <p className="px-2 py-1 bg-green-100 w-max text-green-800 rounded-full text-md font-semibold">
                                        ✓ Đã check-in
                                      </p>
                                    ) : (
                                      <p className="px-2 py-1 bg-amber-100 w-max text-amber-800 rounded-full text-md font-semibold">
                                        ⏳ Chưa check-in
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>
                            {currentAccordionItem === customer.studentId && (
                              <AccordionContent>
                                <div className="border border-[#0084ff] rounded-lg p-3 bg-muted/30">
                                  {/* Customer Information */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <div className="flex items-start gap-2">
                                        <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <div className="flex-1">
                                          <div className="text-md text-muted-foreground">
                                            Tên
                                          </div>
                                          <div className="font-medium">
                                            {customer.name}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <div className="flex-1">
                                          <div className="text-md text-muted-foreground">
                                            Lớp
                                          </div>
                                          <div className="font-medium">
                                            {customer.homeroom}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex items-start gap-2">
                                        <Receipt className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <div className="flex-1">
                                          <div className="text-md text-muted-foreground">
                                            Mã học sinh
                                          </div>
                                          <div className="font-medium font-mono">
                                            {customer.studentId}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <div className="flex-1">
                                          <div className="text-md text-muted-foreground">
                                            Email
                                          </div>
                                          <div className="font-medium text-sm break-all">
                                            {customer.email}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Notice and Email Status */}
                                  <>
                                    <Separator className="mx-2" />
                                    <div className="space-y-2">
                                      <div className="flex items-start gap-2">
                                        <Ticket className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <div className="flex-1">
                                          <div className="text-md text-muted-foreground">
                                            Hạng vé:{" "}
                                            <span className="text-black font-semibold">
                                              {customer.ticketType}
                                            </span>
                                            <img
                                              src={customer.ticketImage}
                                              alt={customer.ticketType}
                                              className="rounded-sm mt-1"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <GhostIcon className="h-4 w-4 text-muted-foreground" />
                                        <div className="text-md">
                                          <span className="text-muted-foreground">
                                            Nhà ma:{" "}
                                          </span>
                                          <span className="font-semibold">
                                            {customer.hauntedHouseName
                                              ? customer.hauntedHouseName
                                              : "Không có"}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <ListOrdered className="h-4 w-4 text-muted-foreground" />
                                        <div className="text-md">
                                          <span className="text-muted-foreground">
                                            Lượt :{" "}
                                          </span>
                                          <span className="font-semibold text-[#0084ff] ">
                                            #
                                            {customer.queueNumber
                                              ? customer.queueNumber
                                              : "Không có"}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <ListOrdered className="h-4 w-4 text-muted-foreground" />
                                        <div className="text-md">
                                          <span className="text-muted-foreground">
                                            Nhà ma bắt đầu lúc:{" "}
                                          </span>
                                          <span className="font-semibold">
                                            {customer.formattedStartTime}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <ListOrdered className="h-4 w-4 text-muted-foreground" />
                                        <div className="text-md">
                                          <span className="text-muted-foreground">
                                            Nhà ma kết thúc lúc:{" "}
                                          </span>
                                          <span className="font-semibold">
                                            {customer.formattedEndTime}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                  {!customer.hasCheckedIn && (
                                    <Button
                                      className="w-full mt-2 cursor-pointer"
                                      onClick={() => handleCheckIn(customer)}
                                    >
                                      Check in <UserCheck />
                                    </Button>
                                  )}
                                </div>
                              </AccordionContent>
                            )}
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>
                </ScrollArea>
              </div>
            </motion.div>
          ) : (
            <motion.div
              className="bg-white rounded-xl shadow-lg p-12 text-center border border-slate-200 max-w-7xl flex-1 w-[90%] min-w-[90%] sm:min-w-[700px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">
                {searchQuery
                  ? "Không tìm thấy khách hàng nào"
                  : "Không có khách hàng nào"}
              </p>
              {searchQuery && (
                <Button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 bg-[#0084ff] text-white rounded-lg hover:bg-[#0084ff] cursor-pointer"
                >
                  Xóa tìm kiếm
                </Button>
              )}
            </motion.div>
          )}
        </div>
      </div>
      <AlertDialog
        open={isCheckInConfirmDialogOpen}
        onOpenChange={(e) => {
          setIsCheckInConfirmDialogOpen(e);
          setErrorMessage(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Check in</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn check in khách hàng
              <br />{" "}
              <span className="font-semibold text-black">
                {chosenCustomer?.name}
              </span>{" "}
              -
              <span className="font-semibold text-black">
                {chosenCustomer?.studentId}
              </span>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorMessage && <div className="text-red-500">{errorMessage}</div>}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={checkInMutation.isPending}
              className="cursor-pointer"
            >
              Hủy
            </AlertDialogCancel>
            <Button
              onClick={() =>
                chosenCustomer &&
                checkInMutation.mutate(chosenCustomer.studentId)
              }
              disabled={checkInMutation.isPending}
              className="cursor-pointer"
            >
              {checkInMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang check in...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Xác nhận
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminTraditionalPage;
