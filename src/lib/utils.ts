import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
import { QueryClient } from '@tanstack/react-query';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getColumnNumber = (columnLetter: string): number => {
  return columnLetter.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
};

/**
 * Safely trims a string, handling null/undefined values
 * @param str - The input string to trim
 * @returns The trimmed string, or empty string if input is null/undefined
 * @example
 * safeTrim("  hello  ") // returns "hello"
 * safeTrim(null) // returns ""
 * safeTrim(undefined) // returns ""
 * safeTrim("") // returns ""
 */
export const safeTrim = (str: string | null | undefined): string => {
  if (str == null || str == undefined) return "";
  if (typeof str !== "string") return "";
  return str.trim();
};

export const successToast = ({
  message,
  description,
}: {
  message: string;
  description?: string;
}) => {
  const toastId = toast.success(message, {
    description: description,
    duration: 3000,
    style: {
      backgroundColor: "#00a63e",
      color: "white",
      textAlign: "center",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    descriptionClassName: "!text-white font-medium",
    className: "flex items-center justify-center flex-col gap-5 w-[300px]",
    actionButtonStyle: {
      backgroundColor: "white",
      color: "black",
      border: "none",
      padding: "8px 16px",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "500",
      pointerEvents: "auto",
      zIndex: 9999,
    },
    action: {
      label: "Đóng",
      onClick: () => toast.dismiss(toastId),
    },
  });
  return toastId;
};

export const errorToast = ({
  message,
  description,
}: {
  message: string;
  description?: string;
}) => {
  const toastId = toast.error(message, {
    description: description,
    duration: 3000,
    style: {
      backgroundColor: "#e7000b",
      color: "white",
      textAlign: "center",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    descriptionClassName: "!text-white font-medium",
    className: "flex items-center justify-center flex-col gap-5 w-[300px]",
    actionButtonStyle: {
      backgroundColor: "white",
      color: "black",
      border: "none",
      padding: "8px 16px",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "500",
      pointerEvents: "auto",
      zIndex: 9999,
    },
    action: {
      label: "Đóng",
      onClick: () => toast.dismiss(toastId),
    },
  });
  return toastId;
};

/**
 * Updates a single customer's check-in status in the React Query cache
 * @param queryClient - The React Query client instance
 * @param queryKey - The query key for the customer info (e.g., ["customerInfo", sessionId])
 * @param updater - Optional function to modify the query data before updating check-in status
 */
export const updateCustomerCheckInStatus = <T extends { hasCheckedIn: boolean }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  updater?: (oldData: T | undefined) => T | undefined
) => {
  queryClient.setQueryData<T>(queryKey, (oldData) => {
    if (!oldData) return oldData;

    const updatedData = updater ? updater(oldData) : oldData;
    if (!updatedData) return oldData;

    return {
      ...updatedData,
      hasCheckedIn: true,
    };
  });
};

/**
 * Updates a customer's check-in status in the all customers list cache
 * @param queryClient - The React Query client instance
 * @param studentId - The student ID of the customer to update
 * @param updater - Optional function to modify the query data before updating check-in status
 */
export const updateAllCustomersCheckInStatus = <T extends { customers: Array<{ studentId: string; hasCheckedIn: boolean }> }>(
  queryClient: QueryClient,
  studentId: string,
  updater?: (oldData: T | undefined) => T | undefined
) => {
  queryClient.setQueryData<T>(["allCustomerInfo"], (oldData) => {
    if (!oldData) return oldData;

    const updatedData = updater ? updater(oldData) : oldData;
    if (!updatedData) return oldData;

    return {
      ...updatedData,
      customers: updatedData.customers.map((customer) => {
        if (customer.studentId === studentId) {
          return {
            ...customer,
            hasCheckedIn: true,
          };
        }
        return customer;
      }),
    };
  });
};
