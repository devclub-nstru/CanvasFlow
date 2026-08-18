import { performance } from "perf_hooks";
import type { Socket } from "socket.io";

export const createAckWrapper = (socket: Socket) => {
  return (handler: (...args: any[]) => Promise<any>) =>
    async (...args: any[]) => {
      const tStart = performance.now();
      const ack = typeof args[args.length - 1] === "function" ? args.pop() : null;

      const identityId =
        (socket.data?.userId as string | undefined) ||
        (socket.data?.participantId as string | undefined) ||
        socket.id;

      try {
        const result = await handler(...args);
        if (ack) {
          ack({ success: true, data: result });
        }
        const totalMs = performance.now() - tStart;
        if (totalMs > 100) {
          console.log(`[Slow WS Event] total: ${totalMs.toFixed(1)}ms`);
        }
      } catch (error: any) {
        console.error("[Socket Error]", error.message || error);
        if (ack) {
          ack({ success: false, error: error.message || "Internal Server Error" });
        }
      }
    };
};
