import { Response, Request, NextFunction } from "express";

const login_test = (req: Request, res: Response, next: NextFunction) => {
  return res.json({ data: "login test" });
};

export { login_test };
