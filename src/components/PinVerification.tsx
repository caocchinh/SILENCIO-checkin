"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePinVerification } from "@/context/PinVerificationContext";
import { Lock, AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface PinVerificationProps {
  children: React.ReactNode;
}

export const PinVerification: React.FC<PinVerificationProps> = ({
  children,
}) => {
  const {
    isVerified,
    isLoading,
    error: contextError,
    verifyPin,
    clearError,
  } = usePinVerification();
  const [pin, setPin] = useState<string>("");
  const [localError, setLocalError] = useState<string>("");
  const firstSlotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPin("");
  }, [isLoading]);

  const verifyPinMutation = useMutation({
    mutationFn: async (pinString: string) => {
      const result = await verifyPin(pinString);
      if (!result.success) {
        throw new Error(result.error || "Mã PIN không đúng. Vui lòng thử lại.");
      }
      return result;
    },
    onSuccess: () => {
      setPin("");
    },
    onError: (error: Error) => {
      setLocalError(error.message);
      setPin("");
      setTimeout(() => {
        firstSlotRef.current?.focus();
      }, 1000);
    },
    onMutate: () => {
      setLocalError("");
      clearError();
    },
  });

  const displayError = localError || contextError;

  useEffect(() => {
    if (pin.length > 0) {
      setLocalError("");
      clearError();
    }
  }, [pin, clearError]);

  const handleRetry = () => {
    setLocalError("");
    clearError();
    setPin("");
    setTimeout(() => {
      firstSlotRef.current?.focus();
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-gray-600">Đang kiểm tra xác thực...</p>
          {contextError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 max-w-md rounded-lg bg-white p-4 shadow-lg"
            >
              <div className="flex items-start gap-3">
                <WifiOff className="h-5 w-5 flex-shrink-0 text-orange-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Lỗi kết nối
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{contextError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Tải lại trang
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
        >
          <div className="mb-8 flex flex-col items-center gap-4">
            <div className="rounded-full bg-blue-100 p-4">
              <Lock className="h-8 w-8 text-blue-600" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Xác thực staff
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Nhập mã PIN để truy cập trang quản trị
              </p>
            </div>
          </div>

          <div className="mb-6 flex justify-center">
            <InputOTP
              maxLength={6}
              value={pin}
              onChange={(e) => {
                if (e.length === 6) {
                  verifyPinMutation.mutate(e);
                }
                setPin(e);
              }}
              disabled={verifyPinMutation.isPending}
            >
              <InputOTPGroup className="gap-2">
                {[...Array(6)].map((_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    ref={index === 0 ? firstSlotRef : null}
                    className={`h-14 w-12 text-xl font-semibold ${
                      displayError ? "border-red-300 bg-red-50" : ""
                    }`}
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {displayError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {displayError.includes("kết nối") ||
                displayError.includes("máy chủ") ? (
                  <WifiOff className="h-5 w-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <span>{displayError}</span>
                  {(displayError.includes("kết nối") ||
                    displayError.includes("máy chủ")) && (
                    <button
                      onClick={handleRetry}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Thử lại
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {verifyPinMutation.isPending && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
              <span>Đang xác thực...</span>
            </div>
          )}

          <div className="mt-6 rounded-lg bg-blue-50 p-4">
            <p className="text-center text-xs text-gray-600">
              <span className="font-semibold">Lưu ý:</span> Vì bảo mật, bạn sẽ
              cần nhập lại mã PIN khi chuyển tab hoặc sau 5 phút không hoạt
              động.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};
