import { NextResponse } from "next/server";
import { clearAdminStatusAction } from "@/server/actions";

export async function POST() {
  try {
    const result = await clearAdminStatusAction();

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: result.code },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in clear admin status API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
