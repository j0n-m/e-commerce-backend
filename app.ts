import express, { NextFunction, Request, Response } from "express";
import apiRouter from "./routes/apiRoutes";
import authRouter from "./routes/authRoutes";
import morgan from "morgan";
import "dotenv/config";
import cors = require("cors");
import cookieParser = require("cookie-parser");
import path from "path";

const app = express();
// const _dirname = path.dirname("");
// const buildPath = path.join(_dirname, "/frontend/dist");
// app.use(express.static(buildPath));

//corsOptions.origin to allow all domains to access the apis

// origin: function (origin, callback) {

//   //true makes sure the if statement always runs
//   //this allows ALL domains to access
//   if (true || !origin) {
//     callback(null, true);
//   } else {
//     callback(new Error("Not allowed by CORS"));
//   }
// },

const corsOptions: cors.CorsOptions = {
  // origin: "http://localhost:5173",
  origin: function (origin, callback) {
    //true makes sure the if statement always runs
    //this allows ALL domains to access
    if (true || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  allowedHeaders: ["Content-Type"],
  credentials: true,
};

//**Middlewares */
app.use(cors(corsOptions));
app.use(morgan("tiny"));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

//**End Middleware */

app.use("/auth", authRouter);
app.use("/api", apiRouter);

// Handles any requests that don't match the ones above

app.use((req, res) => {
  return res.status(404).json({ message: "Page not found." });
});
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.log(error);
  return res.status(500).json({ error: error.message });
});

// app.listen(PORT, () => {
//   console.log(`Server is listening on port: ${PORT}`);
// });

export default app;
