import { NextFunction, Router } from "express";
import * as controller from "../controller/authController";

const router = Router();

//-> /auth/*route*
router.get("/test", controller.verify_Auth, controller.auth_route_test);
router.post("/", controller.verify_Auth, controller.permitAdminOnly); //verifies if authenticated
router.post("/login", controller.safe_IsUserAuthenticated_mw, controller.login);
// router.post("/signup");
router.post("/logout", controller.logout);
router.post("/check-auth", controller.isUserAuthenticated);
// router.use((req, res, next: NextFunction) => {
//   return next();
// });

export default router;
