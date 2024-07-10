import mongoose from "mongoose";
import getDbCredentials from "./config";
import { initController } from "./initialize";
import "dotenv/config";

async function connectToDB() {
  const db = getDbCredentials();

  if (!db) return;

  try {
    await mongoose.connect(db);
    // debugger;
    //Temporarily add items to db
    // initController();
  } catch (error) {
    console.error(error);
  }
}

export { connectToDB };
