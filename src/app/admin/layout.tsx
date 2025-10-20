import { ErrorCard } from "@/components/ErrorCard";
import { verifySession } from "@/dal/verifySession";
import { ERROR_CODES, getErrorMessage } from "@/constants/errors";
import RedirectMessage from "@/components/RedirectMessage";
import { Suspense } from "react";
import Loader from "@/components/Loader/Loader";
import { ADMIN_NAVIGATION_ITEMS } from "@/constants/constants";
import AdminNavigation from "@/components/AdminNavigation";
import { LogoutButton } from "@/components/LogoutButton";

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
    <div className="flex w-full flex-col items-start justify-center p-4">
      <div className="flex w-full flex-col items-start justify-start gap-2 border-gray-600 border-b pb-4 md:flex-row md:items-center md:gap-8">
        <div className="flex items-center justify-center gap-4 flex-col sm:flex-row w-full sm:w-max">
          <div className="flex w-max flex-col items-start justify-center gap-2">
            {" "}
            <h1 className="w-full font-semibold text-3xl text-[#0084ff]">
              Hệ thống check in
            </h1>
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-gray-500 text-sm">{session.user.email}</h3>
              <span className="text-gray-500 text-sm">•</span>
              <h3 className="text-gray-500 text-sm">
                {session.user.role.charAt(0).toUpperCase() +
                  session.user.role.slice(1)}
              </h3>
            </div>
          </div>
          <LogoutButton />
        </div>

        <div className="hidden h-[35px] w-[1px] border-gray-500 border-l md:block" />
        {session && <AdminNavigation items={ADMIN_NAVIGATION_ITEMS} />}
      </div>
      {children}
    </div>
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
