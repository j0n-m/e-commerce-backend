import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Category, { ICategory } from "../models/Category";
import Product, { IProduct, HighlightType } from "../models/Product";
import { validationResult, body, query, param } from "express-validator";
import Review, { IReview } from "../models/Review";
import { QueryApi } from "../utils/QueryApi";
import { AggregateApi } from "../utils/AggregateApi";

type MiddlewareFunction = (
  req: Request<any, any, any, any>,
  res: Response,
  next: NextFunction
) => any;
//error handler to prevent redundancy with try-catch blocks in all endpoints
function asyncHandler(func: MiddlewareFunction) {
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
  return res.json({ data: "test endpoint", message: "OK" });
};

export type searchParameters = {
  skip?: string;
  limit?: string;
  search?: string;
  sort?: string;
  fields?: string;
  price_low?: string;
  price_high?: string;
  page?: string;
  brand?: string;
  deals?: string;
};
const products_get = [
  query([
    "skip",
    "limit",
    "search",
    "sort",
    "fields",
    "price_low",
    "price_high",
    "page",
    "brand",
    "deals",
  ])
    .escape()
    .optional(),
  asyncHandler(
    async (
      req: Request<{}, {}, {}, searchParameters>,
      res: Response,
      next: NextFunction
    ) => {
      let productListCount: number;

      const search_f = new RegExp(
        typeof req.query.search === "string"
          ? req.query.search.trim().replace(/_/gi, " ")
          : "",
        "gi"
      );

      const productsApi = new AggregateApi(
        Product.aggregate([{ $match: {} }]),
        req.query
      ).populate("categories", "category", "_id", "category");

      //~ FILTER ~
      //most specific searches first
      if (req.query.brand) {
        const reg = new RegExp(req.query.brand, "gi");
        productsApi.aggregation.append({ $match: { brand: reg } });
      }

      //least specific search
      if (req.query.search) {
        productsApi.aggregation.append({
          $match: {
            $or: [
              { name: search_f },
              { brand: search_f },
              { tags: search_f },
              { "highlights.overview": search_f },
              { "category.name": search_f },
            ],
          },
        });
      }
      if (req.query.deals === "true") {
        productsApi.aggregation.append({
          $addFields: {
            discount: {
              $let: {
                vars: {
                  result: {
                    $subtract: [1, { $divide: ["$price", "$retail_price"] }],
                  },
                },
                in: {
                  $round: ["$$result", 2],
                },
              },
            },
          },
        });
      }
      productsApi.filter();

      //price filter
      if (req.query.price_low && req.query.price_high) {
        const price_low =
          Number.parseFloat(req.query.price_low) >= 0
            ? Number.parseFloat(req.query.price_low)
            : 0;
        const price_high =
          Number.parseFloat(req.query.price_high) >= price_low
            ? Number.parseFloat(req.query.price_high)
            : Number.MAX_VALUE;

        productsApi.aggregation.append({
          $match: {
            price: {
              $gte: price_low,
              $lte: price_high,
            },
          },
        });
      }
      const clone = new AggregateApi(productsApi.aggregation, req.query);
      productListCount = (await clone.aggregation).length;
      //paginates the query to a limit & offset
      productsApi.sort().paginate();

      //Calculates how many pages & when to send 404 for non existant pages
      const { pageNum, pageLimit, pageSkip } = productsApi.pageInfo();

      //displays total num of products searched
      if (req.query.page) {
        if (pageNum > 1 && pageSkip >= productListCount) {
          return next(); //res 404 - not found
        }
      }
      //execute query
      const allProducts = await productsApi.aggregation;

      return res.json({
        records_count: productListCount,
        total_pages: Math.ceil(productListCount / pageLimit),
        list_count: allProducts.length,
        products: allProducts,
      });
    }
  ),
];
const productsByCategory_get = [
  param("categoryId").escape(),
  query([
    "skip",
    "limit",
    "search",
    "sort",
    "fields",
    "price_low",
    "price_high",
    "page",
    "brand",
    "deals",
  ])
    .escape()
    .optional(),
  asyncHandler(
    async (
      req: Request<{ categoryId: string }, {}, {}, searchParameters>,
      res: Response,
      next: NextFunction
    ) => {
      const categoryId = req.params.categoryId;

      if (!mongoose.isValidObjectId(categoryId)) {
        return next(); //404
      }
      let productListCount: number;

      const productsApi = new AggregateApi(
        Product.aggregate([
          { $match: { category: new mongoose.Types.ObjectId(categoryId) } },
        ]),
        req.query
      ).populate("categories", "category", "_id", "category");

      //Specific filters
      if (req.query.deals === "true") {
        productsApi.aggregation.append({
          $addFields: {
            discount: {
              $let: {
                vars: {
                  result: {
                    $subtract: [1, { $divide: ["$price", "$retail_price"] }],
                  },
                },
                in: {
                  $round: ["$$result", 2],
                },
              },
            },
          },
        });
      }

      //price filter
      if (req.query.price_low && req.query.price_high) {
        const price_low =
          Number.parseFloat(req.query.price_low) >= 0
            ? Number.parseFloat(req.query.price_low)
            : 0;
        const price_high =
          Number.parseFloat(req.query.price_high) >= price_low
            ? Number.parseFloat(req.query.price_high)
            : Number.MAX_VALUE;

        productsApi.aggregation.append({
          $match: {
            price: {
              $gte: price_low,
              $lte: price_high,
            },
          },
        });
      }

      //FILTER
      productsApi.filter();
      const clone = new AggregateApi(productsApi.aggregation, req.query);
      productListCount = (await clone.aggregation).length;

      //PAGINATE
      productsApi.sort().paginate();

      const { pageSkip, pageLimit, pageNum } = productsApi.pageInfo();

      if (req.query.page) {
        if (pageNum > 1 && pageSkip >= productListCount) {
          return next(); //res 404 - not found
        }
      }
      const allProducts = await productsApi.aggregation;

      return res.json({
        records_count: productListCount,
        total_pages: Math.ceil(productListCount / pageLimit),
        list_count: allProducts.length,
        products: allProducts,
      });
    }
  ),
];

const products_post = [
  body("name", "Provide the product name").trim().isLength({ min: 1 }).escape(),
  body("brand", "Provide the brand name").trim().isLength({ min: 1 }).escape(),
  body("price")
    .escape()
    .customSanitizer((value) => {
      const MAX_PRICE = 100000;
      const value_f = Number(Number.parseFloat(value).toFixed(2));
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
      const value_f: number = Number(Number.parseFloat(value).toFixed(2));
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
  body("quantity", "Quantity must be an integer number between 0 and 250.")
    .escape()
    .isInt({ min: 0, max: 250 }),
  body("category", "Categories must include correct category Ids.")
    .escape()
    .customSanitizer((value) => {
      // console.log("value", value);
      if (typeof value === "string") {
        return [value];
      } else {
        return value;
      }
    })
    .custom(async (categories: string[] | mongoose.Types.ObjectId[]) => {
      // console.log("categories", categories);
      if (!Array.isArray(categories)) {
        throw new Error("Invalid format for the category field.");
      }
      if (categories.length === 0) {
        throw new Error("A minimum of one category must be set.");
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

  asyncHandler(
    (req: Request<{}, {}, IProduct>, res: Response, next: NextFunction) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array() });
      }
      const product = new Product({
        name: req.body.name,
        brand: req.body.brand,
        price: req.body.price,
        retail_price: req.body.retail_price,
        description: req.body.description,
        highlights: req.body.highlights,
        quantity: req.body.quantity,
        category: req.body.category,
        total_bought: req.body.total_bought,
        tags: req.body.tags,
        image_src: req.body.image_src,
      });
      product.save();
      // console.log("post-product -need to connect to db to write");
      return res.sendStatus(204);
    }
  ),
];

const product_detail_get = [
  param("productId").escape(),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const productIdParam = req.params.productId;

    //checks if parameter product id is in a correct format
    //return 404 status if not correct
    if (!mongoose.isValidObjectId(productIdParam)) {
      return next(); //404
    }
    const product = await Product.findById(productIdParam).populate("category");

    //product not found in db
    if (!product) {
      return next(); //404
    }

    return res.json({ product: product });
  }),
];
const product_detail_put = [
  param("productId").escape(),
  body("name", "Provide the product name")
    .trim()
    .escape()
    .optional()
    .isLength({ min: 1 }),
  body("brand", "Provide the brand name")
    .trim()
    .escape()
    .optional()
    .isLength({ min: 1 }),
  body("price", "Price must be between 0.01 and 100000")
    .escape()
    .optional()
    // .custom((value) => {
    //   if (Number(value) >= 0.01) {
    //     return true;
    //   } else {
    //     throw new Error("Price must be greater than or equal to 0.01.");
    //   }
    // }),
    .isFloat({ min: 0.01, max: 100000 }),
  body("retail_price", "Retail Price must be between 0.01 and 100000")
    .escape()
    .optional()
    // .custom((value) => {
    //   if (Number(value) >= 0.01) {
    //     return true;
    //   } else {
    //     throw new Error("Retail price must be greater than or equal to 0.01.");
    //   }
    // })
    .isFloat({ min: 0.01, max: 100000 }),
  body("description").trim().escape().optional(),
  body("highlights", "The highlights field must be in the correct format.")
    .trim()
    .escape()
    .optional()
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
            "The highlights field is missing a header or overview value."
          );
        }
        const MAX_HEADING_LENGTH = 1;
        const MAX_OVERVIEW_LENGTH = 1;

        if (
          el.heading.length < MAX_HEADING_LENGTH ||
          el.overview.length < MAX_OVERVIEW_LENGTH
        ) {
          throw new Error(
            "The header and overview values must have a length of at least one character."
          );
        }
      }
      return true;
    }),
  body("quantity", "Quantity must be a positive integer number.")
    .escape()
    .optional()
    .isInt({ gt: 0, lt: 251 }),
  body("category", "Categories must include correct category Ids.")
    .escape()
    .optional()
    .custom(async (categories: string[] | mongoose.Types.ObjectId[]) => {
      // console.log("category", categories);
      if (!Array.isArray(categories)) {
        throw new Error("Invalid format for category field.");
      }
      if (categories.length === 0) {
        throw new Error("A minimum of one category must be set.");
      }
      for (const category of categories) {
        if (!mongoose.isValidObjectId(category)) {
          throw new Error(`${category} is not a valid category id.`);
        } else {
          const foundCategory = await Category.findById(category);
          if (!foundCategory) {
            throw new Error(`${category} is not a valid category id.`);
          }
        }
      }
      return true;
    }),
  body(
    "total_bought",
    "Total bought must be an integer number greater than or equal to 0."
  )
    .escape()
    .optional()
    .isInt({ min: 0 }),
  body("tags", "Tags must be in a correct list format.")
    .trim()
    .escape()
    .optional()
    .isArray()
    .custom((arr: string[]) => {
      for (const el of arr) {
        if (el === "") {
          throw new Error("Tag values cannot be empty.");
        }
      }
      return true;
    }),
  body("image_src", "Image source must be in a URI format.")
    .trim()
    .optional()
    .isURL(),
  asyncHandler(
    async (
      req: Request<{ productId: string }, {}, Partial<IProduct>>,
      res: Response,
      next: NextFunction
    ) => {
      const productId: string = req.params.productId;

      if (!mongoose.isValidObjectId(productId)) {
        return next();
      }
      if (Object.keys(req.body).length === 0) {
        return res
          .status(400)
          .json({ error: "No data was sent from the payload." });
      }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const product = await Product.findById(productId);

      if (!product) {
        return next();
      }
      const updatedProduct = await Product.findByIdAndUpdate(productId, {
        _id: product._id,
        name: req.body.name || product.name,
        brand: req.body.brand || product.brand,
        price: Number(Number(req.body.price).toFixed(2)) || product.price,
        retail_price:
          Number(Number(req.body.retail_price).toFixed(2)) ||
          product.retail_price,
        description: req.body.description || product.description,
        highlights: req.body.highlights || product.highlights,
        quantity: req.body.quantity || product.quantity,
        category: req.body.category || product.category,
        total_bought: req.body.total_bought || product.total_bought,
        tags: req.body.tags || product.tags,
        image_src: req.body.image_src || product.image_src,
      });
      if (!updatedProduct) {
        return res.status(400).json({
          error: `Error! Product: ${productId} could not be updated.`,
        });
      }

      return res.sendStatus(204);
    }
  ),
];
const product_detail_delete = [
  param("productId").escape(),
  asyncHandler(
    async (
      req: Request<{ productId: string }>,
      res: Response,
      next: NextFunction
    ) => {
      const productId: string = req.params.productId;
      if (!mongoose.isValidObjectId(productId)) {
        return next();
      }
      //verify productid is active in db
      const productToDelete = await Product.findById(productId);
      if (!productToDelete) {
        return next();
      }
      //verify that reviews are not referenced to the product, otherwise send error
      const allReviewsByProduct = await Review.find(
        { product_id: productId },
        { reviewer_name: 1 }
      );
      if (allReviewsByProduct.length > 0) {
        //send error
        return res.status(400).json({
          error:
            "Delete the following review(s) that are referencing this product.",
          data: allReviewsByProduct,
        });
      }
      await productToDelete.deleteOne();
      return res.sendStatus(200);
    }
  ),
];

const categories_get = [
  query([
    "skip",
    "limit",
    "search",
    "sort",
    "fields",
    "price_low",
    "price_high",
    "page",
    "brand",
    "deals",
  ])
    .escape()
    .optional(),
  asyncHandler(
    async (
      req: Request<{}, {}, {}, searchParameters>,
      res: Response,
      next: NextFunction
    ) => {
      const categoryApi = new AggregateApi(
        Category.aggregate([{ $match: {} }]),
        req.query
      );
      let categoryListCount: number;

      if (req.query.search) {
        const search_f = new RegExp(
          req.query.search.trim().replace(" ", ""),
          "gi"
        );
        if (mongoose.isValidObjectId(req.query.search)) {
          categoryApi.aggregation.append({
            $match: {
              $or: [
                { name: search_f },
                { _id: new mongoose.Types.ObjectId(req.query.search) },
              ],
            },
          });
        } else {
          categoryApi.aggregation.append({
            $match: {
              name: search_f,
            },
          });
        }
      }
      //Filter
      categoryApi.filter();
      const clone = new AggregateApi(categoryApi.aggregation, req.query);
      categoryListCount = (await clone.aggregation).length;
      // Paginate
      categoryApi.sort().paginate();
      const { pageLimit, pageSkip, pageNum } = categoryApi.pageInfo();
      if (req.query.page) {
        if (pageNum > 1 && pageSkip >= categoryListCount) {
          return next(); //res 404 - not found
        }
      }

      const allCategories = await categoryApi.aggregation;
      // const allCategories = await Category.find({}, { name: 1 })
      //   .limit(limit_f > 0 && limit_f <= 25 ? limit_f : 10)
      //   .sort({ name: "ascending" });
      return res.json({
        records_count: categoryListCount,
        total_pages: Math.ceil(categoryListCount / pageLimit),
        list_count: allCategories.length,
        categories: allCategories,
      });
    }
  ),
];
const categories_post = [
  body("name", "Provide a category name.").trim().isLength({ min: 1 }).escape(),
  body("alias").trim().escape().default(""),

  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
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
        // console.log("found duplicate category name", name);
        return res.json({
          error: { msg: `${name} already exists as a category.` },
        });
      }
    }
    // its a unique category name that has been sanitized
    const category = new Category({
      name: categoryName_arr.join(" "),
      alias: reqBody_f.alias,
    });

    await category.save();
    return res.sendStatus(201);
  }),
];

const category_detail_get = [
  param("categoryId").escape(),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const categoryId = req.params.categoryId;
    if (!mongoose.isValidObjectId(categoryId)) {
      return next(); //404
    }
    const category = await Category.findById(categoryId).select("-__v");

    //product not found in db
    if (!category) {
      return next(); //404
    }

    return res.json({ category });
  }),
];
const category_detail_put = [
  param("categoryId").escape(),
  body("name").trim().optional().isLength({ min: 1 }),
  body("alias").trim().optional(),
  asyncHandler(
    async (
      req: Request<{ categoryId: string }, {}, Partial<ICategory>>,
      res: Response,
      next: NextFunction
    ) => {
      const categoryId = req.params.categoryId;
      console.log("body", req.body);
      if (Object.keys(req.body).length === 0) {
        return res
          .status(400)
          .json({ error: "No data was sent from the payload." });
      }

      if (!mongoose.isValidObjectId(categoryId)) {
        return next(); //404
      }
      const error = validationResult(req);
      if (!error.isEmpty()) {
        return res.status(400).json({ error: error.array() });
      }
      const category = await Category.findById(categoryId);

      if (!category) {
        //not a current id in the db, return 404
        return next();
      }
      const updatedCategory = await Category.findByIdAndUpdate(categoryId, {
        _id: category._id,
        name: req.body.name || category.name,
        alias: req.body.alias === "" ? "" : req.body.alias || category.alias,
      });
      if (!updatedCategory) {
        return res.status(400).json({
          error: `Error! Category: ${categoryId} could not be updated.`,
        });
      }
      return res.sendStatus(204);
    }
  ),
];
const category_detail_delete = [
  param("categoryId").escape(),
  asyncHandler(
    async (
      req: Request<{ categoryId: string }>,
      res: Response,
      next: NextFunction
    ) => {
      const categoryId = req.params.categoryId;

      if (!mongoose.isValidObjectId(categoryId)) {
        return next();
      }
      //Check if categoryid references an active category in the db
      const category = await Category.findById(categoryId);

      if (!category) {
        return next();
      }
      //Check if there are existing products that are using the category name
      const existingProductWithCategory = await Product.find(
        { category: category._id },
        { name: 1 }
      );

      if (existingProductWithCategory.length > 0) {
        //refuse to delete the category until the products no longer reference it.
        return res.status(400).json({
          error:
            "Existing products are currently using the category name. You must delete the category name from the following products.",
          data: existingProductWithCategory,
        });
      }

      await category.deleteOne();
      return res.sendStatus(200);
    }
  ),
];

const reviews_get = asyncHandler(
  async (
    req: Request<{}, {}, {}, searchParameters>,
    res: Response,
    next: NextFunction
  ) => {
    let reviewListCount: number;
    const reviewApi = new AggregateApi(
      Review.aggregate([{ $match: {} }]),
      req.query
    ).populate("products", "product_id", "_id", "product_id");

    if (req.query.search) {
      const reviewSearch = new RegExp(req.query.search, "gi");

      if (mongoose.isValidObjectId(req.query.search)) {
        const potential_Id = new mongoose.Types.ObjectId(req.query.search);
        reviewApi.aggregation.append({
          $match: {
            $or: [{ "product_id._id": potential_Id }, { _id: potential_Id }],
          },
        });
      } else {
        reviewApi.aggregation.append({
          $match: {
            $or: [
              { reviewer_name: reviewSearch },
              { review_description: reviewSearch },
              { "product_id.name": reviewSearch },
              { "product_id.brand": reviewSearch },
              { "product_id.tags": reviewSearch },
            ],
          },
        });
      }
      reviewApi.aggregation.append({
        $project: {
          "product_id.__v": 0,
        },
      });
    }
    reviewApi.filter().sort("-review_date");

    const clone = new AggregateApi(reviewApi.aggregation, req.query);
    reviewListCount = (await clone.aggregation).length;

    //Pagination
    reviewApi.paginate();

    const { pageNum, pageLimit, pageSkip } = reviewApi.pageInfo();

    if (req.query.page) {
      if (pageNum > 1 && pageSkip >= reviewListCount) {
        return next(); //res 404 - not found
      }
    }

    const allReviews = await reviewApi.aggregation;

    return res.json({
      records_count: reviewListCount,
      total_pages: Math.ceil(reviewListCount / pageLimit),
      list_count: allReviews.length,
      reviews: allReviews,
    });
  }
);

const reviews_post = [
  body("rating", "Rating must be a range from 1 to 5.")
    .trim()
    .escape()
    .isInt({ min: 1, max: 5 }),
  body("reviewer_name", "The reviewer name cannot be empty.")
    .trim()
    .escape()
    .isLength({ min: 1 }),
  body("review_description", "The review description cannot be blank")
    .trim()
    .escape()
    .isLength({ min: 1 }),
  body("review_date", "Review date must be in the ISO8601 time format.")
    .trim()
    .escape()
    .default(new Date())
    .isISO8601(),
  body(
    "review_edit_date",
    "Review edit date must be in the ISO8601 time format."
  )
    .trim()
    .escape()
    .optional()
    .isISO8601(),
  body("product_id", "Product id must be a valid id.")
    .trim()
    .escape()
    .custom(async (id) => {
      const productId = id;
      if (!mongoose.isValidObjectId(productId)) {
        throw new Error("Product id is not in a valid format.");
      }
      const product = await Product.findById(productId);
      if (product) {
        return true;
      } else {
        throw new Error("Product id is not valid.");
      }
    }),
  asyncHandler(
    async (
      req: Request<{}, {}, IReview>,
      res: Response,
      next: NextFunction
    ) => {
      const error = validationResult(req);
      if (!error.isEmpty()) {
        return res.status(400).json({ error: error.array() });
      }
      const review = new Review({
        rating: req.body.rating,
        reviewer_name: req.body.reviewer_name,
        review_description: req.body.review_description,
        review_date: req.body.review_date,
        review_edit_date: req.body.review_edit_date,
        product_id: req.body.product_id,
      });
      await review.save();
      return res.sendStatus(204);
    }
  ),
];

const review_detail_get = [
  param("reviewId").escape(),
  asyncHandler(
    async (
      req: Request<{ reviewId: string }>,
      res: Response,
      next: NextFunction
    ) => {
      // /review/:reviewId
      const reviewId = req.params.reviewId;
      if (!mongoose.isValidObjectId(reviewId)) {
        return next();
      }

      const review = await Review.findById(reviewId).populate("product_id");
      if (!review) {
        //if id is not active in the db, return 404 status.
        return next();
      }
      return res.json({ review: review });
    }
  ),
];
const review_detail_put = [
  param("reviewId").escape(),
  body("rating", "Rating must be a range from 1 to 5.")
    .trim()
    .escape()
    .optional()
    .isInt({ min: 1, max: 5 }),
  body("reviewer_name", "The reviewer name cannot be empty.")
    .trim()
    .escape()
    .optional()
    .isLength({ min: 1 }),
  body("review_description", "The review description cannot be blank")
    .trim()
    .escape()
    .optional()
    .isLength({ min: 1 }),
  body("review_date", "Review date must be in the ISO8601 time format.")
    .trim()
    .escape()
    .optional()
    .isISO8601(),
  body(
    "review_edit_date",
    "Review edit date must be in the ISO8601 time format."
  )
    .trim()
    .escape()
    .default(new Date())
    .isISO8601(),
  body("product_id", "Product id must be a valid id.")
    .trim()
    .escape()
    .optional()
    .isMongoId(),
  asyncHandler(
    async (
      req: Request<{ reviewId: string }, {}, Partial<IReview>>,
      res: Response,
      next: NextFunction
    ) => {
      const reviewId = req.params.reviewId;
      if (Object.keys(req.body).length === 0) {
        return res
          .status(400)
          .json({ error: "No data was sent from the payload." });
      }
      if (!mongoose.isValidObjectId(reviewId)) {
        return next();
      }
      const error = validationResult(req);
      if (!error.isEmpty()) {
        return res.status(400).json({ error: error.array() });
      }
      const review = await Review.findById(reviewId);
      if (!review) {
        return next(); //404
      }
      if (req.body.product_id) {
        const product = await Product.findById(req.body.product_id);
        if (!product) {
          return res.status(400).json({
            error: "Product id is either invalid or is not a product.",
          });
        }
      }

      const updateReview = await Review.findByIdAndUpdate(reviewId, {
        _id: review._id,
        rating: req.body.rating || review.rating,
        reviewer_name: req.body.reviewer_name || review.reviewer_name,
        review_description:
          req.body.review_description || review.review_description,
        review_date: req.body.review_date || review.review_date,
        review_edit_date: req.body.review_edit_date,
        product_id: req.body.product_id || review.product_id,
      });
      if (!updateReview) {
        return res
          .status(400)
          .json({ error: `Error! Review: ${reviewId} could not be updated.` });
      }
      return res.sendStatus(200);
    }
  ),
];
const review_detail_delete = [
  param("reviewId").escape(),
  asyncHandler(
    async (
      req: Request<{ reviewId: string }>,
      res: Response,
      next: NextFunction
    ) => {
      const reviewId = req.params.reviewId;
      if (!mongoose.isValidObjectId(reviewId)) {
        return next();
      }
      const deleteReview = await Review.findByIdAndDelete(reviewId);
      if (!deleteReview) {
        return next();
      }
      return res.sendStatus(200);
    }
  ),
];

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
  productsByCategory_get,
};
