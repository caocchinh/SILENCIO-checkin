import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/dal/verifySession";
import { ADMIN_PIN } from "@/constants/constants";
import { cookies } from "next/headers";
import { HTTP_STATUS, createApiError } from "@/constants/errors";

export async function POST(request: NextRequest) {
  try {
    // Verify the user session first
    const session = await verifySession();

    if (!session) {
      return createApiError("NOT_LOGGED_IN", HTTP_STATUS.UNAUTHORIZED);
    }

    // Check if user is admin
    if (session.user.role !== "admin") {
      return createApiError("UNAUTHORIZED", HTTP_STATUS.FORBIDDEN);
    }

    // Get the PIN from request body
    const body = await request.json();
    const { pin } = body;

    if (!pin) {
      return createApiError("PIN_REQUIRED", HTTP_STATUS.BAD_REQUEST);
    }

    // Verify the PIN
    if (pin === ADMIN_PIN) {
      // Set a secure cookie with the PIN verification timestamp
      const cookieStore = await cookies();
      cookieStore.set("admin_pin_verified", Date.now().toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      return NextResponse.json(
        { success: true, message: "PIN verified successfully" },
        { status: HTTP_STATUS.OK }
      );
    } else {
      return createApiError("PIN_INVALID", HTTP_STATUS.UNAUTHORIZED);
    }
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return createApiError(
      "INTERNAL_SERVER_ERROR",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
