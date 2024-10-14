import { afterAll, beforeAll, describe, expect, it, test } from "vitest";
import supertest from "supertest";
import app from "../app";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { CartItemsType } from "../models/Customer";
import { IOrderHistory } from "../models/OrderHistory";
import initializeTestDb from "./initializeTestDb";
import {
  categoryIds,
  productIds,
  orderIds,
  customerIds,
} from "./initializeTestDb";

const request = supertest(app);
beforeAll(async () => {
  const testDb = await MongoMemoryServer.create({
    instance: { dbName: "e_commerce_app" },
  });
  const dbURI = testDb.getUri();
  // await mongoose.connect(testDb.getUri());
  await mongoose.connect(dbURI);
  await initializeTestDb();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongoose.connection.close();
});

describe("Test GET route", () => {
  it("should get a json response back from /api/test", async () => {
    const res = await request
      .get("/api/test")
      .expect("Content-Type", /json/)
      .expect(200);
    expect(res.body.message).toMatch(/ok/i);
  });
});

// NEED TO INITIALIZE DB WITH CUSTOMER,PRODUCT, and CATEGORY
describe("Order History API endpoints", () => {
  describe("Order History GET routes", () => {
    describe("Order History get full list", () => {
      it("should return a 200 status and return an array.", async () => {
        const res1 = await request
          .post("/auth/login")
          .send({ email: "testadmin@mail.com", password: "testadmin" })
          .withCredentials(true)
          .expect(200);
        const resCookie = res1.headers["set-cookie"];

        const res = await request
          .get("/api/orderhistory")
          .withCredentials(true)
          .set("Cookie", resCookie)
          .expect(200)
          .expect("Content-Type", /json/i);
        expect(res.body.order_history).not.toEqual([]);
        expect(res.body.order_history).length.greaterThanOrEqual(1);
      });
    });
    describe("Order History get single order", () => {
      it("should return 404 status for invalid order id", async () => {
        const res1 = await request
          .post("/auth/login")
          .send({ email: "testadmin@mail.com", password: "testadmin" })
          .withCredentials(true)
          .expect(200);
        const resCookie = res1.headers["set-cookie"];

        const res = await request
          .get("/api/orderhistory/fake_order_id")
          .withCredentials(true)
          .set("Cookie", resCookie)
          .expect(404);
      });
      it("should return 200 status for valid order id", async () => {
        const res1 = await request
          .post("/auth/login")
          .send({ email: "testadmin@mail.com", password: "testadmin" })
          .withCredentials(true)
          .expect(200);
        const resCookie = res1.headers["set-cookie"];

        const res = await request
          .get(`/api/orderhistory/${orderIds[0]}`)
          .withCredentials(true)
          .set("Cookie", resCookie)
          .expect(200)
          .expect("Content-Type", /json/);
      });
    });
  });
  describe("Order History Delete route", () => {
    describe("Delete an order history", () => {
      it("should return 200 and successfully deleted", async () => {
        const orderIdToDelete = orderIds[0];
        const res1 = await request
          .post("/auth/login")
          .send({ email: "testadmin@mail.com", password: "testadmin" })
          .withCredentials(true)
          .expect(200);
        const resCookie = res1.headers["set-cookie"];

        await request
          .delete(`/api/orderhistory/${orderIdToDelete}`)
          .set("Cookie", resCookie)
          .withCredentials(true)
          .expect(200);
      });
    });
  });
});
