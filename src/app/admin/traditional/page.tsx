"use client";

import { useQuery } from "@tanstack/react-query";
import { CustomerInfo } from "@/constants/types";
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
} from "lucide-react";
import { motion } from "motion/react";
import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

interface AllCustomerInfoResponse {
  customers: CustomerInfo[];
  total: number;
}

const AdminTraditionalPage = () => {
  const [searchQuery, setSearchQuery] = useState("");

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
    // refetchInterval: 15000, // Auto-refresh every 15 seconds
    // retry: 3,
  });

  // Fuzzy search filter
  const filteredCustomers = useMemo(() => {
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

  return (
    <div className="min-h-screen w-full p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-slate-200">
          <div className="flex items-center justify-between sm:flex-row flex-col gap-4">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Dữ liệu khách hàng
                </h1>
                <p className="text-sm text-slate-500 text-center sm:text-left">
                  {customerData
                    ? searchQuery
                      ? `${filteredCustomers.length} / ${customerData.total} khách hàng`
                      : `Tổng số: ${customerData.total} khách hàng`
                    : null}
                </p>
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
            className="flex flex-col items-center justify-center py-20"
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
            className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center"
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
            className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col gap-2 mt-0 p-4">
              <ScrollArea className="h-[75vh] pr-2 w-full" type="always">
                <div>
                  <Accordion type="multiple" className="w-full">
                    {filteredCustomers.map((order, orderIndex) => {
                      return (
                        <AccordionItem
                          key={`${order.studentId}-${orderIndex}`}
                          value={order.studentId}
                        >
                          <AccordionTrigger className="cursor-pointer">
                            <div className="flex items-center justify-between w-full pr-4 flex-wrap gap-4">
                              <div className="flex items-center gap-3">
                                {orderIndex + 1}.
                                <div className="text-left">
                                  <div className="font-medium">
                                    {order.name} - {order.studentId} -{" "}
                                    {order.hasCheckedIn ? (
                                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                        ✓ Đã check-in
                                      </span>
                                    ) : (
                                      <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                                        ⏳ Chưa check-in
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1"></div>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="border rounded-lg p-3 space-y-3 bg-muted/30 mt-2">
                              {/* Customer Information */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <div className="flex items-start gap-2">
                                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                      <div className="text-xs text-muted-foreground">
                                        Tên
                                      </div>
                                      <div className="font-medium">
                                        {order.name}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                      <div className="text-xs text-muted-foreground">
                                        Lớp
                                      </div>
                                      <div className="font-medium">
                                        {order.homeroom}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-start gap-2">
                                    <Receipt className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                      <div className="text-xs text-muted-foreground">
                                        Mã học sinh
                                      </div>
                                      <div className="font-medium font-mono">
                                        {order.studentId}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                      <div className="text-xs text-muted-foreground">
                                        Email
                                      </div>
                                      <div className="font-medium text-sm break-all">
                                        {order.email}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Notice and Email Status */}
                              <>
                                <Separator />
                                {/* <div className="space-y-2">
                                  <div className="flex items-start gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                      <div className="text-xs text-muted-foreground">
                                        Ghi chú:{" "}
                                        {order.buyerNotice ||
                                          "Không có ghi chú"}
                                      </div>
                                    </div>
                                  </div>
                                {order.emailStatus && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <div className="text-xs">
                                      <span className="text-muted-foreground">
                                        Trạng thái gửi email xác nhận vé:{" "}
                                      </span>
                                      <span
                                        className={cn(
                                          "font-medium",
                                          order.emailStatus ===
                                            SENT_EMAIL_STATUS
                                            ? "text-green-600 dark:text-green-400"
                                            : order.emailStatus ===
                                              FAILED_EMAIL_STATUS
                                            ? "text-red-600 dark:text-red-400"
                                            : "text-amber-600 dark:text-amber-400"
                                        )}
                                      >
                                        {order.emailStatus}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                
                              </div> */}
                              </>
                            </div>
                          </AccordionContent>
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
            className="bg-white rounded-xl shadow-lg p-12 text-center border border-slate-200"
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
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Xóa tìm kiếm
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdminTraditionalPage;
