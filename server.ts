import mongoose from "mongoose";
import { connectToDB } from "./db/connect";
import app from "./app";
import "dotenv/config";

const PORT = Number(process.env.PORT) ?? 3000;

//event listeners
mongoose.connection.on("connected", () => {
  console.log("Successfully connected to the DB.");
});
mongoose.connection.on("disconnected", () => {
  console.error("Disconnected from the DB. Reconnecting...");
  // connectToDB(app, PORT);
});
mongoose.connection.on("error", () => {
  console.error("Error connecting to the DB.");
});
mongoose.set("strictQuery", false);
//connection to the DB
connectToDB(app, PORT);
