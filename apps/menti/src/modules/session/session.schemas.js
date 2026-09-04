import { z } from "zod";

export const createSessionSchema = z.object({
  body: z.object({
    presentationId: z.string().length(24, "Invalid Presentation ID"),
  }),
});

export const joinSessionSchema = z.object({
  params: z.object({
    code: z.string().min(4).max(12).regex(/^\d+$/, "Room code must contain only numbers"),
  }),
  body: z.object({
    nickname: z.string().min(1).max(100),
  }),
});
