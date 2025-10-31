import { useState, useCallback, useEffect, useRef } from "react";
import * as Ably from "ably";
import {
  getClientAblyClient,
  generateRequestId,
  CHANNELS,
  EVENT_NAMES,
  type QRScanRequest,
  type QRScanResponse,
  type CheckInRequest,
  type CheckInResponse,
  type CustomerUpdateMessage,
} from "@/lib/ably";

const REQUEST_TIMEOUT = 10000; // 10 seconds

interface PendingRequest<T> {
  requestId: string;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  timestamp: number;
}

interface UseAblyOptions {
  /** Callback for customer update messages */
  onCustomerUpdate?: (message: CustomerUpdateMessage) => void;
}

/**
 * Unified hook for all Ably real-time communication
 * Manages connection state once and provides both request-response and pub-sub patterns
 */
export function useAbly(options: UseAblyOptions = {}) {
  const { onCustomerUpdate } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] =
    useState<Ably.ConnectionState>("initialized");

  const ablyClientRef = useRef<Ably.Realtime | null>(null);
  const onCustomerUpdateRef = useRef(onCustomerUpdate);
  
  // Update ref when callback changes without triggering re-initialization
  useEffect(() => {
    onCustomerUpdateRef.current = onCustomerUpdate;
  }, [onCustomerUpdate]);

  const channelsRef = useRef<{
    scanRequest: Ably.RealtimeChannel | null;
    scanResponse: Ably.RealtimeChannel | null;
    checkinRequest: Ably.RealtimeChannel | null;
    checkinResponse: Ably.RealtimeChannel | null;
    customerUpdates: Ably.RealtimeChannel | null;
  }>({
    scanRequest: null,
    scanResponse: null,
    checkinRequest: null,
    checkinResponse: null,
    customerUpdates: null,
  });

  const pendingScanRequestsRef = useRef<
    Map<string, PendingRequest<QRScanResponse>>
  >(new Map());
  const pendingCheckinRequestsRef = useRef<
    Map<string, PendingRequest<CheckInResponse>>
  >(new Map());

  // Initialize Ably connection
  useEffect(() => {
    if (typeof window === "undefined") return;

    let mounted = true;

    try {
      const client = getClientAblyClient();
      ablyClientRef.current = client;

      // Get all channels
      console.log("🔧 Initializing Ably channels:", {
        QR_SCAN_REQUESTS: CHANNELS.QR_SCAN_REQUESTS,
        QR_SCAN_RESPONSES: CHANNELS.QR_SCAN_RESPONSES,
        CHECKIN_REQUESTS: CHANNELS.CHECKIN_REQUESTS,
        CHECKIN_RESPONSES: CHANNELS.CHECKIN_RESPONSES,
        CUSTOMER_UPDATES: CHANNELS.CUSTOMER_UPDATES,
      });

      channelsRef.current = {
        scanRequest: client.channels.get(CHANNELS.QR_SCAN_REQUESTS),
        scanResponse: client.channels.get(CHANNELS.QR_SCAN_RESPONSES),
        checkinRequest: client.channels.get(CHANNELS.CHECKIN_REQUESTS),
        checkinResponse: client.channels.get(CHANNELS.CHECKIN_RESPONSES),
        customerUpdates: client.channels.get(CHANNELS.CUSTOMER_UPDATES),
      };

      console.log("✅ Ably channels initialized");

      // Monitor connection state
      const handleConnectionStateChange = (
        stateChange: Ably.ConnectionStateChange
      ) => {
        if (!mounted) return;
        setConnectionState(stateChange.current);
        setIsConnected(stateChange.current === "connected");

        // Clear pending requests on disconnect
        if (
          stateChange.current === "disconnected" ||
          stateChange.current === "failed"
        ) {
          clearAllPendingRequests();
        }
      };

      client.connection.on(handleConnectionStateChange);

      // Subscribe to scan responses
      const handleScanResponse = (message: Ably.Message) => {
        console.log("📥 Received scan response:", message.data);
        const response = message.data as QRScanResponse;
        const pending = pendingScanRequestsRef.current.get(response.requestId);

        if (pending) {
          console.log("✅ Matching pending request found, resolving:", response.requestId);
          clearTimeout(pending.timeout);
          pendingScanRequestsRef.current.delete(response.requestId);
          pending.resolve(response);
        } else {
          console.warn("⚠️ No pending request found for response:", response.requestId);
        }
      };

      console.log("🎧 Subscribing to scan responses on channel:", CHANNELS.QR_SCAN_RESPONSES, "event:", EVENT_NAMES.SCAN_RESPONSE);
      console.log("📡 Scan response channel state:", channelsRef.current.scanResponse?.state);

      channelsRef.current.scanResponse?.subscribe(
        EVENT_NAMES.SCAN_RESPONSE,
        handleScanResponse
      );

      console.log("✅ Subscribed to scan response channel");

      // Subscribe to check-in responses
      const handleCheckinResponse = (message: Ably.Message) => {
        const response = message.data as CheckInResponse;
        const pending = pendingCheckinRequestsRef.current.get(
          response.requestId
        );

         // Forward a simplified customer update event to the consumer (UI)
        // so that screens listening for updates can react immediately.
        if (onCustomerUpdateRef.current && response?.customerId) {
          onCustomerUpdateRef.current({
            type: EVENT_NAMES.CHECKED_IN,
            data: {
              studentId: response.customerId,
              hasCheckedIn: response?.success,
            },
          });
        }

        if (pending) {
          clearTimeout(pending.timeout);
          pendingCheckinRequestsRef.current.delete(response.requestId);
          pending.resolve(response);
        }

       
      };

      channelsRef.current.checkinResponse?.subscribe(
        EVENT_NAMES.CHECKIN_RESPONSE,
        handleCheckinResponse
      );


      // Set initial connection state
      setConnectionState(client.connection.state);
      setIsConnected(client.connection.state === "connected");

      return () => {
        mounted = false;
        channelsRef.current.scanResponse?.unsubscribe(
          EVENT_NAMES.SCAN_RESPONSE,
          handleScanResponse
        );
        channelsRef.current.checkinResponse?.unsubscribe(
          EVENT_NAMES.CHECKIN_RESPONSE,
          handleCheckinResponse
        );
        client.connection.off(handleConnectionStateChange);
        clearAllPendingRequests();
      };
    } catch (error) {
      console.error("Error setting up Ably client:", error);
      return () => {
        mounted = false;
      };
    }
  }, []); // Empty dependency array - only initialize once

  // Clear all pending requests
  const clearAllPendingRequests = () => {
    pendingScanRequestsRef.current.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection lost"));
    });
    pendingScanRequestsRef.current.clear();

    pendingCheckinRequestsRef.current.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection lost"));
    });
    pendingCheckinRequestsRef.current.clear();
  };

  /**
   * Send QR scan request via Ably
   */
  const scanQRCode = useCallback(
    async (sessionId: string): Promise<QRScanResponse> => {
      console.log("📤 scanQRCode called:", { sessionId, isConnected, connectionState });
      
      if (!isConnected) {
        throw new Error("Not connected to real-time service");
      }

      const scanChannel = channelsRef.current.scanRequest;
      if (!scanChannel) {
        throw new Error("Scan request channel not initialized");
      }

      return new Promise<QRScanResponse>((resolve, reject) => {
        const requestId = generateRequestId();
        const timestamp = Date.now();

        console.log("⏱️ Setting up scan request timeout:", { requestId, timeout: REQUEST_TIMEOUT });

        const timeout = setTimeout(() => {
          console.error("⏰ Request timeout:", requestId);
          pendingScanRequestsRef.current.delete(requestId);
          reject(new Error("Request timeout"));
        }, REQUEST_TIMEOUT);

        pendingScanRequestsRef.current.set(requestId, {
          requestId,
          resolve,
          reject,
          timeout,
          timestamp,
        });

        const request: QRScanRequest = {
          type: "scan_request",
          requestId,
          sessionId,
          timestamp,
        };

        console.log("📡 Publishing scan request:", request);

        scanChannel
          .publish(EVENT_NAMES.SCAN_REQUEST, request)
          .then(() => {
            console.log("✅ Scan request published successfully:", requestId);
          })
          .catch((error) => {
            console.error("❌ Failed to publish scan request:", error);
            clearTimeout(timeout);
            pendingScanRequestsRef.current.delete(requestId);
            reject(error);
          });
      });
    },
    [isConnected, connectionState]
  );

  /**
   * Send check-in request via Ably
   */
  const checkInCustomer = useCallback(
    async (customerId: string): Promise<CheckInResponse> => {
      if (!isConnected) {
        throw new Error("Not connected to real-time service");
      }

      const checkinChannel = channelsRef.current.checkinRequest;
      if (!checkinChannel) {
        throw new Error("Check-in request channel not initialized");
      }

      return new Promise<CheckInResponse>((resolve, reject) => {
        const requestId = generateRequestId();
        const timestamp = Date.now();

        const timeout = setTimeout(() => {
          pendingCheckinRequestsRef.current.delete(requestId);
          reject(new Error("Request timeout"));
        }, REQUEST_TIMEOUT);

        pendingCheckinRequestsRef.current.set(requestId, {
          requestId,
          resolve,
          reject,
          timeout,
          timestamp,
        });

        const request: CheckInRequest = {
          type: "checkin_request",
          requestId,
          customerId,
          timestamp,
        };

        checkinChannel
          .publish(EVENT_NAMES.CHECKIN_REQUEST, request)
          .catch((error) => {
            clearTimeout(timeout);
            pendingCheckinRequestsRef.current.delete(requestId);
            reject(error);
          });
      });
    },
    [isConnected]
  );

  /**
   * Manually retry connection
   */
  const retryConnection = useCallback(() => {
    if (ablyClientRef.current) {
      ablyClientRef.current.connection.connect();
    }
  }, []);

  return {
    isConnected,
    connectionState,
    scanQRCode,
    checkInCustomer,
    retryConnection,
    pendingRequestsCount:
      pendingScanRequestsRef.current.size +
      pendingCheckinRequestsRef.current.size,
  };
}
