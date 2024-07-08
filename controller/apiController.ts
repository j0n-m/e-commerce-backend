import { Request, Response, NextFunction } from "express";

const test_get = (req: Request, res: Response, next: NextFunction) => {
  return res.json({ data: "test endpoint" });
};

export { test_get };
