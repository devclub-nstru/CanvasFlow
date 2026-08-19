import express, { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "@repo/database";
import { eq, and, usersTable, accountsTable, SelectUser } from "@repo/database";

// Cookie parser utility for server side
function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieString) return cookies;
  cookieString.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0]?.trim();
    if (name) {
      cookies[name] = decodeURIComponent(parts.slice(1).join("=").trim());
    }
  });
  return cookies;
}

// Password hashing utility using built-in PBKDF2
function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.pbkdf2(password, salt, 10000, 64, "sha512", (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const parts = hash.split(":");
    const salt = parts[0];
    const key = parts[1];
    if (!salt || !key) return resolve(false);
    crypto.pbkdf2(password, salt, 10000, 64, "sha512", (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString("hex") === key);
    });
  });
}

// OAuth helper for Google / GitHub
async function findOrCreateOAuthUser(info: {
  email: string;
  name: string;
  image: string | null;
  provider: string;
  providerAccountId: string;
}): Promise<SelectUser> {
  // 1. Check if account already exists
  const existingAccounts = await db
    .select()
    .from(accountsTable)
    .where(
      and(
        eq(accountsTable.providerId, info.provider),
        eq(accountsTable.accountId, info.providerAccountId)
      )
    );
  const existingAccount = existingAccounts[0];

  if (existingAccount) {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, existingAccount.userId));
    if (users[0]) return users[0];
  }

  // 2. Check if user with email exists
  const usersByEmail = await db.select().from(usersTable).where(eq(usersTable.email, info.email));
  let user = usersByEmail[0];

  if (!user) {
    // Create new user
    const userId = crypto.randomUUID();
    const insertedUsers = await db.insert(usersTable).values({
      id: userId,
      email: info.email,
      name: info.name || "",
      image: info.image || null,
      emailVerified: true,
    }).returning();
    user = insertedUsers[0];
  }

  if (!user) {
    throw new Error("Failed to find or create user");
  }

  // 3. Create link account record
  await db.insert(accountsTable).values({
    id: crypto.randomUUID(),
    userId: user.id,
    accountId: info.providerAccountId,
    providerId: info.provider,
  });

  return user;
}

export const authRouter = Router();

authRouter.use(express.json());

// Helper for cookie options
const getCookieOptions = () => {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
};

const getSessionCookieOptions = () => {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  return {
    secure: true,
    sameSite: "none" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
};

// Signup
const handleSignup = async (req: express.Request, res: express.Response) => {
  const { email, password, name, fullName } = req.body;
  const userName = name || fullName;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const existingUsers = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existingUsers.length > 0) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();

    await db.insert(usersTable).values({
      id: userId,
      email: email,
      name: userName || "",
      emailVerified: false,
    });

    await db.insert(accountsTable).values({
      id: crypto.randomUUID(),
      userId: userId,
      accountId: email,
      providerId: "credential",
      password: hashedPassword,
    });

    const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "default-secret-key-123456";
    const token = jwt.sign(
      { id: userId, email, name: userName || "" },
      secret,
      { expiresIn: "7d" }
    );

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    res.json({ status: "success", user: { id: userId, email, name: userName } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to sign up" });
  }
};

authRouter.post("/signup/email", handleSignup);
authRouter.post("/sign-up/email", handleSignup);

// Signin
const handleSignin = async (req: express.Request, res: express.Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
    const user = users[0];
    if (!user) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    const accounts = await db.select().from(accountsTable).where(
      and(
        eq(accountsTable.userId, user.id),
        eq(accountsTable.providerId, "credential")
      )
    );
    const account = accounts[0];
    if (!account || !account.password) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    const isValid = await verifyPassword(password, account.password);
    if (!isValid) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "default-secret-key-123456";
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      secret,
      { expiresIn: "7d" }
    );

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    res.json({ status: "success", user: { id: user.id, email: user.email, name: user.name } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to sign in" });
  }
};

authRouter.post("/signin/email", handleSignin);
authRouter.post("/sign-in/email", handleSignin);

// Signout
const handleSignout = (req: express.Request, res: express.Response) => {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  res.clearCookie("cf_jwt", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  res.clearCookie("cf_session", {
    secure: true,
    sameSite: "none",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  res.json({ status: "success" });
};

authRouter.post("/signout", handleSignout);
authRouter.post("/sign-out", handleSignout);

// Get Session
authRouter.get("/get-session", (req, res) => {
  const cookieHeader = req.headers.cookie || "";
  const authHeader = req.headers.authorization || "";
  const cookies = parseCookies(cookieHeader);
  let token = cookies["cf_jwt"];
  if (!token && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  if (!token) {
    res.json({ session: null, user: null });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "default-secret-key-123456";
    const decoded = jwt.verify(token, secret) as any;
    res.json({
      session: {
        id: decoded.id,
        userId: decoded.id,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
      },
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        image: decoded.image || null,
      },
    });
  } catch (err) {
    res.json({ session: null, user: null });
  }
});

// Providers endpoint (matches existing setup)
authRouter.get("/providers", (req, res) => {
  const providers = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push("google");
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) providers.push("github");
  res.json({ providers, baseURL: process.env.BETTER_AUTH_URL || "not set" });
});

// Social Login Initialization
const handleSocialLogin = (provider: "google" | "github") => {
  return (req: express.Request, res: express.Response) => {
    const redirect = req.query.redirect as string || "/dashboard";
    const baseUrl = process.env.BASE_URL || "https://api.canvasflow.devclubxnst.online";
    const callbackUrl = `${baseUrl}/api/auth/callback/${provider}`;

    if (provider === "google") {
      const googleUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: "openid email profile",
        state: redirect,
      }).toString();
      res.redirect(googleUrl);
    } else {
      const githubUrl = "https://github.com/login/oauth/authorize?" + new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID!,
        redirect_uri: callbackUrl,
        scope: "user:email",
        state: redirect,
      }).toString();
      res.redirect(githubUrl);
    }
  };
};

authRouter.get("/login/google", handleSocialLogin("google"));
authRouter.get("/login/github", handleSocialLogin("github"));

// Unified Better Auth compatibility endpoints
authRouter.get("/login/social", (req, res) => {
  const provider = req.query.provider as string;
  const callbackURL = req.query.callbackURL as string;
  if (provider === "google" || provider === "github") {
    const baseUrl = process.env.BASE_URL || "https://api.canvasflow.devclubxnst.online";
    const callbackUrl = `${baseUrl}/api/auth/callback/${provider}`;
    const redirectUrl = provider === "google"
      ? "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          redirect_uri: callbackUrl,
          response_type: "code",
          scope: "openid email profile",
          state: callbackURL,
        }).toString()
      : "https://github.com/login/oauth/authorize?" + new URLSearchParams({
          client_id: process.env.GITHUB_CLIENT_ID!,
          redirect_uri: callbackUrl,
          scope: "user:email",
          state: callbackURL,
        }).toString();
    res.redirect(redirectUrl);
  } else {
    res.status(400).send("Unsupported provider");
  }
});

// Google Callback
authRouter.get("/callback/google", async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string || "/dashboard";

  if (!code) {
    res.status(400).send("Authorization code missing");
    return;
  }

  try {
    const baseUrl = process.env.BASE_URL || "https://api.canvasflow.devclubxnst.online";
    const callbackUrl = `${baseUrl}/api/auth/callback/google`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      res.status(400).send("Failed to exchange authorization code for Google tokens");
      return;
    }

    const { access_token } = await tokenRes.json() as any;
    const userRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userRes.ok) {
      res.status(400).send("Failed to fetch Google user info");
      return;
    }

    const googleUser = await userRes.json() as any;

    const user = await findOrCreateOAuthUser({
      email: googleUser.email,
      name: googleUser.name,
      image: googleUser.picture,
      provider: "google",
      providerAccountId: googleUser.sub,
    });

    const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "default-secret-key-123456";
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      secret,
      { expiresIn: "7d" }
    );

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    res.redirect(state);
  } catch (err: any) {
    res.status(500).send(err.message || "Failed to process Google OAuth callback");
  }
});

// GitHub Callback
authRouter.get("/callback/github", async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string || "/dashboard";

  if (!code) {
    res.status(400).send("Authorization code missing");
    return;
  }

  try {
    const baseUrl = process.env.BASE_URL || "https://api.canvasflow.devclubxnst.online";
    const callbackUrl = `${baseUrl}/api/auth/callback/github`;
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) {
      res.status(400).send("Failed to exchange authorization code for GitHub token");
      return;
    }

    const { access_token } = await tokenRes.json() as any;
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "User-Agent": "CanvasFlow-API"
      },
    });

    if (!userRes.ok) {
      res.status(400).send("Failed to fetch GitHub profile");
      return;
    }

    const githubUser = await userRes.json() as any;
    let email = githubUser.email;

    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "User-Agent": "CanvasFlow-API"
        },
      });
      if (emailsRes.ok) {
        const emails = await emailsRes.json() as any[];
        const primaryEmail = emails.find((e: any) => e.primary && e.verified);
        email = primaryEmail ? primaryEmail.email : emails[0]?.email;
      }
    }

    if (!email) {
      res.status(400).send("GitHub email is missing or unverified");
      return;
    }

    const user = await findOrCreateOAuthUser({
      email,
      name: githubUser.name || githubUser.login,
      image: githubUser.avatar_url,
      provider: "github",
      providerAccountId: githubUser.id.toString(),
    });

    const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "default-secret-key-123456";
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      secret,
      { expiresIn: "7d" }
    );

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    res.redirect(state);
  } catch (err: any) {
    res.status(500).send(err.message || "Failed to process GitHub OAuth callback");
  }
});

// Mock Auth object matching better-auth signature for compatibility
export const auth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const cookieHeader = headers.get("cookie") || "";
      const authHeader = headers.get("authorization") || "";

      const cookies = parseCookies(cookieHeader);
      let token = cookies["cf_jwt"];
      if (!token && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }

      if (!token) return null;

      try {
        const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "default-secret-key-123456";
        const decoded = jwt.verify(token, secret) as any;
        if (!decoded || !decoded.id) return null;

        return {
          session: {
            id: decoded.id,
            userId: decoded.id,
            expiresAt: new Date(decoded.exp * 1000),
          },
          user: {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            image: decoded.image || null,
          },
        };
      } catch (err) {
        return null;
      }
    }
  }
};

export type Auth = typeof auth;
export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;
