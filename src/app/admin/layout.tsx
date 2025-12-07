import { ErrorCard } from "@/components/ErrorCard";
import { verifySession } from "@/dal/verifySession";
import { ERROR_CODES, getErrorMessage } from "@/constants/errors";
import RedirectMessage from "@/components/RedirectMessage";
import { Suspense } from "react";
import Loader from "@/components/Loader/Loader";
import { ADMIN_NAVIGATION_ITEMS } from "@/constants/constants";
import AdminNavigation from "@/components/AdminNavigation";
import { LogoutButton } from "@/components/LogoutButton";
import { PinVerificationProvider } from "@/context/PinVerificationContext";
import { PinVerification } from "@/components/PinVerification";
import { LockButton } from "@/components/LockButton";
import { ActivityTimer } from "@/components/ActivityTimer";

const AdminContent = async ({ children }: { children: React.ReactNode }) => {
  let session;

  try {
    session = await verifySession();
  } catch (sessionError) {
    console.error("Failed to verify session:", sessionError);
    return (
      <ErrorCard
        message={getErrorMessage(ERROR_CODES.SESSION_VERIFICATION_FAILED)}
      />
    );
  }

  if (!session) {
    return (
      <RedirectMessage
        message="Bạn chưa đăng nhập!"
        subMessage="Đang chuyển hướng đến trang đăng nhập..."
        redirectTo={`/?error=${ERROR_CODES.NOT_LOGGED_IN}`}
      />
    );
  }

  if (session.user.role !== "admin") {
    return (
      <RedirectMessage
        message="Bạn không có quyền truy cập trang này!"
        subMessage="Đang chuyển hướng đến trang đăng nhập..."
        redirectTo={`/?error=${ERROR_CODES.UNAUTHORIZED}`}
      />
    );
  }

  return (
    <PinVerificationProvider>
      <ActivityTimer />
      <PinVerification>
        <div className="flex w-full flex-col items-start justify-center p-4 sm:pt-0 pt-4">
          <div className="flex w-full flex-col items-start justify-start gap-2 border-gray-600 border-b pb-4 md:flex-row md:items-center md:gap-8">
            <div className="flex items-center justify-center gap-4 flex-col sm:flex-row w-full sm:w-max">
              <div className="flex w-full sm:w-max flex-col items-start justify-center gap-0">
                {" "}
                <h1 className="w-full font-semibold text-3xl text-[#0084ff]">
                  Check-in System
                </h1>
                <h3 className="text-gray-500 text-sm">{session.user.email}</h3>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-max">
                <LockButton />
                <LogoutButton className="flex-1 sm:w-max" />
              </div>
            </div>

            <div className="hidden h-[35px] w-[1px] border-gray-500 border-l md:block" />
            {session && <AdminNavigation items={ADMIN_NAVIGATION_ITEMS} />}
          </div>
          {children}
        </div>
      </PinVerification>
    </PinVerificationProvider>
  );
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<Loader className="min-h-[calc(100vh-40px)]" />}>
      <AdminContent>{children}</AdminContent>
    </Suspense>
  );
}
