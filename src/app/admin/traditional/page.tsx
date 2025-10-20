"use client";

import { useQuery } from "@tanstack/react-query";
import { CustomerInfo } from "@/constants/types";
import { Loader2, Users, AlertCircle, Search } from "lucide-react";
import { motion } from "motion/react";
import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AllCustomerInfoResponse {
  customers: CustomerInfo[];
  total: number;
}

const AdminTraditionalPage = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: customerData,
    isLoading,
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
    refetchInterval: 15000, // Auto-refresh every 15 seconds
    retry: 3,
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
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Tất cả khách hàng
                </h1>
                <p className="text-sm text-slate-500">
                  {customerData
                    ? searchQuery
                      ? `${filteredCustomers.length} / ${customerData.total} khách hàng`
                      : `Tổng số: ${customerData.total} khách hàng`
                    : "Đang tải..."}
                </p>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Đang tải..." : "Làm mới"}
            </button>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, mã số HS, hoặc email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-semibold"
              >
                ✕
              </button>
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
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
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
            <button
              onClick={() => refetch()}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Thử lại
            </button>
          </motion.div>
        ) : filteredCustomers.length > 0 ? (
          <motion.div
            className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Header */}
            <div className="grid gap-4 bg-slate-100 border-b border-slate-200 px-4 py-3" style={{ gridTemplateColumns: '100px 150px 200px 80px 100px 130px 120px 80px' }}>
              <div className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mã số HS
              </div>
              <div className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                Họ và tên
              </div>
              <div className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider truncate">
                Email
              </div>
              <div className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                Lớp
              </div>
              <div className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                Loại vé
              </div>
              <div className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                Check-in
              </div>
              <div className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nhà ma
              </div>
              <div className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                Lượt
              </div>
            </div>

            {/* Body with ScrollArea */}
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="divide-y divide-slate-200">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.studentId}
                    className="grid gap-4 px-4 py-3 hover:bg-slate-50 transition-colors"
                    style={{ gridTemplateColumns: '100px 150px 200px 80px 100px 130px 120px 80px' }}
                  >
                    <div className="text-sm font-medium text-slate-900">
                      {customer.studentId}
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {customer.name}
                    </div>
                    <div className="text-sm text-slate-600 truncate" title={customer.email}>
                      {customer.email}
                    </div>
                    <div className="text-sm text-slate-600">
                      {customer.homeroom}
                    </div>
                    <div className="text-sm text-slate-600">
                      {customer.ticketType}
                    </div>
                    <div className="text-sm">
                      {customer.hasCheckedIn ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                          ✓ Đã check-in
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                          ⏳ Chưa check-in
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600">
                      {customer.hauntedHouseName || "—"}
                    </div>
                    <div className="text-sm font-semibold text-blue-600">
                      {customer.queueNumber
                        ? `#${customer.queueNumber}`
                        : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
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
