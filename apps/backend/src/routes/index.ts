import { Router } from "express";
import { documentRoutes } from "./document.routes.js";
import { chatRoutes } from "./chat.routes.js";
import { googleAuthRoutes } from "./google-auth.routes.js";
import { gmailRoutes } from "./gmail.routes.js";
import { calendarRoutes } from "./calendar.routes.js";

export const apiRouter = Router();

apiRouter.use("/documents", documentRoutes);
apiRouter.use("/chat", chatRoutes);
apiRouter.use("/google", googleAuthRoutes);
apiRouter.use("/gmail", gmailRoutes);
apiRouter.use("/calendar", calendarRoutes);