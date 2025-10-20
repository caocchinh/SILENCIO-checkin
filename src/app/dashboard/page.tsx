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
import { retryAuth, retryDatabase } from "@/dal/retry";
import Navbar from "@/components/Navbar";
import { queueSpot } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import Image from "next/image";
import QR from "@/components/QR";
import { cn } from "@/lib/utils";

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

  const customerQueueSpot = await retryDatabase(
    () =>
      db.query.queueSpot.findFirst({
        where: eq(queueSpot.customerId, session.customer.studentId),
        with: {
          queue: true,
        },
      }),
    "fetch customer queue spot"
  );
  const ticketIncludeHauntedHouse = !!customerQueueSpot?.spotNumber;

  return (
    <div className="relative flex items-center min-h-[calc(100vh-40px)] justify-start w-full bg-[url('/assets/bg.png')] overflow-hidden bg-cover p-4 flex-col">
      <Navbar session={session.session} customer={session.customer} />
      <div className="max-w-[90%] font-italianno relative mt-4">
        <div className=" absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-[40%] flex items-center justify-center flex-col min-w-[250px] w-[70%]">
          {ticketIncludeHauntedHouse && (
            <div className="flex flex-col gap-2 mb-2 text-2xl -mt-10 text-center">
              <p className="text-[#FFD700]">
                Nhà ma: {customerQueueSpot?.queue?.hauntedHouseName}
              </p>
              <p className="text-[#FFD700]">
                Lượt: {customerQueueSpot?.queue?.queueNumber} (Từ{" "}
                {customerQueueSpot?.queue?.queueStartTime.toLocaleTimeString(
                  [],
                  {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  }
                )}{" "}
                đến{" "}
                {customerQueueSpot?.queue?.queueEndTime.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
                )
              </p>
            </div>
          )}
          <h1
            className={cn(
              "text-[#FFD700] login_title text-[33px] font-semibold text-center  ",
              !ticketIncludeHauntedHouse && "mb-2 -mt-10"
            )}
          >
            Đưa mã QR này cho staff
          </h1>
          <QR url={session.session.session.id} />
        </div>
        <Image
          src="/assets/frame.png"
          alt="Frame"
          width={540}
          height={675}
          className="max-h-[90vh] h-auto w-auto rounded-md"
        />
      </div>
    </div>
  );
}
