"use server";

import {
  createActionError,
  createActionSuccess,
  type ActionResponse,
} from "@/constants/errors";
import { retryCookies } from "@/dal/retry";
import { verifySession } from "@/dal/verifySession";
import { cookies } from "next/headers";


export async function checkPinStatusAction(): Promise<
  ActionResponse<{ verified: boolean; expired?: boolean }>
> {
  try {
    // Verify the user session first
    const session = await verifySession();

    if (!session) {
      return createActionError("NOT_LOGGED_IN", "Session verification failed");
    }

    // Check if user is admin
    if (session.user.role !== "admin") {
      return createActionError("UNAUTHORIZED", "Unauthorized access");
    }

    // Check if PIN verification cookie exists
    const pinVerifiedCookie = await retryCookies(async () => {
      const cookieStore = await cookies();
      return cookieStore.get("admin_pin_verified");
    }, "get admin PIN verification cookie");

    if (!pinVerifiedCookie) {
      return createActionSuccess<{ verified: boolean }>({ verified: false });
    }

    return createActionSuccess<{ verified: boolean }>({ verified: true });
  } catch (error) {
    console.error("Error checking PIN:", error);
    return createActionError(
      "INTERNAL_SERVER_ERROR",
      "Failed to check PIN verification"
    );
  }
}

export async function verifyAdminPinAction({
  pin,
}: {
  pin: string;
}): Promise<ActionResponse> {
  try {
    // Verify the user session first
    const session = await verifySession();

    if (!session) {
      return createActionError("NOT_LOGGED_IN", "Session verification failed");
    }

    // Check if user is admin
    if (session.user.role !== "admin") {
      return createActionError("UNAUTHORIZED", "Unauthorized access");
    }

    // Validate PIN input
    if (!pin) {
      return createActionError("PIN_REQUIRED", "PIN is required");
    }

    // Verify the PIN
    if (pin === process.env.ADMIN_PIN) {
      // Set a secure cookie with the PIN verification timestamp
      await retryCookies(async () => {
        const cookieStore = await cookies();
        cookieStore.set("admin_pin_verified", Date.now().toString(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 2, // 2 hours
          path: "/",
        });
      }, "set admin PIN verification cookie");

      return createActionSuccess();
    } else {
      return createActionError("PIN_INVALID", "Invalid PIN");
    }
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return createActionError("INTERNAL_SERVER_ERROR", "Failed to verify PIN");
  }
}

export async function clearAdminStatusAction(): Promise<ActionResponse> {
  try {
    // Verify admin session
    const functionInvokerSession = await verifySession();
    if (
      !functionInvokerSession ||
      functionInvokerSession.user.role !== "admin"
    ) {
      return createActionError(
        "SESSION_VERIFICATION_FAILED",
        "Session verification failed"
      );
    }

    await retryCookies(async () => {
      const cookieStore = await cookies();
      cookieStore.delete("admin_pin_verified");
    }, "delete admin PIN verification cookie");

    return createActionSuccess();
  } catch (error) {
    console.error("Error clearing PIN:", error);
    return createActionError(
      "INTERNAL_SERVER_ERROR",
      "Failed to clear PIN verification"
    );
  }
}
