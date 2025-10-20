"use server";

import { db } from "@/drizzle/db";
import { session, customer, user } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import {
  createActionError,
  createActionSuccess,
  type ActionResponse,
} from "@/constants/errors";
import { retryDatabase } from "@/dal/retry";
import { verifySession } from "@/dal/verifySession";

interface CustomerInfo {
  studentId: string;
  name: string;
  email: string;
  homeroom: string;
  ticketType: string;
  hasCheckedIn: boolean;
  hauntedHouseName: string | null;
  queueNumber: number | null;
  queueStartTime: Date | null;
  queueEndTime: Date | null;
}

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

export async function checkInUser({
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
