"use client";

import { usePinVerification } from "@/context/PinVerificationContext";
import { useEffect, useCallback, useState } from "react";
import { PIN_VERIFICATION_INTERVAL } from "@/constants/constants";
import { cn } from "@/lib/utils";

export const ActivityTimer = () => {
  const { getTimeSinceLastActivity, isVerified, lockScreen } =
    usePinVerification();
  const [, setCurrentTime] = useState(Date.now());

  // Check for inactivity - moved outside interval to avoid recreating function
  const checkInactivity = useCallback(() => {
    const timeSinceLastActivity = getTimeSinceLastActivity();

    if (timeSinceLastActivity >= PIN_VERIFICATION_INTERVAL && isVerified) {
      lockScreen();
    }
  }, [getTimeSinceLastActivity, isVerified, lockScreen]);

  // Update every second to show current time and check inactivity
  useEffect(() => {
    if (!isVerified) return;

    const interval = setInterval(() => {
      setCurrentTime(Date.now()); // Update state to trigger re-render
      checkInactivity(); // Check inactivity on each tick
    }, 1000);

    return () => clearInterval(interval);
  }, [isVerified, checkInactivity]);

  if (!isVerified) return null;

  const timeSinceLastActivity = getTimeSinceLastActivity();
  const minutes = Math.floor(timeSinceLastActivity / (1000 * 60));
  const seconds = Math.floor((timeSinceLastActivity % (1000 * 60)) / 1000);

  return (
    <div className="flex items-center justify-center gap-2 absolute top-0 right-0">
      <span
        className={cn("text-sm", timeSinceLastActivity >= PIN_VERIFICATION_INTERVAL * 0.5 ? "text-red-500" : "text-yellow-500")}
      >
        Hoạt động cuối: {minutes}:{seconds.toString().padStart(2, "0")} trước
      </span>
    </div>
  );
};
