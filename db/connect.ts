import mongoose from "mongoose";
import getDbCredentials from "./config";
import "dotenv/config";
import { Express } from "express";

async function connectToDB(app: Express, port: number) {
  const db = getDbCredentials();

  if (!db) return;

  try {
    await mongoose.connect(db);

    app.listen(port, () => {
      console.log(`Server is listening on port: ${port}`);
    });
  } catch (error) {
    console.error(error);
  }
}

export { connectToDB };
