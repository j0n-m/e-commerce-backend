import { body } from "express-validator";
import mongoose, { Types } from "mongoose";
import Product from "../models/Product";
import Category from "../models/Category";
import { HighlightType } from "../models/Product";

const productFieldValidator = [
  body("name", "Provide the product name").trim().isLength({ min: 1 }).escape(),
  body("brand", "Provide the brand name").trim().isLength({ min: 1 }).escape(),
  body("price")
    .escape()
    .customSanitizer((value) => {
      const MAX_PRICE = 100000;
      const value_f = Number.parseFloat(value);
      if (value_f >= 0.01 && value_f <= MAX_PRICE) {
        return value_f;
      }
    })
    .custom((value) => {
      if (value >= 0.01) {
        return true;
      } else {
        throw new Error("Price must be greater than or equal to 0.01.");
      }
    }),
  body("retail_price")
    .escape()
    .customSanitizer((value) => {
      const MAX_PRICE = 100000;
      const value_f: number = Number.parseFloat(value);
      if (value_f >= 0.01 && value_f <= MAX_PRICE) {
        return value_f;
      }
    })
    .custom((value) => {
      if (value >= 0.01) {
        return true;
      } else {
        throw new Error("Retail Price must be greater than or equal to 0.01.");
      }
    }),
  body("description").trim().escape().default(""),
  body("highlights", "The highlights field must be in the correct format.")
    .trim()
    .default([])
    .customSanitizer((stringified: [] | string) => {
      if (Array.isArray(stringified)) {
        return stringified;
      }
      return JSON.parse(stringified);
    })
    .custom((arr: HighlightType[]) => {
      if (arr.length === 0) {
        return true;
      }
      // console.log("arr", arr);
      for (const el of arr) {
        if (!el.heading || !el.overview) {
          throw new Error(
            "A highlights value is missing a header or overview value."
          );
        }
        const MAX_HEADING_LENGTH = 1;
        const MAX_OVERVIEW_LENGTH = 1;

        if (
          el.heading.length < MAX_HEADING_LENGTH ||
          el.overview.length < MAX_OVERVIEW_LENGTH
        ) {
          throw new Error(
            "When providing a header and overview value, the character length must be at least one character."
          );
        }
      }
      return true;
    }),
  body("quantity", "Quantity must be a positive integer number.")
    .escape()
    .default(20)
    .isInt({ gt: 0, lt: 251 }),
  body("category", "Categories must include correct category Ids.")
    .escape()
    .customSanitizer((value) => {
      if (typeof value === "string") {
        return [value];
      }
    })
    .custom(async (categories: string[] | mongoose.Types.ObjectId[]) => {
      if (!Array.isArray(categories)) {
        throw new Error("Invalid format for the value.");
      }
      for (const category of categories) {
        if (!mongoose.isValidObjectId(category)) {
          throw new Error(`${category} is not a valid category id format.`);
        } else {
          const foundCategory = await Category.findById(category);
          if (!foundCategory) {
            throw new Error(`${category} is not a valid category id.`);
          }
        }
      }
      return true;
    }),
  body("total_bought", "Total bought must be a positive integer number.")
    .escape()
    .default(0)
    .isInt({ min: 0 }),
  body("tags", "Tags must be in a correct list format.")
    .trim()
    .escape()
    .default([])
    .isArray()
    .custom((arr: string[]) => {
      for (const el of arr) {
        if (el === "") {
          throw new Error("Tag values cannot be empty.");
        }
      }
      return true;
    }),
  body("image_src").trim().escape().default(""),
];

export { productFieldValidator };
