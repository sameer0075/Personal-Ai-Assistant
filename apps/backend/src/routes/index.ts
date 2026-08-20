import { Router } from "express";
import { documentRoutes } from "./document.routes.js";
import { chatRoutes } from "./chat.routes.js";
import { googleAuthRoutes } from "./google-auth.routes.js";
import { gmailRoutes } from "./gmail.routes.js";
import { calendarRoutes } from "./calendar.routes.js";
import { linkedinAuthRoutes } from "./linkedin-auth.routes.js";
import { linkedinRoutes } from "./linkedin.routes.js";
import { actionsRoutes } from "./actions.routes.js";

export const apiRouter = Router();

apiRouter.use("/documents", documentRoutes);
apiRouter.use("/chat", chatRoutes);
apiRouter.use("/google", googleAuthRoutes);
apiRouter.use("/gmail", gmailRoutes);
apiRouter.use("/calendar", calendarRoutes);
apiRouter.use("/linkedin", linkedinAuthRoutes);
apiRouter.use("/linkedin", linkedinRoutes);
apiRouter.use("/actions", actionsRoutes); // NEW