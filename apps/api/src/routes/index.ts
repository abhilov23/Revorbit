import {Hono} from "hono";
import healthRouter from "@/modules/health/health.route";


const routes = new Hono();

routes.route("/health", healthRouter);

export default routes;