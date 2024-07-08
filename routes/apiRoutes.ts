import { Router } from "express";
import * as controller from "../controller/apiController";

const router = Router();

router.get("/test", controller.test_get);

export default router;
