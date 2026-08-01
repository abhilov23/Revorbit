import { Hono } from "hono";

import { healthController } from "./health.controller";

const healthRoute = new Hono();

healthRoute.get("/", (c) => healthController.getHealth(c));

export default healthRoute;
