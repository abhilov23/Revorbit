import { Hono } from "hono";

import routes from "@/routes"
import {env} from "@/config/env";
import type { Variables } from "@/types/context";
import { requestIdMiddleware } from "./middleware/request-id";
import { loggerMiddleware } from "./middleware/logger";

const app = new Hono<{ Variables: Variables }>();

// Global middleware
app.use("*", requestIdMiddleware)
app.use("*", loggerMiddleware)


// Routes
app.route(env.API_PREFIX, routes)


//Not Found Handler

// Error Handler

export default app;
