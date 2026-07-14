import { z } from "zod";
import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";

const TAGS = ["User"];
const getPath = generatePath("/user");

export const userRouter = router({
  /**
   * GET /user/me
   * Returns the current authenticated user's id, name, email and subscription plan.
   */
  getMe: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/me"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(z.undefined())
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        plan: z.enum(["Free", "Pro", "Pro+", "Business"]),
      }),
    )
    .query(async ({ ctx }) => {
      const { eq: dbEq, usersTable: users } = await import("@repo/database");
      const { db } = await import("@repo/database");

      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email, plan: users.plan })
        .from(users)
        .where(dbEq(users.id, ctx.user.id));

      const user = rows[0];
      if (!user) throw new Error("User not found");

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
      };
    }),

  searchUsers: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/search"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(
      z.object({
        query: z.string(),
      }),
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
        }),
      ),
    )
    .query(async ({ input, ctx }) => {
      const {
        ilike: dbILike,
        or: dbOr,
        and: dbAnd,
        ne: dbNe,
        usersTable: users,
      } = await import("@repo/database");
      const { db } = await import("@repo/database");

      const searchVal = input.query.trim();
      if (searchVal.length < 2) return [];

      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(
          dbAnd(
            dbNe(users.id, ctx.user.id),
            dbOr(dbILike(users.email, `%${searchVal}%`), dbILike(users.name, `%${searchVal}%`)),
          ),
        )
        .limit(10);

      return rows;
    }),
});
