import mongoose, { Types } from "mongoose";
import Category from "../models/Category";
import Product from "../models/Product";
import { IProduct } from "../models/Product";

async function safeHandler(cb: Function) {
  try {
    if (mongoose.connection.readyState === 1) {
      await cb();
    } else {
      throw new Error("Initializing failed. Not connected to the Database.");
    }
  } catch (error) {
    console.error(error);
  }
}
const categoryNames = [
  "Electronics",
  "Office Products",
  "Video Games",
  "Pet Supplies",
  "Home & Kitchen",
  "Garden & Outdoors",
  "Toys & Games",
];
const productArr: IProduct[] = [
  {
    name: "Playstation 5",
    brand: "Sony",
    price: 309.99,
    retail_price: 399.99,
    description: "",
    highlights: [],
    category: [],
    tags: [],
  },
  {
    name: "Nintendo 64 Console",
    brand: "Nintendo",
    price: 199.99,
    retail_price: 249.99,
    description: "",
    highlights: [],
    category: [
      new mongoose.Types.ObjectId("668d71ba569596eb9af05f19"),
      new mongoose.Types.ObjectId("668d71b9569596eb9af05f13"),
    ],
    tags: [],
  },
  {
    name: "Xbox 360",
    brand: "Microsoft",
    price: 199.99,
    retail_price: 199.99,
    description: "",
    highlights: [],
    category: [
      new mongoose.Types.ObjectId("668d71ba569596eb9af05f19"),
      new mongoose.Types.ObjectId("668d71b9569596eb9af05f13"),
    ],
    tags: [],
  },
];

async function initializeCategories() {
  console.log("initializeCategory()");
  for (let i = 0; i < categoryNames.length; i++) {
    const category = new Category({
      name: categoryNames[i],
    });
    const duplicateCategory = await Category.findOne({
      name: categoryNames[i],
    });
    console.log("After querying for duplicate category");
    if (duplicateCategory == null) {
      await category.save();
      console.log(`Save a category - ${category.name}`);
    } else {
      console.log(`${categoryNames[i]} already exists in the DB, moving on...`);
    }
  }
}
async function initializeProducts() {
  console.log("initializeProducts()");
  productArr.forEach(
    async ({
      name,
      brand,
      price,
      retail_price,
      description,
      highlights,
      category,
      tags,
    }) => {
      //assuming electronics cat exists
      // const electronicsCat = await Category.findOne({
      //   name: categoryNames[0],
      // }).exec();
      const duplicateItem = await Product.findOne({ name, brand }).exec();
      if (duplicateItem) {
        console.log(`${name} already exists in db, moving on...`);
        return;
      }
      const item = new Product({
        // _id,
        name,
        brand,
        price,
        retail_price,
        description,
        highlights,
        tags,
        category,
      });
      await item.save();
      console.log(`Done saving item - ${item.name}`);
    }
  );
}
async function initController() {
  console.log("initController() started");
  await safeHandler(initializeCategories);
  console.log("about to start initializeProducts");
  await safeHandler(initializeProducts);
}

export { initController };
