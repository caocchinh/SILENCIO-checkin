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
  isLoading: boolean;
  error: string | null;
  verifyPin: (pin: string) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Check PIN verification status from server
  const checkPinStatus = useCallback(async () => {
    try {
      setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  // Verify PIN
  const verifyPin = useCallback(async (pin: string): Promise<void> => {
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
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại."
      );
      setIsVerified(false);
    }
  }, []);

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

  // Handle visibility change (tab switch/leave)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (isVerified) {
        if (document.hidden) {
          // Tab is hidden or user left the page
          await clearAdminStatus();
        } else {
          // Tab is visible again, check PIN status
          await checkPinStatus();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearAdminStatus, checkPinStatus, isVerified]);

  // Initial check on mount
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
      clearAdminStatus();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [clearAdminStatus]);

  const value: PinVerificationContextType = {
    isVerified,
    isLoading,
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
