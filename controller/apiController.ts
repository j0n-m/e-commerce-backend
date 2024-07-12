import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Category, { ICategory } from "../models/Category";
import Product, { IProduct, HighlightType } from "../models/Product";
import { validationResult, body } from "express-validator";

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
      .skip(skip_f > 0 && skip_f <= SKIP_MAX ? skip_f : 0);

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
      return res.json({
        message: "OK.",
        data: req.body,
        error: errors.array(),
      });
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
    const product = await Product.findById(productIdParam);

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
      if (!(prop in product)) {
        return res
          .status(400)
          .json({ message: "Invalid property in PUT request." });
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
      await Product.findByIdAndUpdate(product._id, req.body).exec();

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
    const productToDelete = await Product.findByIdAndDelete(productId);
    console.log("deleted", productToDelete);
    if (!productToDelete) {
      return next();
    } else {
      return res.sendStatus(200);
    }
  }
);

const categories_get = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const limit_f = Number(req.query.limit);

    const allCategories = await Category.find({}, { _id: 0, name: 1 })
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
    // await category.save();
    console.log("Needing to save category->", category.name);
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
      if (!(prop in category)) {
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
