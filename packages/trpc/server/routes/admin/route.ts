import { TRPCError } from "@trpc/server";

import { adminProcedure, router } from "../../trpc";
import { adminService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import {
  getPlatformStatsInput,
  getPlatformStatsOutput,
} from "@repo/services/admin/model";

const TAGS = ["Admin"];
const getPath = generatePath("/admin");

export const adminRouter = router({
  // GET /admin/stats
  platformStats: adminProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/stats"), tags: TAGS, protect: true },
    })
    .input(getPlatformStatsInput)
    .output(getPlatformStatsOutput)
    .query(async ({ input }) => {
      try {
        return await adminService.getPlatformStats(input);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to load platform stats",
        });
      }
    }),
});
