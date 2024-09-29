import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Category, { ICategory } from "../models/Category";
import Product, { IProduct, HighlightType } from "../models/Product";
import { validationResult, body, ValidationError } from "express-validator";
import Review, { IReview } from "../models/Review";
import { AggregateApi } from "../utils/AggregateApi";
import Customer, {
  CartItemZodSchema,
  ICustomer,
  ShippingAddress,
} from "../models/Customer";
import { z } from "zod";
import bcrypt from "bcrypt";

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
  reviews?: string;
};
const products_get = [
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
      const productReviews = new AggregateApi(Review.aggregate(), {
        ...req.query,
        fields: "rating,product_id",
      });

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

      if (req.query.reviews !== "false") {
        const reviewListQuery = allProducts.map((product) => {
          const idString: string = product._id.toString();
          return Object.assign(
            {},
            { product_id: new mongoose.Types.ObjectId(idString) }
          );
        });

        productReviews.aggregation.append({
          $match: {
            $or: [...reviewListQuery],
          },
        });
        productReviews.filter();

        productReviews.paginate();
      } else {
        //use placeholder data to append to the aggregation pipeline that will always return nothing from the db
        productReviews.aggregation.append({ $match: { _id: "100" } });
      }

      const cloneReviewAggregation = Object.create(productReviews.aggregation);
      const reviewsInfoClone = new AggregateApi(
        cloneReviewAggregation,
        req.query
      );
      reviewsInfoClone.aggregation.append({
        $group: {
          _id: "$product_id",
          rating_average: {
            $avg: {
              $round: ["$rating", 1],
            },
          },
          rating_highest: {
            $max: "$rating",
          },
          rating_lowest: {
            $min: "$rating",
          },
          rating_count: {
            $sum: 1,
          },
          review_ids: {
            $push: "$_id",
          },
        },
      });
      reviewsInfoClone.paginate();
      const reviewInfo = await reviewsInfoClone.aggregation;
      const reviews = await productReviews.aggregation;

      return res.json({
        records_count: productListCount,
        total_pages: Math.ceil(productListCount / pageLimit),
        list_count: allProducts.length,
        products: allProducts,
        // product_reviews: reviews,
        review_info: reviewInfo,
      });
    }
  ),
];
const productsByCategory_get = [
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

      const productReviews = new AggregateApi(Review.aggregate(), {
        ...req.query,
        fields: "rating,product_id",
      });
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

      if (req.query.reviews !== "false") {
        const reviewListQuery = allProducts.map((product) => {
          const idString: string = product._id.toString();
          return Object.assign(
            {},
            { product_id: new mongoose.Types.ObjectId(idString) }
          );
        });

        productReviews.aggregation.append({
          $match: {
            $or: [...reviewListQuery],
          },
        });
        productReviews.filter();

        productReviews.paginate();
      } else {
        //use placeholder data to append to the aggregation pipeline that will always return nothing from the db
        productReviews.aggregation.append({ $match: { _id: "100" } });
      }
      const cloneReviewAggregation = Object.create(productReviews.aggregation);
      const reviewsInfoClone = new AggregateApi(
        cloneReviewAggregation,
        req.query
      );
      reviewsInfoClone.aggregation.append({
        $group: {
          _id: "$product_id",
          rating_average: {
            $avg: {
              $round: ["$rating", 1],
            },
          },
          rating_highest: {
            $max: "$rating",
          },
          rating_lowest: {
            $min: "$rating",
          },
          rating_count: {
            $sum: 1,
          },
          review_ids: {
            $push: "$_id",
          },
        },
      });
      reviewsInfoClone.paginate();
      const reviewInfo = await reviewsInfoClone.aggregation;
      const reviews = await productReviews.aggregation;

      return res.json({
        records_count: productListCount,
        total_pages: Math.ceil(productListCount / pageLimit),
        list_count: allProducts.length,
        products: allProducts,
        review_info: reviewInfo,
      });
    }
  ),
];

const products_post = [
  body("name", "Provide the product name").trim().isLength({ min: 1 }),
  body("brand", "Provide the brand name").trim().isLength({ min: 1 }),
  body("price")
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
  body("description").trim().default(""),
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
  body(
    "quantity",
    "Quantity must be an integer number between 0 and 250."
  ).isInt({ min: 0, max: 250 }),
  body("category", "Categories must include correct category Ids.")
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
  body("total_bought", "Total bought must be a positive integer number.").isInt(
    { min: 0 }
  ),
  body("tags", "Tags must be in a correct list format.")
    .trim()
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
  body("image_src").trim().default(""),

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
  asyncHandler(
    async (
      req: Request<{ productId: string }>,
      res: Response,
      next: NextFunction
    ) => {
      const productIdParam = req.params.productId;

      //checks if parameter product id is in a correct format
      //return 404 status if not correct
      if (!mongoose.isValidObjectId(productIdParam)) {
        return next(); //404
      }
      const productObj = await Product.findById(productIdParam);
      if (!productObj) {
        return next();
      }
      const pipeline = Product.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(productIdParam),
          },
        },
      ]);
      pipeline.lookup({
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "category",
      });
      pipeline.append({
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

      const product = await pipeline;
      //product not found in db
      // const reviewPipeline = Review.aggregate([
      //   { $match: { product_id: new mongoose.Types.ObjectId(productIdParam) } },
      // ]);
      // const reviews = await reviewPipeline;

      return res.json({
        product: product,
        // reviews,
      });
    }
  ),
];
const product_detail_put = [
  body("name", "Provide the product name")
    .trim()
    .optional()
    .isLength({ min: 1 }),
  body("brand", "Provide the brand name")
    .trim()
    .optional()
    .isLength({ min: 1 }),
  body("price", "Price must be between 0.01 and 100000")
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
    .optional()
    // .custom((value) => {
    //   if (Number(value) >= 0.01) {
    //     return true;
    //   } else {
    //     throw new Error("Retail price must be greater than or equal to 0.01.");
    //   }
    // })
    .isFloat({ min: 0.01, max: 100000 }),
  body("description").trim().optional(),
  body("highlights", "The highlights field must be in the correct format.")
    .trim()
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
    .optional()
    .isInt({ gt: 0, lt: 251 }),
  body("category", "Categories must include correct category Ids.")
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
    .optional()
    .isInt({ min: 0 }),
  body("tags", "Tags must be in a correct list format.")
    .trim()
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
  body("name", "Provide a category name.").trim().isLength({ min: 1 }),
  body("alias").trim().default(""),

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
  asyncHandler(
    async (
      req: Request<{ categoryId: string }>,
      res: Response,
      next: NextFunction
    ) => {
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
    }
  ),
];
const category_detail_put = [
  body("name").trim().optional().isLength({ min: 1 }),
  body("alias").trim().optional(),
  asyncHandler(
    async (
      req: Request<{ categoryId: string }, {}, Partial<ICategory>>,
      res: Response,
      next: NextFunction
    ) => {
      const categoryId = req.params.categoryId;

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
    .isInt({ min: 1, max: 5 }),
  body("reviewer_name", "The reviewer name cannot be empty.")
    .trim()
    .isLength({ min: 1 }),
  body("review_description", "The review description cannot be blank")
    .trim()
    .isLength({ min: 1 }),
  body("review_date", "Review date must be in the ISO8601 time format.")
    .trim()
    .default(new Date())
    .isISO8601(),
  body(
    "review_edit_date",
    "Review edit date must be in the ISO8601 time format."
  )
    .trim()
    .optional()
    .isISO8601(),
  body("product_id", "Product id must be a valid id.")
    .trim()
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
const reviewsByProduct_get = [
  asyncHandler(
    async (req: Request<{ productId: string }>, res: Response, next) => {
      const productId = req.params.productId;

      if (!mongoose.isValidObjectId(productId)) {
        return next(); //404
      }
      const product = await Product.findById(productId);
      if (!product) {
        return next();
      }
      let reviewListCount: number;
      let reviewsApi = new AggregateApi(
        Review.aggregate([
          { $match: { product_id: new mongoose.Types.ObjectId(productId) } },
        ]),
        req.query
      );

      if (req.query.populate === "true") {
        reviewsApi.populate("products", "product_id", "_id", "product_id");
      }

      reviewsApi.filter();

      const clone = new AggregateApi(reviewsApi.aggregation, req.query);
      const reviewInfoClone = Object.create(clone.aggregation);
      reviewInfoClone.append({
        $group: {
          _id: null,
          rating_average: {
            $avg: {
              $round: ["$rating", 1],
            },
          },
          rating_highest: {
            $max: "$rating",
          },
          rating_lowest: {
            $min: "$rating",
          },
          rating_count: {
            $sum: 1,
          },
        },
      });
      reviewInfoClone.project("-_id");

      reviewListCount = (await clone.aggregation).length;
      const rating_info = await reviewInfoClone;

      //PAGINATE
      reviewsApi.sort().paginate();
      const { pageSkip, pageLimit, pageNum } = reviewsApi.pageInfo();

      if (req.query.page) {
        if (pageNum > 1 && pageSkip >= reviewListCount) {
          return next(); //res 404 - not found
        }
      }
      const allReviews = await reviewsApi.aggregation;
      return res.json({
        records_count: reviewListCount,
        total_pages: Math.ceil(reviewListCount / pageLimit),
        list_count: allReviews.length,
        rating_info,
        reviews: allReviews,
      });
    }
  ),
];

const review_detail_get = [
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
  body("rating", "Rating must be a range from 1 to 5.")
    .trim()
    .optional()
    .isInt({ min: 1, max: 5 }),
  body("reviewer_name", "The reviewer name cannot be empty.")
    .trim()
    .optional()
    .isLength({ min: 1 }),
  body("review_description", "The review description cannot be blank")
    .trim()
    .optional()
    .isLength({ min: 1 }),
  body("review_date", "Review date must be in the ISO8601 time format.")
    .trim()
    .optional()
    .isISO8601(),
  body(
    "review_edit_date",
    "Review edit date must be in the ISO8601 time format."
  )
    .trim()
    .default(new Date())
    .isISO8601(),
  body("product_id", "Product id must be a valid id.")
    .trim()
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

const customer_list = asyncHandler(
  async (
    req: Request<{}, {}, ICustomer, searchParameters>,
    res: Response,
    next
  ) => {
    const customerApi = new AggregateApi(
      Customer.aggregate([{ $match: {} }]),
      req.query
    );

    if (req.user?.is_admin) {
      //if not authenticated admin, you will not see password or shipping address of other users.
      const passField = new RegExp(/password/, "i");
      req.query.fields = req.query.fields
        ?.split(",")
        .filter((field) => !passField.test(field))
        .join(",");
      const LimitedCustomerKeys =
        "_id,username,email,created_at,first_name,last_name,is_admin,user_code,order_history";
      req.query.fields = req.query.fields?.split(",")?.length
        ? req.query.fields
        : LimitedCustomerKeys;
    }

    customerApi.filter().sort("username").paginate();

    const clone = new AggregateApi(customerApi.aggregation, req.query);

    const customerListCount = (await clone.aggregation).length;
    const { pageLimit, pageSkip, pageNum } = customerApi.pageInfo();
    if (req.query.page) {
      if (pageNum > 1 && pageSkip >= customerListCount) {
        return next(); //res 404 - not found
      }
    }

    const allCustomers = await customerApi.aggregation;

    return res.json({
      records_count: customerListCount,
      total_pages: Math.ceil(customerListCount / pageLimit),
      list_count: allCustomers.length,
      customers: allCustomers,
    });
  }
);
const customer_detail = asyncHandler(
  async (req: Request<{ customerId: string }>, res: Response, next) => {
    const customerId = req.params.customerId;
    if (!mongoose.isValidObjectId(customerId)) {
      return next();
    }
    const customer = await Customer.findById(customerId, { __v: 0 });
    if (!customer) {
      return next();
    }
    if (!req.user?.is_admin) {
      //non admin users see limted keys values of other customers
      const { password, shipping_address, ...limitedCustomerObj } =
        customer.toJSON();
      return res.json({ customer: limitedCustomerObj });
    } else {
      return res.json({ customer });
    }
  }
);
const customer_detail_delete = asyncHandler(
  async (req: Request<{ customerId: string }>, res: Response, next) => {
    const customerId = req.params.customerId;
    if (!mongoose.isValidObjectId(customerId)) {
      return next();
    }
    const customerToBeDeleted = await Customer.findByIdAndDelete(customerId);
    if (!customerToBeDeleted) {
      return next();
    }
    return res.sendStatus(200);
  }
);
const customer_create = [
  body("username", "Username must be between 3 to 16 characters long.")
    .trim()
    .isLength({ min: 3, max: 16 })
    .custom(async (user) => {
      const existingUser = await Customer.findOne({ username: user });
      if (existingUser) {
        throw new Error("Username already exists.");
      } else {
        return true;
      }
    }),
  body(
    "email",
    "Email must be in a valid email format. (e.g. name@example.com)"
  )
    .trim()
    .isEmail()
    .isLength({ min: 4 })
    .custom(async (email) => {
      const existingEmail = await Customer.findOne({ email });
      if (existingEmail) {
        throw new Error("Email already exists.");
      }
    }),
  body("password", "Password must be at least 5 characters long.")
    .trim()
    .isLength({ min: 5 }),
  body("created_at", "Creation date is not in a valid time format.")
    .optional()
    .isISO8601(),
  body("first_name", "First Name must be at least 2 characters long.")
    .trim()
    .isLength({ min: 2 }),
  body("last_name", "Last Name must be at least 2 characters long.")
    .trim()
    .isLength({ min: 1 }),
  body("is_admin", "isAdmin must be a boolean value.")
    .default(false)
    .isBoolean(),
  body(
    "user_code",
    "userCode must be a valid integer and and active user code."
  )
    .default(1)
    .custom((v) => {
      const acceptedValues = [1, 2, 3, 4] as const;
      if (acceptedValues.includes(v)) {
        return true;
      }
      return false;
    }),
  body("shipping_address", "Shipping address is in an invalid format.")
    .optional({ values: "null" })
    .isObject()
    .custom((data) => {
      const keys = Object.keys(data);
      if (keys.length <= 0) {
        throw new Error(
          "Shipping address object must be either null or contain the required key values."
        );
      }
      if (!keys.includes("name") || !keys.includes("address")) {
        throw new Error(
          "Shipping address must contain the name and address sub fields."
        );
      }
      if (keys.length === 3 && !keys.includes("phone")) {
        throw new Error("Shipping address has invalid sub fields.");
      }
      return true;
    }),
  body(
    "shipping_address.name",
    "Shipping Name must be at least 3 characters long."
  )
    .trim()
    .optional()
    .isLength({ min: 3 }),
  body("shipping_address.phone", "Invalid shipping phone number")
    .trim()
    .optional()
    .isMobilePhone("en-US"),
  body("shipping_address.address", "Shipping Address must be an object.")
    .optional()
    .isObject()
    .custom((data) => {
      const result = ShippingAddress.safeParse(data);
      if (result.success) {
        return true;
      }
      throw result.error.errors;
    }),
  body(
    "shipping_address.address.postal_code",
    "Shipping Address's postal code is invalid."
  )
    .trim()
    .optional()
    .isPostalCode("US"),
  body("order_history", "Order history is in an invalid format.")
    .optional({ values: "null" })
    .isObject()
    .custom((data) => {
      const keys = Object.keys(data);
      if (keys.length <= 0) {
        throw new Error(
          "Order history must be either null or contain the required key values."
        );
      }
      if (!keys.includes("order_date") || !keys.includes("cart")) {
        throw new Error(
          "Order history must contain the order_date and cart sub fields."
        );
      }
      if (keys.length !== 2) {
        throw new Error("Order history has invalid sub fields.");
      }
      return true;
    }),
  body(
    "order_history.order_date",
    "Order date must be in a ISO8601 date format."
  )
    .optional()
    .isISO8601(),
  body(
    "order_history.cart",
    "Order history cart list must have at least one item."
  )
    .optional()
    .isArray({ min: 1 })
    .custom((cartData) => {
      const new_s = z.array(CartItemZodSchema, {
        message: "Order history cart list must have at least one item.",
      });
      const result = new_s.safeParse(cartData);
      if (result.success) {
        return true;
      } else {
        throw result.error.errors;
      }
    }),
  body("order_history.cart.*._id", "item id is invalid.")
    .exists({ values: "falsy" })
    .isMongoId(),
  body("order_history.cart.*.category.*._id", "category id is invalid.")
    .exists({ values: "falsy" })
    .isMongoId(),

  asyncHandler(async (req: Request<{}, {}, ICustomer>, res: Response, next) => {
    /** SIGNUP FORM WILL CHECK FOR DUPLICATE EMAILS AND USERNAMES */
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const oneError = errors.array()[0] as ValidationError & { path: string };
      return res.status(400).json({
        error: errors.array(),
        single_error: { [oneError.path]: oneError.msg },
      });
    }
    if (!req.body.created_at) {
      req.body.created_at = new Date();
    }
    if (!req.body.shipping_address) {
      req.body.shipping_address = null;
    }
    if (!req.body.order_history) {
      req.body.order_history = null;
    }
    const hashedPass = await bcrypt.hash(req.body.password, 10);

    const customer = new Customer({
      username: req.body.username,
      email: req.body.email,
      password: hashedPass,
      created_at: req.body.created_at,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      is_admin: req.body.is_admin,
      user_code: req.body.user_code,
      shipping_address: req.body.shipping_address,
      order_history: req.body.order_history,
    });
    await customer.save();

    //create Customer object will fields filled in and save()
    return res.json({
      "saved customer": customer,
    });
  }),
];

const customer_detail_put = [
  body("username", "Username must be between 3 to 16 characters long.")
    .trim()
    .optional()
    .isLength({ min: 3, max: 16 })
    .custom(async (user) => {
      const existingUser = await Customer.findOne({ username: user });
      if (existingUser) {
        throw new Error("Username already exists.");
      } else {
        return true;
      }
    }),
  body(
    "email",
    "Email must be in a valid email format. (e.g. name@example.com)"
  )
    .trim()
    .optional()
    .isEmail()
    .isLength({ min: 4 })
    .custom(async (email) => {
      const existingEmail = await Customer.findOne({ email });
      if (existingEmail) {
        throw new Error("Email already exists.");
      }
    }),
  body("password", "Password must be at least 5 characters long.")
    .trim()
    .optional()
    .isLength({ min: 5 }),
  body("created_at", "Creation date is not in a valid time format.")
    .optional()
    .isISO8601(),
  body("first_name", "First Name must be at least 2 characters long.")
    .trim()
    .optional()
    .isLength({ min: 2 }),
  body("last_name", "Last Name must be at least 2 characters long.")
    .trim()
    .optional()
    .isLength({ min: 1 }),
  body("is_admin", "isAdmin must be a boolean value.")
    .optional()
    .default(false)
    .isBoolean(),
  body(
    "user_code",
    "userCode must be a valid integer and and active user code."
  )
    .optional()
    .default(1)
    .custom((v) => {
      const acceptedValues = [1, 2, 3, 4] as const;
      if (acceptedValues.includes(v)) {
        return true;
      }
      return false;
    }),
  body(
    "shipping_address",
    "Shipping address is in an invalid format. Must be an object."
  )
    .optional({ values: "null" })
    .isObject()
    .custom((data) => {
      const keys = Object.keys(data);
      if (keys.length <= 0) {
        throw new Error(
          "Shipping address object must be either null or contain the required key fields [address,name]."
        );
      }
      if (!keys.includes("name") || !keys.includes("address")) {
        throw new Error(
          "Shipping address must contain the name and address sub fields."
        );
      }
      if (keys.length === 3 && !keys.includes("phone")) {
        throw new Error("Shipping address has invalid sub fields.");
      }
      return true;
    }),
  body(
    "shipping_address.name",
    "Shipping Name must be at least 3 characters long."
  )
    .trim()
    .optional()
    .isLength({ min: 3 }),
  body("shipping_address.phone", "Invalid shipping phone number")
    .trim()
    .optional()
    .isMobilePhone("en-US"),
  body("shipping_address.address", "Shipping Address must be an object.")
    .optional()
    .isObject()
    .custom((data) => {
      const result = ShippingAddress.safeParse(data);
      if (result.success) {
        return true;
      }
      throw result.error.errors;
    }),
  body(
    "shipping_address.address.postal_code",
    "Shipping Address's postal code is invalid."
  )
    .trim()
    .optional()
    .isPostalCode("US"),
  body(
    "order_history",
    "Order history is in an invalid format. Must be an object."
  )
    .optional({ values: "null" })
    .isObject()
    .custom((data) => {
      const keys = Object.keys(data);
      if (keys.length <= 0) {
        throw new Error(
          "Order history must be either null or contain the required key fields: [order_date,cart]."
        );
      }
      if (!keys.includes("order_date") || !keys.includes("cart")) {
        throw new Error(
          "Order history must contain the order_date and cart sub fields."
        );
      }
      if (keys.length !== 2) {
        throw new Error("Order history has invalid sub fields.");
      }
      return true;
    }),
  body(
    "order_history.order_date",
    "Order date must be in a ISO8601 date format."
  )
    .optional()
    .isISO8601(),
  body(
    "order_history.cart",
    "Order history cart list must have at least one item."
  )
    .optional()
    .isArray({ min: 1 })
    .custom((cartData) => {
      const new_s = z.array(CartItemZodSchema, {
        message: "Order history cart list must have at least one item.",
      });
      const result = new_s.safeParse(cartData);
      if (result.success) {
        return true;
      } else {
        throw result.error.errors;
      }
    }),
  body("order_history.cart.*._id", "item id is invalid.")
    .optional()
    .exists({ values: "falsy" })
    .isMongoId(),
  body("order_history.cart.*.category.*._id", "category id is invalid.")
    .optional()
    .exists({ values: "falsy" })
    .isMongoId(),

  asyncHandler(
    async (
      req: Request<{ customerId: string }, {}, Partial<ICustomer>>,
      res: Response,
      next
    ) => {
      const customerId = req.params.customerId;
      if (!mongoose.isValidObjectId(customerId)) {
        return next();
      }
      if (!req.user?.is_admin) {
        //filters out people who are not admin (or later -> the currently logged in user)
        return res.sendStatus(403);
      }
      if (Object.keys(req.body).length === 0) {
        return res
          .status(400)
          .json({ error: "No data was sent from the payload." });
      }
      const error = validationResult(req);
      if (!error.isEmpty()) {
        return res.status(400).json({ error: error.array() });
      }
      //verify that the customer to update exists in the db
      let customer = await Customer.findById(customerId);
      if (!customer) {
        return next(); //404
      }
      customer = customer.toJSON();
      const hashedPass = req.body.password
        ? await bcrypt.hash(req.body.password, 10)
        : null;

      // const testEdit = new Customer({
      //   _id: customer._id,
      //   username: req.body.username || customer.username,
      //   email: req.body.email || customer.email,
      //   password: hashedPass || customer.password,
      //   created_at: req.body.created_at || customer.created_at,
      //   first_name: req.body.first_name || customer.first_name,
      //   last_name: req.body.last_name || customer.last_name,
      //   is_admin: req.body.is_admin || customer.is_admin,
      //   user_code: req.body.user_code || customer.user_code,
      //   shipping_address:
      //     req.body.shipping_address || customer.shipping_address,
      //   order_history: req.body.order_history || customer.order_history,
      // });
      const updateCustomer = await Customer.findByIdAndUpdate(customerId, {
        _id: customer._id,
        username: req.body.username || customer.username,
        email: req.body.email || customer.email,
        password: hashedPass || customer.password,
        created_at: req.body.created_at || customer.created_at,
        first_name: req.body.first_name || customer.first_name,
        last_name: req.body.last_name || customer.last_name,
        is_admin: req.body.is_admin || customer.is_admin,
        user_code: req.body.user_code || customer.user_code,
        shipping_address:
          req.body.shipping_address || customer.shipping_address,
        order_history: req.body.order_history || customer.order_history,
      });

      if (!updateCustomer) {
        return res.status(400).json({
          error: `Error! Review: ${customerId} could not be updated.`,
        });
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
  reviewsByProduct_get,
  customer_list,
  customer_create,
  customer_detail,
  customer_detail_delete,
  customer_detail_put,
};
