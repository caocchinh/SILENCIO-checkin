import { db } from "@/drizzle/db";
import { verifySession } from "@/dal/verifySession";
import { retryDatabase } from "@/dal/retry";
import { createApiError, HTTP_STATUS } from "@/constants/errors";
import { CustomerInfo } from "@/constants/types";

interface AllCustomerInfoResponse {
  customers: CustomerInfo[];
  total: number;
}

/**
 * GET /api/allCustomerInfo
 * Retrieves all customer information with their queue details
 * Requires admin authentication
 */
export async function GET() {
  try {
    // Verify admin session
    const session = await verifySession();

    if (!session) {
      return createApiError(
        "NOT_LOGGED_IN",
        HTTP_STATUS.UNAUTHORIZED,
        "Authentication required"
      );
    }

    if (session.user.role !== "admin") {
      return createApiError(
        "UNAUTHORIZED",
        HTTP_STATUS.FORBIDDEN,
        "Admin access required"
      );
    }

    // Fetch all customers with their queue information
    const customers = await retryDatabase(
      () =>
        db.query.customer.findMany({
          with: {
            queueSpots: {
              with: {
                queue: true,
              },
            },
          },
          orderBy: (customer, { asc }) => [asc(customer.name)],
        }),
      "fetch all customers"
    );

    // Transform data to match CustomerInfo interface
    const customerInfoList: CustomerInfo[] = customers.map(
      (customerRecord) => ({
        studentId: customerRecord.studentId,
        name: customerRecord.name,
        email: customerRecord.email,
        homeroom: customerRecord.homeroom,
        ticketType: customerRecord.ticketType,
        hasCheckedIn: customerRecord.hasCheckedIn,
        hauntedHouseName:
          customerRecord.queueSpots[0]?.queue?.hauntedHouseName ?? null,
        queueNumber: customerRecord.queueSpots[0]?.queue?.queueNumber ?? null,
        queueStartTime:
          customerRecord.queueSpots[0]?.queue?.queueStartTime ?? null,
        queueEndTime: customerRecord.queueSpots[0]?.queue?.queueEndTime ?? null,
      })
    );

    const response: AllCustomerInfoResponse = {
      customers: customerInfoList,
      total: customerInfoList.length,
    };

    return new Response(JSON.stringify(response), {
      status: HTTP_STATUS.OK,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching all customer info:", error);
    return createApiError(
      "DATABASE_ERROR",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to retrieve customer information"
    );
  }
}
