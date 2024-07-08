import { Router } from "express";
import * as controller from "../controller/authController";

const router = Router();

router.get("/login-test", controller.login_test);

export default router;
