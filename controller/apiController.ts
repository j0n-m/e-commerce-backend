import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Category, { ICategory } from "../models/Category";
import Product, { IProduct, HighlightType } from "../models/Product";
import { validationResult, body } from "express-validator";
import Review, { IReview } from "../models/Review";

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

    const SKIP_MAX = 40;
    const LIMIT_MAX = 40;
    const DEFAULT_LIMIT = 20;

    const allProducts = await Product.find({
      $or: [{ name: search_f }, { brand: search_f }, { tags: search_f }],
    })
      .limit(limit_f > 0 && limit_f <= LIMIT_MAX ? limit_f : DEFAULT_LIMIT)
      .skip(skip_f > 0 && skip_f <= SKIP_MAX ? skip_f : 0)
      .populate("category");

    return res.json({ search_count: allProducts.length, data: allProducts });
  }
);
const products_post = [
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
      if (categories.length === 0) {
        throw new Error("A minimum of one categories must be set.");
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

  asyncHandler(
    (req: Request<{}, {}, IProduct>, res: Response, next: NextFunction) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.json({ error: errors.array() });
      }
      return res.sendStatus(204);
    }
  ),
];

const product_detail_get = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const productIdParam = encodeURI(req.params.productId);

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

    return res.json({ data: product });
  }
);
const product_detail_put = [
  //assumming the update product page is auto-filled with the values that is in the DB
  //PUT-only applies changes in the body to the existing resource
  (
    req: Request<{}, {}, Partial<IProduct>>,
    res: Response,
    next: NextFunction
  ) => {
    //check if only IProduct properties are in req.body, reject if there are unknown values
    const product = new Product({});
    for (const prop in req.body) {
      if (prop === "_id" || !(prop in product)) {
        return res
          .status(400)
          .json({ message: `Invalid property '${prop}' in PUT request body.` });
      }
    }
    next();
  },
  body("name", "Provide the product name")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .optional(),
  body("brand", "Provide the brand name")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .optional(),
  body("price")
    .escape()
    .custom((value) => {
      if (Number(value) >= 0.01) {
        return true;
      } else {
        throw new Error("Price must be greater than or equal to 0.01.");
      }
    })
    .optional(),
  body("retail_price")
    .escape()
    .custom((value) => {
      if (Number(value) >= 0.01) {
        return true;
      } else {
        throw new Error("Retail price must be greater than or equal to 0.01.");
      }
    })
    .optional(),
  body("description").trim().escape().optional(),
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
    .optional()
    .isInt({ gt: 0, lt: 251 }),
  body("category", "Categories must include correct category Ids.")
    .escape()
    .custom(async (categories: string[] | mongoose.Types.ObjectId[]) => {
      console.log("category", categories);
      if (!Array.isArray(categories)) {
        throw new Error("Invalid format for the value.");
      }
      if (categories.length === 0) {
        throw new Error("A minimum of one categories must be set.");
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
    })
    .optional(),
  body("total_bought", "Total bought must be a positive integer number.")
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
    .isURL()
    .optional(),
  asyncHandler(
    async (
      req: Request<{ productId: string }, {}, IProduct>,
      res: Response,
      next: NextFunction
    ) => {
      const productId: string = encodeURI(req.params.productId);

      if (!mongoose.isValidObjectId(productId)) {
        return next();
      }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.json({ errors: errors.array() });
      }
      const product = await Product.findById(productId);

      if (!product) {
        return next();
      }
      const updatedProduct = await Product.findByIdAndUpdate(product._id, {
        name: req.body.name ?? product.name,
        brand: req.body.brand ?? product.brand,
        price: req.body.price ?? product.price,
        retail_price: req.body.retail_price ?? product.retail_price,
        description: req.body.description ?? product.description,
        highlights: req.body.highlights ?? product.highlights,
        quantity: req.body.quantity ?? product.quantity,
        category: req.body.category ?? product.category,
        total_bought: req.body.total_bought ?? product.total_bought,
        tags: req.body.tags ?? product.tags,
        image_src: req.body.image_src ?? product.image_src,
      });

      return res.sendStatus(204);
    }
  ),
];
const product_detail_delete = asyncHandler(
  async (
    req: Request<{ productId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const productId: string = encodeURI(req.params.productId);
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
);

const categories_get = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const limit_f = Number(req.query.limit);

    const allCategories = await Category.find({}, { name: 1 })
      .limit(limit_f > 0 && limit_f <= 25 ? limit_f : 10)
      .sort({ name: "ascending" });
    return res.json({
      categoryCount: allCategories.length,
      data: allCategories,
    });
  }
);
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
        console.log("found duplicate category name", name);
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
    //Temporarily comment out
    await category.save();
    console.log("Added category->", category.name);
    return res.sendStatus(201);
  }),
];

const category_detail_get = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const categoryId = encodeURI(req.params.categoryId);
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
const category_detail_put = [
  (
    req: Request<{}, {}, Partial<ICategory>>,
    res: Response,
    next: NextFunction
  ) => {
    const category = new Category({});
    for (const prop in req.body) {
      if (prop === "_id" || !(prop in category)) {
        return res
          .status(400)
          .json({ message: "Invalid property in PUT request." });
      }
    }
    next();
  },
  body("name").trim().isLength({ min: 1 }).optional(),
  body("alias").trim().isLength({ min: 1 }).optional(),
  asyncHandler(
    async (
      req: Request<{ categoryId: string }, {}, ICategory>,
      res: Response,
      next: NextFunction
    ) => {
      const categoryId = encodeURI(req.params.categoryId);
      if (!mongoose.isValidObjectId(categoryId)) {
        return next(); //404
      }
      const categoryToUpdate = await Category.findByIdAndUpdate(
        categoryId,
        req.body
      );
      if (!categoryToUpdate) {
        return next();
      }
      return res.sendStatus(204);
    }
  ),
];
const category_detail_delete = asyncHandler(
  async (
    req: Request<{ categoryId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const categoryId = encodeURI(req.params.categoryId);

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
      { category: category.id },
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
);

const reviews_get = asyncHandler(
  async (
    req: Request<{}, {}, {}, { search: string; skip: string; limit: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const SKIP_MAX = 40;
    const LIMIT_MAX = 40;
    const DEFAULT_LIMIT = 20;
    const DEFAULT_SKIP = 0;

    //req.query.review?
    const search = req.query.search ? encodeURI(req.query.search) : undefined;
    const limit = Number.parseInt(encodeURI(req.query.limit)) ?? DEFAULT_LIMIT;
    const skip = Number.parseInt(encodeURI(req.query.skip)) ?? DEFAULT_SKIP;

    const allReviews = await Review.find(
      typeof search === "undefined"
        ? {}
        : {
            $or: [{ reviewer_name: search }, { review_description: search }],
          }
    )
      .populate("product_id")
      .limit(limit > 0 && limit < LIMIT_MAX ? limit : DEFAULT_LIMIT)
      .skip(skip > 0 && skip < SKIP_MAX ? skip : DEFAULT_SKIP)
      .sort({ review_date: "desc" });
    return res.json({ search_count: allReviews.length, data: allReviews });
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
      const productId = encodeURI(id);
      if (!mongoose.isValidObjectId(productId)) {
        throw new Error("Product id is not valid.");
      }
      const isValidProduct = await Product.findById(productId);
      if (isValidProduct) {
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
        review_edit_date: req.body?.review_edit_date,
        product_id: req.body.product_id,
      });
      await review.save();
      return res.sendStatus(204);
    }
  ),
];

const review_detail_get = asyncHandler(
  async (
    req: Request<{ reviewId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    // /review/:reviewId
    const reviewId = encodeURI(req.params.reviewId);
    if (!mongoose.isValidObjectId(reviewId)) {
      return next();
    }

    const review = await Review.findById(reviewId).populate("product_id");
    if (!review) {
      //if id is not active in the db, return 404 status.
      return next();
    }
    return res.json({ data: review });
  }
);
const review_detail_put = [
  (
    req: Request<{ reviewId: string }, {}, Partial<IReview>>,
    res: Response,
    next: NextFunction
  ) => {
    const reviewTemplate = new Review({});
    for (const prop in req.body) {
      if (prop === "_id" || !(prop in reviewTemplate)) {
        return res
          .status(400)
          .json({ error: "Invalid property in the body of the PUT request." });
      }
    }
    next();
  },
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
    .optional()
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
      const reviewId = encodeURI(req.params.reviewId);
      if (!mongoose.isValidObjectId(reviewId)) {
        return next();
      }
      const error = validationResult(req);
      if (!error.isEmpty()) {
        return res
          .status(400)
          .json({ error: error.array(), temp_data: req.body });
      }
      const reviewToUpdate = await Review.findByIdAndUpdate(reviewId, req.body);
      if (!reviewToUpdate) {
        return res
          .status(400)
          .json({ error: `Review: ${reviewId} was not found.` });
      }
      return res.sendStatus(200);
    }
  ),
];
const review_detail_delete = asyncHandler(
  async (
    req: Request<{ reviewId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const reviewId = encodeURI(req.params.reviewId);
    if (!mongoose.isValidObjectId(reviewId)) {
      return next();
    }
    const deleteReview = await Review.findByIdAndDelete(reviewId);
    if (!deleteReview) {
      return next();
    }
    return res.sendStatus(200);
  }
);

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
