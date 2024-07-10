import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Category, { ICategory } from "../models/Category";
import Product, { IProduct } from "../models/Product";
import { validationResult, body } from "express-validator";
import { upperCaseFirstLetters } from "../utils/stringUtils";

//error handler to prevent redundancy with try-catch blocks in all endpoints
function asyncHandler(func: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (mongoose.connection.readyState === 1) {
        func(req, res, next);
      } else {
        let dbError = new Error();
        dbError.message = "DB must be connected to perform this request.";
        throw dbError;
      }
    } catch (error) {
      next(error);
    }
  };
}

////////////////////////
//** API ENDPOINTS **//
//////////////////////

const test_get = (req: Request, res: Response, next: NextFunction) => {
  return res.json({ data: "test endpoint", status: 200, message: "OK" });
};

const products_get = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    //assumming db is already connected
    const limit_f = Number(req.query.limit);
    const skip_f = Number(req.query.skip);
    // const REGEX_SEARCH_ALL = new RegExp(/\w/, "i");
    const search_f = new RegExp(
      encodeURI(
        typeof req.query.search === "string" ? req.query.search.trim() : ""
      ),
      "i"
    );
    // console.log("encoded search:", search_f, "from", req.query.search);

    const SKIP_MAX = 40;
    const LIMIT_MAX = 40;
    const DEFAULT_LIMIT = 20;

    const searchCount = await Product.countDocuments();
    const allProducts = await Product.find({
      $or: [{ name: search_f }, { brand: search_f }, { tags: search_f }],
    })
      .limit(limit_f > 0 && limit_f <= LIMIT_MAX ? limit_f : DEFAULT_LIMIT)
      .skip(skip_f > 0 && skip_f <= SKIP_MAX ? skip_f : 0);

    return res.json({ search_count: searchCount, data: allProducts });
  }
);
const products_post = [
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    const reqBody_f = <IProduct>req.body;
  }),
];

const product_detail_get = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const productIdParam = req.params.productId;

    //checks if parameter product id is in a correct format
    //return 404 status if not correct
    if (!mongoose.isValidObjectId(productIdParam)) {
      return next(); //404
    }
    const product = await Product.findById(productIdParam);

    //product not found in db
    if (!product) {
      return next(); //404
    }

    return res.json({ data: product });
  }
);
const product_detail_put = (
  req: Request,
  res: Response,
  next: NextFunction
) => {};
const product_detail_delete = (
  req: Request,
  res: Response,
  next: NextFunction
) => {};

const categories_get = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const limit_f = Number(req.query.limit);

    const categoryCount = await Category.countDocuments();
    const allCategories = await Category.find({}, { _id: 0, name: 1 })
      .limit(limit_f > 0 && limit_f <= 25 ? limit_f : 10)
      .sort({ name: "ascending" });
    return res.json({ categoryCount, data: allCategories });
  }
);
const categories_post = [
  body("name")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Provide a category name.")
    .escape(),
  body("alias").optional({ values: "falsy" }).trim().escape(),

  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("categories_POST-> validation error");
      return res.json({ error: errors.array() });
    }
    //check if category is already exists
    const reqBody_f = <ICategory>req.body;
    const categoryName_arr = reqBody_f.name
      .replace(/\sand\s|\s&amp;\s/gi, "&")
      .split("&");

    for (const name of categoryName_arr) {
      const duplicateCategory = await Category.findOne({
        name: new RegExp(name, "i"),
      });
      if (duplicateCategory) {
        console.log("found duplicate category name", name);
        return res.json({
          error: { msg: `${name} already exists as a category.` },
        });
      }
    }
    // its a unique category name that has been sanitized
    const category = new Category({
      name: upperCaseFirstLetters(categoryName_arr.join(" ")),
      alias: reqBody_f.alias,
    });
    //Temporarily comment out
    // await category.save();
    console.log("Needing to save category->", category.name);
    return res.sendStatus(201);
  }),
];

const category_detail_get = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const categoryId = req.params.categoryId;
    if (!mongoose.isValidObjectId(categoryId)) {
      return next(); //404
    }
    const category = await Category.findById(categoryId);

    //product not found in db
    if (!category) {
      return next(); //404
    }

    return res.json({ data: category });
  }
);
const category_detail_put = (
  req: Request,
  res: Response,
  next: NextFunction
) => {};
const category_detail_delete = (
  req: Request,
  res: Response,
  next: NextFunction
) => {};

const reviews_get = (req: Request, res: Response, next: NextFunction) => {};
const reviews_post = (req: Request, res: Response, next: NextFunction) => {};

const review_detail_get = (
  req: Request,
  res: Response,
  next: NextFunction
) => {};
const review_detail_put = (
  req: Request,
  res: Response,
  next: NextFunction
) => {};
const review_detail_delete = (
  req: Request,
  res: Response,
  next: NextFunction
) => {};

export {
  test_get,
  products_get,
  products_post,
  product_detail_get,
  product_detail_put,
  product_detail_delete,
  categories_get,
  categories_post,
  category_detail_get,
  category_detail_put,
  category_detail_delete,
  reviews_get,
  reviews_post,
  review_detail_get,
  review_detail_put,
  review_detail_delete,
};
