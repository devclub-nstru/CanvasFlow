export const AUDIT_LABEL: Record<string, string> = {
  "user.suspended": "Suspended the account",
  "user.unsuspended": "Lifted the suspension",
  "user.signed_out": "Signed out every session",
  "user.password_reset": "Sent a password reset",
  "admin.granted": "Granted admin",
  "admin.revoked": "Revoked admin",
  "signup.code_resent": "Resent a signup code",
  "signup.deleted": "Cleared a pending signup",
  "feedback.claimed": "Took a report",
  "feedback.released": "Handed a report back",
  "feedback.status_changed": "Changed a report's status",
};

export type AuditCategory = "user" | "admin" | "feedback" | "signup";

export const AUDIT_CATEGORIES: Array<{ id: AuditCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "user", label: "Accounts" },
  { id: "admin", label: "Roles" },
  { id: "feedback", label: "Reports" },
  { id: "signup", label: "Signups" },
];
