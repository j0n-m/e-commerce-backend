import express, { NextFunction, Request, Response } from "express";
import apiRouter from "./routes/apiRoutes";
import authRouter from "./routes/authRoutes";
import morgan from "morgan";

import "dotenv/config";

const app = express();

const PORT = Number(process.env.PORT) ?? 3000;
//**Middlewares */

app.use(morgan("tiny"));

//**End Middleware */

app.use("/auth", authRouter);
app.use("/api", apiRouter);

app.use((req, res) => {
  res.sendStatus(404);
});
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.log(error);
  res.sendStatus(500);
});

app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});
