import { NextResponse } from "next/server";
import { verifySession } from "@/dal/verifySession";
import { cookies } from "next/headers";
import { PIN_VERIFICATION_INTERVAL } from "@/constants/constants";
import { HTTP_STATUS, createApiError } from "@/constants/errors";

export async function GET() {
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

    // Check if PIN verification cookie exists
    const cookieStore = await cookies();
    const pinVerifiedCookie = cookieStore.get("admin_pin_verified");

    if (!pinVerifiedCookie) {
      return NextResponse.json({ verified: false }, { status: HTTP_STATUS.OK });
    }

    // Check if the verification is still valid (within the interval)
    const verifiedTimestamp = parseInt(pinVerifiedCookie.value);
    const currentTime = Date.now();
    const timeDifference = currentTime - verifiedTimestamp;

    if (timeDifference > PIN_VERIFICATION_INTERVAL) {
      // Verification expired, remove the cookie
      cookieStore.delete("admin_pin_verified");
      return NextResponse.json(
        { verified: false, expired: true },
        { status: HTTP_STATUS.OK }
      );
    }

    return NextResponse.json({ verified: true }, { status: HTTP_STATUS.OK });
  } catch (error) {
    console.error("Error checking PIN:", error);
    return createApiError(
      "INTERNAL_SERVER_ERROR",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
