"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  checkPinStatusAction,
  verifyAdminPinAction,
  clearAdminStatusAction,
} from "@/server/actions";
import { ERROR_CODES, getErrorMessage } from "@/constants/errors";

interface PinVerificationContextType {
  isVerified: boolean;
  isPending: boolean;
  error: string | null;
  verifyPin: (pin: string) => Promise<{ correctPin: boolean }>;
  clearAdminStatus: () => Promise<void>;
  lockScreen: () => void;
  clearError: () => void;
  getTimeSinceLastActivity: () => number;
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
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Check PIN verification status from server
  const checkPinStatus = useCallback(async () => {
    try {
      const result = await checkPinStatusAction();

      if (!result.success) {
        const errorMessage = result.code || ERROR_CODES.INTERNAL_SERVER_ERROR;
        setError(getErrorMessage(errorMessage));
        setIsVerified(false);
        return;
      }
      if (result.data?.verified) {
        setIsVerified(true);
      } else {
        setIsVerified(false);
      }
      setError(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại."
      );
      setIsVerified(false);
    } finally {
      setIsPending(false);
    }
  }, []);

  // Verify PIN
  const verifyPin = useCallback(
    async (pin: string): Promise<{ correctPin: boolean }> => {
      try {
        const result = await verifyAdminPinAction({ pin });

        if (result.success) {
          setIsVerified(true);
          setError(null);
          lastActivityRef.current = Date.now();
        } else {
          // Handle specific error responses
          const errorMessage = result.code || ERROR_CODES.INTERNAL_SERVER_ERROR;
          setError(getErrorMessage(errorMessage));
        }
        return { correctPin: result.success };
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại."
        );
        setIsVerified(false);
        return { correctPin: false };
      }
    },
    []
  );

  // Clear verification
  const clearAdminStatus = useCallback(async () => {
    setIsVerified(false);
    try {
      const result = await clearAdminStatusAction();

      if (result.success) {
        setError(null);
        lastActivityRef.current = Date.now();
      } else {
        // Handle specific error responses
        const errorMessage = result.code || ERROR_CODES.INTERNAL_SERVER_ERROR;
        setError(getErrorMessage(errorMessage));
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại."
      );
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Lock screen manually
  const lockScreen = useCallback(async () => {
    setError(null);
    await clearAdminStatus();
  }, [clearAdminStatus, setError]);

  // Get time since last activity
  const getTimeSinceLastActivity = useCallback(() => {
    return Date.now() - lastActivityRef.current;
  }, []);

  // Track user activity
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Periodic check every minute when verified
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isVerified) {
      interval = setInterval(() => {
        checkPinStatus();
      }, 60000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isVerified, checkPinStatus]);

  useEffect(() => {
    checkPinStatus();
  }, [checkPinStatus]);

  // Set up inactivity check
  useEffect(() => {
    if (isVerified) {
      // Track user activity
      const events = [
        "mousedown",
        "keydown",
        "scroll",
        "touchstart",
        "mousemove",
      ];
      events.forEach((event) => {
        document.addEventListener(event, handleActivity);
      });

      return () => {
        events.forEach((event) => {
          document.removeEventListener(event, handleActivity);
        });
      };
    }
  }, [isVerified, handleActivity]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable data sending during page unload
      try {
        const url = "/api/admin/clear-status";
        const data = JSON.stringify({});

        // sendBeacon is more reliable than fetch during page unload
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, data);
        } else {
          // Fallback to fetch if sendBeacon is not available
          fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: data,
            keepalive: true, // Keep the request alive during page unload
          }).catch(console.error);
        }
      } catch (error) {
        console.error("Error clearing admin status on beforeunload:", error);
      }
    };

    const handleUnload = () => {
      // Additional attempt using sendBeacon for unload event
      try {
        const url = "/api/admin/clear-status";
        const data = JSON.stringify({});

        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, data);
        }
      } catch (error) {
        console.error("Error clearing admin status on unload:", error);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleUnload);
    };
  }, []);

  const value: PinVerificationContextType = {
    isVerified,
    isPending,
    error,
    verifyPin,
    clearAdminStatus,
    lockScreen,
    clearError,
    getTimeSinceLastActivity,
  };

  return (
    <PinVerificationContext.Provider value={value}>
      {children}
    </PinVerificationContext.Provider>
  );
};
