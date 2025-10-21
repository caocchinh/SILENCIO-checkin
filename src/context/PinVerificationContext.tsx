"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { PIN_VERIFICATION_INTERVAL } from "@/constants/constants";

interface PinVerificationContextType {
  isVerified: boolean;
  isLoading: boolean;
  error: string | null;
  verifyPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  clearVerification: () => Promise<{ success: boolean; error?: string }>;
  lockScreen: () => void;
  clearError: () => void;
}

const PinVerificationContext = createContext<
  PinVerificationContextType | undefined
>(undefined);

export const usePinVerification = () => {
  const context = useContext(PinVerificationContext);
  if (!context) {
    throw new Error(
      "usePinVerification must be used within PinVerificationProvider"
    );
  }
  return context;
};

interface PinVerificationProviderProps {
  children: React.ReactNode;
}

export const PinVerificationProvider: React.FC<
  PinVerificationProviderProps
> = ({ children }) => {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Check PIN verification status from server
  const checkPinStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/check-pin", {
        method: "GET",
        credentials: "include",
      });
      setIsLoading(true);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("PIN check failed:", errorData);
        setError(errorData.error || "Không thể kiểm tra trạng thái PIN");
        setIsVerified(false);
        return;
      }

      const data = await response.json();

      if (data.verified) {
        setIsVerified(true);
        setError(null);
      } else {
        setIsVerified(false);
      }
    } catch (error) {
      console.error("Error checking PIN status:", error);
      setError(
        error instanceof Error && error.message.includes("Failed to fetch")
          ? "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng."
          : "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại."
      );
      setIsVerified(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Verify PIN
  const verifyPin = useCallback(
    async (pin: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch("/api/admin/verify-pin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ pin }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setIsVerified(true);
          setError(null);
          lastActivityRef.current = Date.now();
          return { success: true };
        } else {
          // Handle specific error responses
          const errorMessage = data.error || "Mã PIN không đúng";
          setError(errorMessage);
          return { success: false, error: errorMessage };
        }
      } catch (error) {
        console.error("Error verifying PIN:", error);
        const errorMessage =
          error instanceof Error && error.message.includes("Failed to fetch")
            ? "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng."
            : "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.";
        setError(errorMessage);
        setIsVerified(false);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  // Clear verification
  const clearVerification = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/clear-pin", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setIsVerified(true);
        setError(null);
        lastActivityRef.current = Date.now();
        return { success: true };
      } else {
        // Handle specific error responses
        const errorMessage = data.error || "Mã PIN không đúng";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error("Error clearing PIN:", error);
      const errorMessage =
        error instanceof Error && error.message.includes("Failed to fetch")
          ? "Không thể kết nối đến máy chủ."
          : "Đã xảy ra lỗi khi xóa xác thực.";
      return { success: false, error: errorMessage };
    } finally {
      setIsVerified(false);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Lock screen manually
  const lockScreen = useCallback(() => {
    setIsVerified(false);
    setError(null);
    clearVerification();
  }, [clearVerification]);

  // Track user activity
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Check for inactivity
  const checkInactivity = useCallback(() => {
    const currentTime = Date.now();
    const timeSinceLastActivity = currentTime - lastActivityRef.current;

    if (timeSinceLastActivity >= PIN_VERIFICATION_INTERVAL && isVerified) {
      console.log("User inactive for 5 minutes, locking screen...");
      lockScreen();
    }
  }, [isVerified, lockScreen]);

  // Handle visibility change (tab switch/leave)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden or user left the page
        console.log("Tab hidden or user left, clearing verification...");
        clearVerification();
      } else {
        // Tab is visible again, check PIN status
        console.log("Tab visible again, checking PIN status...");
        checkPinStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearVerification, checkPinStatus]);

  // Initial check on mount
  useEffect(() => {
    checkPinStatus();
  }, [checkPinStatus]);

  // Set up periodic check every minute
  useEffect(() => {
    if (isVerified) {
      checkIntervalRef.current = setInterval(() => {
        checkPinStatus();
      }, 60000); // Check every minute
    }

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [isVerified, checkPinStatus]);

  // Set up inactivity check
  useEffect(() => {
    if (isVerified) {
      // Check for inactivity every 30 seconds
      inactivityCheckRef.current = setInterval(() => {
        checkInactivity();
      }, 30000);

      // Track user activity
      const events = ["mousedown", "keydown", "scroll", "touchstart"];
      events.forEach((event) => {
        document.addEventListener(event, handleActivity);
      });

      return () => {
        if (inactivityCheckRef.current) {
          clearInterval(inactivityCheckRef.current);
        }
        events.forEach((event) => {
          document.removeEventListener(event, handleActivity);
        });
      };
    }
  }, [isVerified, handleActivity, checkInactivity]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      clearVerification();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [clearVerification]);

  const value: PinVerificationContextType = {
    isVerified,
    isLoading,
    error,
    verifyPin,
    clearVerification,
    lockScreen,
    clearError,
  };

  return (
    <PinVerificationContext.Provider value={value}>
      {children}
    </PinVerificationContext.Provider>
  );
};
