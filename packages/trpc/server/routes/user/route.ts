import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authenticatedProcedure, router, superAdminProcedure } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { adminService } from "../../services";

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
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  createdAt: z.string(),
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
};

const toMe = (user: UserRow) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
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
          emailVerified: users.emailVerified,
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
        emailVerified: users.emailVerified,
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
  // GET /user/admins
  listAdmins: superAdminProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/admins"), tags: TAGS, protect: true },
    })
    .input(z.undefined())
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          role: z.enum(["admin", "superadmin"]),
          createdAt: z.string(),
        }),
      ),
    )
    .query(async () => {
      const { db, usersTable: users, inArray, asc } = await import("@repo/database");

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(inArray(users.role, ["admin", "superadmin"]))
        .orderBy(asc(users.createdAt));

      return rows.map((r) => ({
        ...r,
        role: r.role as "admin" | "superadmin",
        createdAt: r.createdAt.toISOString(),
      }));
    }),

  // POST /user/admins/add
  addAdmin: superAdminProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/admins/add"), tags: TAGS, protect: true },
    })
    .input(z.object({ email: z.string().email().describe("Email of an existing account") }))
    .output(z.object({ id: z.string(), email: z.string(), role: z.literal("admin") }))
    .mutation(async ({ ctx, input }) => {
      const { db, usersTable: users, eq } = await import("@repo/database");

      const email = input.email.trim().toLowerCase();

      const [user] = await db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No account with that email. They need to sign up first.",
        });
      }

      if (user.role === "superadmin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That account is a superadmin already.",
        });
      }

      if (user.role === "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That account is already an admin." });
      }

      await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));

      /* Granting admin is the single most consequential thing in the panel —
       * it hands someone every other power in it. It gets a line in the log. */
      await adminService.recordAudit({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email,
        action: "admin.granted",
        targetUserId: user.id,
        targetLabel: user.email,
      });

      return { id: user.id, email: user.email, role: "admin" as const };
    }),

  // POST /user/admins/remove
  removeAdmin: superAdminProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/admins/remove"), tags: TAGS, protect: true },
    })
    .input(z.object({ userId: z.string().describe("Account to demote to a plain user") }))
    .output(z.object({ id: z.string(), role: z.literal("user") }))
    .mutation(async ({ ctx, input }) => {
      const { db, usersTable: users, eq } = await import("@repo/database");

      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't demote yourself." });
      }

      const [user] = await db
        .select({ id: users.id, role: users.role, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "No such account." });

      const targetEmail = user.email;

      if (user.role === "superadmin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Superadmins can only be removed directly in the database.",
        });
      }

      if (user.role !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That account isn't an admin." });
      }

      await db.update(users).set({ role: "user" }).where(eq(users.id, user.id));

      await adminService.recordAudit({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email,
        action: "admin.revoked",
        targetUserId: user.id,
        targetLabel: targetEmail,
      });

      return { id: user.id, role: "user" as const };
    }),
  // GET /user/admins/candidates
  searchAdminCandidates: superAdminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/admins/candidates"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(z.object({ query: z.string() }))
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
        }),
      ),
    )
    .query(async ({ input }) => {
      const {
        db,
        usersTable: users,
        and: dbAnd,
        or: dbOr,
        eq: dbEq,
        ilike: dbILike,
      } = await import("@repo/database");

      const searchVal = input.query.trim();

      if (searchVal.length < 2) return [];
      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(
          dbAnd(
            dbEq(users.role, "user"),
            dbOr(dbILike(users.email, `%${searchVal}%`), dbILike(users.name, `%${searchVal}%`)),
          ),
        )
        .limit(8);

      return rows;
    }),
});
