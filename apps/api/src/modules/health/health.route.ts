import { Hono } from "hono";
import type { AppEnv } from "@/types/context";

import { healthController } from "./health.controller";

const healthRoute = new Hono<AppEnv>();

healthRoute.get("/", (c) => healthController.getHealth(c));

export default healthRoute;
