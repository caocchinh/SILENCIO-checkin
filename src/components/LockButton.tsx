"use client";

import React from "react";
import { Lock } from "lucide-react";
import { usePinVerification } from "@/context/PinVerificationContext";
import { Button } from "./ui/button";

export const LockButton: React.FC = () => {
  const { lockScreen } = usePinVerification();

  return (
    <Button
      onClick={lockScreen}
      variant={"outline"}
      aria-label="Khóa màn hình"
      title="Khóa màn hình"
      className="cursor-pointer flex-1 sm:w-max"
    >
      <Lock className="h-4 w-4" />
      Khóa
    </Button>
  );
};
