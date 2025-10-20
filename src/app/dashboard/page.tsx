import { ErrorCard } from "@/components/ErrorCard";
import { verifyCustomerSession } from "@/dal/verifySession";
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  getErrorMessage,
} from "@/constants/errors";
import RedirectMessage from "@/components/RedirectMessage";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { retryAuth } from "@/dal/retry";
import Navbar from "@/components/Navbar";

export default async function DashboardPage() {
  let session;

  try {
    session = await verifyCustomerSession();
  } catch (sessionError) {
    console.error("Failed to verify session:", sessionError);
    return (
      <ErrorCard
        message={getErrorMessage(ERROR_CODES.SESSION_VERIFICATION_FAILED)}
      />
    );
  }

  if (!session.session) {
    return (
      <RedirectMessage
        message="Bạn chưa đăng nhập!"
        subMessage="Đang chuyển hướng đến trang đăng nhập..."
        redirectTo={`/?error=${ERROR_CODES.NOT_LOGGED_IN}`}
      />
    );
  }

  //Check if user is admin - redirect to admin dashboard
  if (session.session.user.role === "admin") {
    return (
      <RedirectMessage
        message="Redirecting to Admin Dashboard..."
        subMessage="Please wait..."
        redirectTo="/admin"
      />
    );
  }

  // Check if user should be signed out (not customer)
  if (!session.customer) {
    try {
      await retryAuth(async () => {
        const response = await auth.api.signOut({
          headers: await headers(),
        });
        if (!response.success) {
          throw new Error("Failed to sign out user");
        }
      }, "Sign out");
    } catch (signOutError) {
      console.error("Failed to sign out user:", signOutError);
    }
    // Continue with redirect even if sign out fails

    return (
      <RedirectMessage
        message={ERROR_MESSAGES[ERROR_CODES.DOES_NOT_HAVE_TICKET]}
        subMessage="Đang chuyển hướng đến trang đăng nhập..."
        redirectTo={`/?error=${ERROR_CODES.DOES_NOT_HAVE_TICKET}`}
      />
    );
  }

  await retryAuth(async () => {
    await auth.api.revokeOtherSessions({
      headers: await headers(),
    });
  }, "Revoke other customer sessions");

  return (
    <div className="relative flex items-center min-h-[calc(100vh-40px)] justify-start w-full bg-[url('/assets/bg.png')] overflow-hidden bg-contain p-4 flex-col">
      <Navbar session={session.session} customer={session.customer} />
    </div>
  );
}
