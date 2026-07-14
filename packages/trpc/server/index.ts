import { router } from "./trpc";

import { healthRouter } from "./routes/health/route";
import { formRouter } from "./routes/form/route";
import { analyticsRouter } from "./routes/analytics/route";
import { userRouter } from "./routes/user/route";

export const serverRouter = router({
  health: healthRouter,
  form: formRouter,
  analytics: analyticsRouter,
  user: userRouter,
});

export { createContext } from "./context";
export { auth } from "./auth";
export type ServerRouter = typeof serverRouter;
