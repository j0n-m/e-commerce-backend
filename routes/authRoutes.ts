import { Router } from "express";
import * as controller from "../controller/authController";

const router = Router();

//-> /auth/*route*
router.get("/auth-test", controller.auth_route_test);
router.post("/", controller.verify_Auth); //verifies if authenticated
router.post("/login", controller.login);
router.post("/signup");
router.post("/logout", controller.logout);
router.post("/check-auth", controller.isUserAuthenticated);

export default router;
