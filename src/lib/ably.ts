import * as Ably from "ably";
import type { CustomerInfo } from "@/constants/types";

// Server-side Ably client (with full API key)
let serverAblyInstance: Ably.Realtime | null = null;

export function getServerAblyClient(): Ably.Realtime {
  if (!serverAblyInstance) {
    if (!process.env.ABLY_API_KEY) {
      throw new Error("ABLY_API_KEY environment variable is not set");
    }
    serverAblyInstance = new Ably.Realtime({
      key: process.env.ABLY_API_KEY,
      autoConnect: true,
      disconnectedRetryTimeout: 5000, // 5 seconds
      suspendedRetryTimeout: 5000, // 5 seconds
      // Enable connection recovery to restore connection state
      recover: function (_lastConnectionDetails, callback) {
        // Use Ably's default recovery mechanism
        callback(true);
      },
    });
  }
  return serverAblyInstance;
}

// Client-side Ably client (with public key or token)
let clientAblyInstance: Ably.Realtime | null = null;

export function getClientAblyClient(): Ably.Realtime {
  if (typeof window === "undefined") {
    throw new Error("Client Ably instance can only be used in the browser");
  }

  if (!clientAblyInstance) {
    if (!process.env.NEXT_PUBLIC_ABLY_KEY) {
      throw new Error("NEXT_PUBLIC_ABLY_KEY environment variable is not set");
    }
    clientAblyInstance = new Ably.Realtime({
      key: process.env.NEXT_PUBLIC_ABLY_KEY,
      autoConnect: true,
      disconnectedRetryTimeout: 5000, // 5 seconds
      suspendedRetryTimeout: 5000, // 5 seconds
      // Enable connection recovery to restore connection state
      recover: function (_lastConnectionDetails, callback) {
        // Use Ably's default recovery mechanism
        callback(true);
      },
    });
  }
  return clientAblyInstance;
}

// Channel names
export const CHANNELS = {
  CUSTOMER_UPDATES: "customer-updates",
  QR_SCAN_REQUESTS: "qr-scan-requests",
  QR_SCAN_RESPONSES: "qr-scan-responses",
  CHECKIN_REQUESTS: "checkin-requests",
  CHECKIN_RESPONSES: "checkin-responses",
} as const;

// Message types
export type CustomerUpdateMessage = {
  type: "checked_in" | "refresh_all";
  data?: {
    studentId?: string;
    hasCheckedIn?: boolean;
    [key: string]: unknown;
  };
};

// QR Scan request/response types
export type QRScanRequest = {
  type: "scan_request";
  requestId: string;
  sessionId: string;
  timestamp: number;
};

export type QRScanResponse = {
  type: "scan_response";
  requestId: string;
  success: boolean;
  data?: CustomerInfo;
  error?: string;
  code?: string;
  timestamp: number;
};

// Check-in request/response types
export type CheckInRequest = {
  type: "checkin_request";
  requestId: string;
  customerId: string;
  timestamp: number;
};

export type CheckInResponse = {
  type: "checkin_response";
  requestId: string;
  success: boolean;
  data?: CustomerInfo;
  error?: string;
  code?: string;
  timestamp: number;
};

// Ably event names
export const EVENT_NAMES = {
  CHECKED_IN: "checked_in",
  REFRESH_ALL: "refresh_all",
  SCAN_REQUEST: "scan_request",
  SCAN_RESPONSE: "scan_response",
  CHECKIN_REQUEST: "checkin_request",
  CHECKIN_RESPONSE: "checkin_response",
} as const;

// Generate unique request ID
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
