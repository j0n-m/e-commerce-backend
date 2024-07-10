import express, { NextFunction, Request, Response } from "express";
import apiRouter from "./routes/apiRoutes";
import authRouter from "./routes/authRoutes";
import morgan from "morgan";
import "dotenv/config";
import mongoose from "mongoose";
import { connectToDB } from "./db/connect";

const app = express();

const PORT = Number(process.env.PORT) ?? 3000;

//event listeners
mongoose.connection.on("connected", () => {
  console.log("Successfully connected to the DB.");
});
mongoose.connection.on("disconnected", () => {
  console.error("Disconnected from the DB.");
});
mongoose.connection.on("error", () => {
  console.error("Error connecting to the DB.");
});
mongoose.set("strictQuery", false);
//connection to the DB
connectToDB();

//**Middlewares */

app.use(morgan("tiny"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//**End Middleware */

app.use("/auth", authRouter);
app.use("/api", apiRouter);

app.use((req, res) => {
  return res.sendStatus(404);
});
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.log(error);
  return res.sendStatus(500);
});

app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});
