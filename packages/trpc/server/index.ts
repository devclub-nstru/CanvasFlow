import { router } from "./trpc";

import { healthRouter } from "./routes/health/route";
import { formRouter } from "./routes/form/route";
import { userRouter } from "./routes/user/route";
import { feedbackRouter } from "./routes/feedback/route";
import { adminRouter } from "./routes/admin/route";

export const serverRouter = router({
  health: healthRouter,
  form: formRouter,
  user: userRouter,
  feedback: feedbackRouter,
  admin: adminRouter,
});

export { createContext } from "./context";
export { auth } from "./auth";
export type ServerRouter = typeof serverRouter;
