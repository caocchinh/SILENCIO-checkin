import { customer } from "@/drizzle/schema";

export type Customer = typeof customer.$inferSelect;
export interface CustomerInfo {
  studentId: string;
  name: string;
  email: string;
  homeroom: string;
  ticketType: string;
  hasCheckedIn: boolean;
  hauntedHouseName: string | null;
  queueNumber: number | null;
  queueStartTime: Date | null;
  queueEndTime: Date | null;
}

export interface AllCustomerInfoResponse {
  customers: CustomerInfo[];
  total: number;
}

export type EmailHauntedHouseTicketInfo = Record<string, { ticketImageUrl: string }>;
