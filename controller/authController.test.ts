import supertest from "supertest";
import { afterAll, beforeAll, it } from "vitest";
import app from "../app";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import initializeTestDb, { customerIds } from "../__test__/initializeTestDb";
import { describe } from "node:test";

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

describe("Auth routes", () => {
  describe("Authenitcated users route only", () => {
    it("should return 401 unauthorized", async () => {
      await request.get("/auth/test").expect(401);
    });

    it("should return 200 as an authenticated user", async () => {
      //login as user
      const res = await request
        .post("/auth/login")
        .withCredentials(true)
        .send({
          email: "testuser@mail.com",
          password: "testpass",
        })
        .expect(200);
      const resCookie = res.headers["set-cookie"];

      //test auth route
      await request
        .get("/auth/test")
        .set("Cookie", [...resCookie])
        .expect(200);
    });
  });
  describe("Authenitcated Admin users route only", () => {
    describe("non logged in users", () => {
      it("should return 401 unauthorized.", async () => {
        await request.get("/auth/testadmin").send().expect(401);
      });
    });
    describe("regular users logged in.", async () => {
      it("should return 403 unauthorized user permission", async () => {
        //login as user
        const res = await request
          .post("/auth/login")
          .send({
            email: "testuser@mail.com",
            password: "testpass",
          })
          .expect(200);
        const resCookie = res.headers["set-cookie"];

        //test auth route
        await request
          .get("/auth/testadmin")
          .send()
          .set("Cookie", [...resCookie])
          .expect(403);
      });
    });
    describe("admin users logged in", () => {
      it("should return 200 - successful access", async () => {
        //login as admin
        const res = await request
          .post("/auth/login")
          .withCredentials(true)
          .send({ email: "testadmin@mail.com", password: "testadmin" })
          .expect(200);
        const resCookie = res.headers["set-cookie"];
        // console.log(resCookie);

        const admin = await request
          .get("/auth/testadmin")
          .withCredentials(true)
          .send()
          .set("Cookie", resCookie)
          .expect(200);
      });
    });
  });
});
