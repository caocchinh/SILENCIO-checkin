"use server";

import { db } from "@/drizzle/db";
import { session, customer, user } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import {
  createActionError,
  createActionSuccess,
  type ActionResponse,
} from "@/constants/errors";
import { retryDatabase, retryExternalApi, retryCookies } from "@/dal/retry";
import { verifySession } from "@/dal/verifySession";
import { CustomerInfo } from "@/constants/types";
import { getServerAblyClient, CHANNELS, EVENT_NAMES } from "@/lib/ably";
import { ADMIN_PIN } from "@/constants/constants";
import { cookies } from "next/headers";

export async function getCustomerInfoBySession({
  sessionId,
}: {
  sessionId: string;
}): Promise<ActionResponse<CustomerInfo>> {
  const functionInvokerSession = await verifySession();
  if (!functionInvokerSession || functionInvokerSession.user.role !== "admin") {
    return createActionError(
      "SESSION_VERIFICATION_FAILED",
      "Session verification failed"
    );
  }
  try {
    // Validate input
    if (!sessionId || sessionId.trim() === "") {
      return createActionError("INVALID_INPUT", "Session ID is required");
    }

    // Validate session ID length (should be 32 characters)
    if (sessionId.length !== 32) {
      return createActionError(
        "INVALID_INPUT",
        "Session ID must be 32 characters long"
      );
    }

    // Get session from database
    const sessionRecord = await retryDatabase(
      () =>
        db.query.session.findFirst({
          where: eq(session.id, sessionId),
        }),
      "fetch session by ID"
    );

    if (!sessionRecord) {
      return createActionError("CUSTOMER_SESSION_EXPIRED", "Session not found");
    }

    // Check if session has expired
    if (sessionRecord.expiresAt < new Date()) {
      return createActionError(
        "CUSTOMER_SESSION_EXPIRED",
        "Session has expired"
      );
    }

    // Get user from session
    const userRecord = await retryDatabase(
      () =>
        db.query.user.findFirst({
          where: eq(user.id, sessionRecord.userId),
        }),
      "fetch user by ID"
    );

    if (!userRecord) {
      return createActionError("NOT_FOUND", "User not found");
    }

    // Get customer by user email
    const customerRecord = await retryDatabase(
      () =>
        db.query.customer.findFirst({
          where: eq(customer.email, userRecord.email),
          with: {
            queueSpots: {
              with: {
                queue: true,
              },
            },
          },
        }),
      "fetch customer by email"
    );

    if (!customerRecord) {
      return createActionError(
        "DOES_NOT_HAVE_TICKET",
        "No customer record found for this session"
      );
    }

    return createActionSuccess<CustomerInfo>({
      studentId: customerRecord.studentId,
      name: customerRecord.name,
      email: customerRecord.email,
      homeroom: customerRecord.homeroom,
      ticketType: customerRecord.ticketType,
      hasCheckedIn: customerRecord.hasCheckedIn,
      hauntedHouseName: customerRecord.queueSpots[0]?.queue?.hauntedHouseName,
      queueNumber: customerRecord.queueSpots[0]?.queue?.queueNumber,
      queueStartTime: customerRecord.queueSpots[0]?.queue?.queueStartTime,
      queueEndTime: customerRecord.queueSpots[0]?.queue?.queueEndTime,
    });
  } catch (error) {
    console.error("Error fetching customer info by session:", error);
    return createActionError(
      "DATABASE_ERROR",
      "Failed to retrieve customer information"
    );
  }
}

export async function checkInUserAction({
  customerId,
}: {
  customerId: string;
}): Promise<ActionResponse<{ hasCheckedIn: boolean }>> {
  const functionInvokerSession = await verifySession();
  if (!functionInvokerSession || functionInvokerSession.user.role !== "admin") {
    return createActionError(
      "SESSION_VERIFICATION_FAILED",
      "Session verification failed"
    );
  }

  try {
    // Validate input
    if (!customerId || customerId.trim() === "") {
      return createActionError("INVALID_INPUT", "Customer ID is required");
    }

    // Get customer from database
    const customerRecord = await retryDatabase(
      () =>
        db.query.customer.findFirst({
          where: eq(customer.studentId, customerId),
        }),
      "fetch customer by ID"
    );

    if (!customerRecord) {
      return createActionError("NOT_FOUND", "Customer not found");
    }

    // Check if already checked in
    if (customerRecord.hasCheckedIn) {
      return createActionError(
        "CUSTOMER_ALREADY_CHECKED_IN",
        "Customer has already checked in"
      );
    }

    // Update check-in status
    await retryDatabase(
      () =>
        db
          .update(customer)
          .set({
            hasCheckedIn: true,
          })
          .where(eq(customer.studentId, customerId)),
      "update customer check-in status"
    );

    // Publish real-time update to Ably with exponential backoff retry
    try {
      await retryExternalApi(async () => {
        const ablyClient = getServerAblyClient();
        const channel = ablyClient.channels.get(CHANNELS.CUSTOMER_UPDATES);
        await channel.publish(EVENT_NAMES.CHECKED_IN, {
          studentId: customerId,
          hasCheckedIn: true,
        });
      }, `publish check-in to Ably for ${customerId}`);
      console.log("Published check-in update to Ably for:", customerId);
    } catch (ablyError) {
      console.error("Error publishing to Ably after retries:", ablyError);
      // Don't fail the check-in if Ably publish fails
    }

    return createActionSuccess<{ hasCheckedIn: boolean }>({
      hasCheckedIn: true,
    });
  } catch (error) {
    console.error("Error checking in user:", error);
    return createActionError(
      "DATABASE_ERROR",
      "Failed to update check-in status"
    );
  }
}

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
    if (pin === ADMIN_PIN) {
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
