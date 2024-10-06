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
        const res = await request
          .get("/api/orderhistory")
          .expect(200)
          .expect("Content-Type", /json/i);
        expect(res.body.order_history).not.toEqual([]);
        expect(res.body.order_history).length.greaterThanOrEqual(1);
      });
    });
    describe("Order History get single order", () => {
      it("should return 404 status for invalid order id", async () => {
        await request.get("/api/orderhistory/fake_order_id").expect(404);
      });
      it("should return 200 status for valid order id", async () => {
        await request
          .get(`/api/orderhistory/${orderIds[0]}`)
          .expect(200)
          .expect("Content-Type", /json/);
      });
    });
  });
  describe("Order History POST route", () => {
    describe("Create Order history", () => {
      it("should return 200 created", async () => {
        const order: IOrderHistory = {
          shipping: {
            cost: 0,
            code: 1,
          },
          cart: [
            {
              _id: productIds[0],
              name: "test",
              brand: "test",
              price: 2,
              retail_price: 43,
              quantity: 3,
              cart_quantity: 1,
              category: [
                {
                  _id: categoryIds[1],
                  name: "catname",
                },
              ],
            },
          ],
          cart_total: 6,
          customer_id: new mongoose.Types.ObjectId(customerIds[0]),
          order_date: new Date("2024-10-01T22:31:31.507Z"),
        };
        await request.post("/api/orderhistory").send(order).expect(200);
      });
      it("should return 400 for missing fields", async () => {
        const order = {
          cart: {
            _id: productIds[1],
            name: "test",
            brand: "test",
            price: 2,
            retail_price: 43,
            quantity: 3,
            cart_quantity: 1,
            // category: [
            //   {
            //     _id: "668d71b9569596eb9af05f13",
            //     name: "catname",
            //   },
            // ],
          },
          customer_id: customerIds[0],
          order_date: "2024-10-01T22:31:31.507Z",
        };
        await request.post("/api/orderhistory").send(order).expect(400);
      });
    });
  });
  describe("Order History Delete route", () => {
    describe("Delete an order history", () => {
      it("should return 200 and successfully deleted", async () => {
        const orderIdToDelete = orderIds[0];
        await request
          .delete(`/api/orderhistory/${orderIdToDelete}`)
          .expect(200);
        await request.get(`/api/orderhistory/${orderIdToDelete}`).expect(404);
      });
    });
  });
});
