import { useEffect, useState, useCallback } from "react";
import type * as Ably from "ably";
import { getClientAblyClient, type CustomerUpdateMessage } from "@/lib/ably";

type UseAblyChannelOptions = {
  channelName: string;
  onMessage?: (message: CustomerUpdateMessage) => void;
};

export function useAblyChannel({ channelName, onMessage }: UseAblyChannelOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<Ably.ConnectionState>("initialized");
  const [channel, setChannel] = useState<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    let ablyClient: Ably.Realtime | null = null;
    let ablyChannel: Ably.RealtimeChannel | null = null;

    try {
      ablyClient = getClientAblyClient();
      ablyChannel = ablyClient.channels.get(channelName);
      setChannel(ablyChannel);

      // Monitor connection state
      const handleConnectionStateChange = (stateChange: Ably.ConnectionStateChange) => {
        setConnectionState(stateChange.current);
        setIsConnected(stateChange.current === "connected");
        console.log("Ably connection state changed:", stateChange.current);
      };

      ablyClient.connection.on(handleConnectionStateChange);

      // Subscribe to messages
      const handleMessage = (message: Ably.Message) => {
        try {
          // Event name is in message.name, data is in message.data
          const parsedMessage: CustomerUpdateMessage = {
            type: message.name as CustomerUpdateMessage["type"],
            data: message.data,
          };
          onMessage?.(parsedMessage);
        } catch (error) {
          console.error("Error parsing Ably message:", error);
        }
      };

      ablyChannel.subscribe(handleMessage);

      // Set initial connection state
      setConnectionState(ablyClient.connection.state);
      setIsConnected(ablyClient.connection.state === "connected");

      return () => {
        ablyChannel?.unsubscribe(handleMessage);
        ablyClient?.connection.off(handleConnectionStateChange);
      };
    } catch (error) {
      console.error("Error setting up Ably channel:", error);
      return () => {
        // Cleanup if initialization failed
      };
    }
  }, [channelName, onMessage]);

  const publish = useCallback(
    (message: CustomerUpdateMessage) => {
      if (channel) {
        channel.publish("update", message);
      } else {
        console.warn("Cannot publish: Ably channel not initialized");
      }
    },
    [channel]
  );

  return {
    isConnected,
    connectionState,
    publish,
  };
}
