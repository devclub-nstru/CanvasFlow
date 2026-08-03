import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";

const TAGS = ["User"];
const getPath = generatePath("/user");

// Allowed values for the avatar preset
const AVATAR_PRESETS = [
  "glyph-01",
  "glyph-02",
  "glyph-03",
  "glyph-04",
  "glyph-05",
  "glyph-06",
  "glyph-07",
  "glyph-08",
] as const;

const meOutput = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  createdAt: z.string(),
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: Date;
};

const toMe = (user: UserRow) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  createdAt: user.createdAt.toISOString(),
});

export const userRouter = router({
  // GET /user/me
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
    .output(meOutput)
    .query(async ({ ctx }) => {
      const { eq: dbEq, usersTable: users } = await import("@repo/database");
      const { db } = await import("@repo/database");

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(dbEq(users.id, ctx.user.id));

      const user = rows[0];
      if (!user) throw new Error("User not found");

      return toMe(user);
    }),

  // PATCH /user/me
  updateMe: authenticatedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: getPath("/me"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(
      z.object({
        name: z.string().trim().min(1, "Name cannot be empty").max(80).optional(),
        image: z.enum(AVATAR_PRESETS).nullable().optional(),
      }),
    )
    .output(meOutput)
    .mutation(async ({ ctx, input }) => {
      const { eq: dbEq, usersTable: users } = await import("@repo/database");
      const { db } = await import("@repo/database");

      const patch: { name?: string; image?: string | null } = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.image !== undefined) patch.image = input.image;

      if (Object.keys(patch).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing to update" });
      }

      const rows = await db.update(users).set(patch).where(dbEq(users.id, ctx.user.id)).returning({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        createdAt: users.createdAt,
      });

      const user = rows[0];
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      return toMe(user);
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
