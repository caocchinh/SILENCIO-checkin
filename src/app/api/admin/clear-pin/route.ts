import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  HTTP_STATUS,
  createApiError,
} from "@/constants/errors";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("admin_pin_verified");

    return NextResponse.json(
      { success: true, message: "PIN verification cleared" },
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error("Error clearing PIN:", error);
    return createApiError(
      "INTERNAL_SERVER_ERROR",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
