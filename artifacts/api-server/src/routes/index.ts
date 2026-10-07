import { Router, type IRouter } from "express";
import healthRouter from "./health";
import autoflowRouter from "./autoflow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(autoflowRouter);

export default router;
