import { Response, Request, NextFunction } from "express";
import { validationResult, body, query, param } from "express-validator";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import "dotenv/config";
import Customer, { CartItemsType, ICustomer } from "../models/Customer";
import mongoose, { Document, Types } from "mongoose";
import Review from "../models/Review";
import Stripe from "stripe";
import Product from "../models/Product";
import OrderHistory from "../models/OrderHistory";
const stripe = new Stripe(process.env.STRIPE_SECRET || "");

export type PermitModels =
  | "Orders"
  | "Reviews"
  | "Customers"
  | "Categories"
  | "Products"
  | "Orders-GET";
//MIDDLEWARE TO VERIFY IF USER IS AUTHENTICATED
//First priority middleware that kicks any unauthorized users
const verify_Auth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.token;
  if (!token) {
    return res.sendStatus(401);
  }
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET ?? "");
    if (!user) {
      const error = new Error();
      error.message = "Invalid user";
      throw error;
    }
    req.user = user;
    next();
  } catch (error) {
    res.clearCookie("token");
    return res.sendStatus(401);
  }
};
//middleware that appends req.user if authenticated or next() if not (backend use only)
const safe_IsUserAuthenticated_mw = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies.token;
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET ?? "");
    if (!user) {
      const error = new Error();
      error.message = "Invalid user";
      throw error;
    }
    req.user = user;

    next();
  } catch (error) {
    next();
  }
};

//endpoint for frontend if neccesary
const isUserAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies.token;

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET ?? "");
    if (!user) {
      const error = new Error();
      error.message = "Invalid user";
      throw error;
    }
    req.user = user;

    return res.json({
      message: "You are authenticated!",
      isAuth: true,
      user: user,
    });
  } catch (error) {
    return res.json({ message: "You are not authenticated.", isAuth: false });
  }
};
const replaceSession = async (
  req: Request<{}, {}, { email: string; password: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    res.clearCookie("token");
    if (req.user) {
      const user = await Customer.findById(req?.user?.id);
      if (!user) {
        return res
          .status(401)
          .json({ email: "We didn't find this email. Try again." });
      }
      const userPayload = {
        id: user.id,
        username: user.username,
        user_code: user.user_code,
        is_admin: user.is_admin,
        email: user.email,
        created_at: user.created_at,
        first_name: user.first_name,
        last_name: user.last_name,
        shipping_address: user.shipping_address,
      };
      //create token:
      const token = jwt.sign(userPayload, process.env.JWT_SECRET || "", {
        expiresIn: "60m",
      });
      const ENVIRONMENT = process.env?.NODE_ENV;
      // console.log(ENVIRONMENT);

      // run code conditionally
      if (ENVIRONMENT === "development") {
        console.log("Dev cookies enabled");
        res.cookie("token", token, {
          httpOnly: true,
          // maxAge = how long the cookie is valid for in milliseconds
          // maxAge: 1000 * 60 * 10, // 10min,
          maxAge: 3600000, // 1hr,
        });
      } else {
        res.cookie("token", token, {
          httpOnly: true,
          // path = where the cookie is valid
          path: "/",
          // secure = only send cookie over https
          secure: true,
          // sameSite = only send cookie if the request is coming from the same origin
          sameSite: "none",
          maxAge: 3600000, // 1 hour
        });
      }
      return next();
    }
    return res.sendStatus(401);
  } catch (error) {
    return next(error);
  }
};
const login = async (
  req: Request<{}, {}, { email: string; password: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    // const cookieToken = req.cookies.token;
    // if (req.user) {
    //   console.log("user is already logged in");
    //   return res.sendStatus(200);
    // }
    //info given from request body
    const password = req.body.password;
    const email = req.body.email;

    //look for user in db/mock
    const user = await Customer.findOne({ email: email });
    if (!user) {
      return res
        .status(401)
        .json({ email: "We didn't find this email. Try again." });
    }

    //hash this req.body password and compare it to the password in db
    const comparedPass = await bcrypt.compare(password, user.password);

    if (!comparedPass) {
      return res.status(401).json({ password: "Password is incorrect." });
    }

    const userPayload = {
      id: user.id,
      username: user.username,
      user_code: user.user_code,
      is_admin: user.is_admin,
      email: user.email,
      created_at: user.created_at,
      first_name: user.first_name,
      last_name: user.last_name,
      shipping_address: user.shipping_address,
    };

    //create token:
    const token = jwt.sign(userPayload, process.env.JWT_SECRET || "", {
      expiresIn: "6h",
    });
    const ENVIRONMENT = process.env?.NODE_ENV;
    // console.log(ENVIRONMENT);

    // run code conditionally
    if (ENVIRONMENT === "development") {
      console.log("Dev cookies enabled");
      res.cookie("token", token, {
        httpOnly: true,
        // maxAge = how long the cookie is valid for in milliseconds
        // maxAge: 1000 * 60 * 10, // 10min,
        maxAge: 3600000 * 6, // 6hrs,
      });
    } else {
      res.cookie("token", token, {
        httpOnly: true,
        // path = where the cookie is valid
        path: "/",
        // secure = only send cookie over https
        secure: true,
        // sameSite = only send cookie if the request is coming from the same origin
        sameSite: "none",
        maxAge: 3600000 * 6, // 6 hour
      });
    }
    console.log("user is now logged in");
    return res.json({ user: userPayload });
  } catch (error) {
    next(error);
  }
};

const logout = [
  (req: Request, res: Response, next: NextFunction) => {
    try {
      res.clearCookie("token");
      return res.json({ message: "successfully logged out." });
    } catch (error) {
      next(error);
    }
  },
];

const auth_route_test = (req: Request, res: Response, next: NextFunction) => {
  return res.sendStatus(200);
};
//middleware for protected api endpoints
//To be used in conjunction with verify_Auth middleware
const permitAdminOnly = (req: Request, res: Response, next: NextFunction) => {
  //Only allows admin users to continue to next endpoint;
  //returns next() if is admin or 403 if not;
  if (req?.user?.is_admin) {
    return next();
  }
  return res.status(403).json({ message: "You are unauthorized." });
};
const permitUser = (model: PermitModels) => {
  //For http verbs: GET(details),PUT,DELETE
  //Allows admin users or authenticated user who owns the resource to continue to next endpoint;
  //returns 403 if user doesn't own the accessible resource;
  return async (
    req: Request<{ reviewId: string; customerId: string; orderId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const userId = req?.user?.id;

    if (req.user.is_admin) {
      return next();
    }
    switch (model) {
      case "Reviews": {
        // :reviewId [DELETE OR PUT]
        //check if its the user's own resource
        try {
          const userReview = await Review.findById(req.params.reviewId);
          if (!userReview) {
            return res.sendStatus(404);
          }

          if (userReview.reviewer.toString() === userId) {
            return next();
          } else {
            return res.status(403).json({
              message: "You are unauthorized to access this resource.",
            });
          }
        } catch (error) {
          return res.sendStatus(404);
        }
      }
      case "Customers": {
        try {
          // :customerId
          //check if its the user's own resource
          const customer = await Customer.findById(req.params.customerId);
          if (!customer) {
            return res.sendStatus(404);
          }

          if (customer.id === userId) {
            return next();
          } else {
            return res.status(403).json({
              message: "You are unauthorized to access this resource.",
            });
          }
        } catch (error) {
          return res.sendStatus(404);
        }
      }
      case "Orders": {
        ///orderhistory/customer/:customerId -> GET
        if (userId === req.params.customerId) {
          return next();
        }
        return res
          .status(403)
          .json({ message: "You are unauthorized to access this resource." });
      }
      case "Orders-GET": {
        //---/orderhistory/:orderId"
        const orderId = req.params.orderId;
        try {
          const order = await OrderHistory.findById(orderId);
          if (!order) {
            return res.status(404);
          }
          if (order.customer_id.toString() !== req.user.id) {
            return res.status(403).json({
              message: "You are unauthorized to access this resource.",
            });
          }
          return next();
        } catch (error) {
          return res.sendStatus(404);
        }
      }
      default: {
        return res
          .status(403)
          .json({ message: "Unknown model name. Restricted access." });
      }
    }
  };
};
const permitUserPost = (model: PermitModels) => {
  //For http verb: POST
  //POST logic is different from permitUsers logic
  //Allows admin users or authenticated user who owns the resource to continue to next endpoint;
  //returns 403 if user doesn't own the accessible resource;
  return async (
    req: Request<
      {},
      {},
      {
        paymentIntentId: string;
        customerId: string;
        cart: CartItemsType[];
        reviewer: string;
        product_id: string;
      }
    >,
    res: Response,
    next: NextFunction
  ) => {
    switch (model) {
      case "Orders": {
        try {
          const paymentIntentId = req.body.paymentIntentId;
          const reqCart = req.body.cart;

          const customerId = req.body.customerId;
          const customer = await Customer.findById(customerId);
          if (!customer) {
            return res
              .status(400)
              .json({ message: "Invalid customer id field in payload." });
          }
          if (reqCart.length <= 0) {
            return res
              .status(400)
              .json({ message: "Invalid cart field in payload." });
          }
          if (!paymentIntentId) {
            return res
              .status(400)
              .json({ message: "Missing payment id field in payload." });
          }

          //Get payment info
          const response = await stripe.paymentIntents.retrieve(
            paymentIntentId
          );
          if (!response) {
            return res.status(400).json({ error: "Payment id doesn't exist." });
          }
          //set shipping info from response(pi) to stripe customer
          // console.log("shipping info", response.shipping);

          const customerData = (
            await stripe.customers.search({
              query: `metadata['userId']:'${customerId}'`,
            })
          ).data;
          if (customerData.length > 0) {
            const stripeCustomer = customerData[0];
            if (response.shipping?.address) {
              const updatedCustomer = await stripe.customers.update(
                stripeCustomer.id,
                {
                  shipping: {
                    address: response.shipping
                      .address as Stripe.ShippingAddressParam,
                    name: response.shipping?.name as string,
                  },
                }
              );
              if (updatedCustomer) {
                console.log("updated customer shipping info");
              }
            }
          }

          //verify cart items with payment info metadata
          const cartProductIds =
            response.metadata.cartProductIdsAsStr.split(",");
          const reqCartProductIds = reqCart.map((item) => item._id);
          const isCartValid = reqCartProductIds.every(
            (productId) =>
              cartProductIds.includes(productId) &&
              cartProductIds.length === reqCartProductIds.length
          );
          if (!isCartValid) {
            return res
              .status(400)
              .json({ message: "Invalid. Cart items do not match." });
          }

          //protect against spam post requests
          const paymentCreated = response.created; //converting from unix epoch timestamp
          const paymentCreatedThreshold = paymentCreated + 10;
          const now = new Date().valueOf();
          if (now < paymentCreatedThreshold) {
            return res.status(403).json({ message: "Too early to re-order" });
          }

          const orderPayload = {
            order_date: new Date(),
            customer_id: customerId,
            cart_total: response.metadata.cartTotal,
            shipping: {
              code: response.metadata.shipping_code,
              cost: response.metadata.shipping,
            },
            cart: reqCart,
          };
          req.body = { ...req.body, ...orderPayload };
          return next();
        } catch (error) {
          return res.status(500).json({
            message: "An error occured while validating order history.",
          });
        }
      }
      case "Reviews": {
        // --/api/reviews
        const reviewer = req.body.reviewer;
        const productId = req.body.product_id;

        try {
          //verify if its users own review
          if (reviewer !== req.user.id) {
            return res.status(403).json({
              message: "You are unauthorized to access this resource.",
            });
          }

          //verify if product is in orderhistory (purchased)
          const orders = await OrderHistory.find({
            customer_id: new mongoose.Types.ObjectId(reviewer),
            "cart._id": productId,
          });
          if (orders.length <= 0) {
            return res.status(400).json({
              message:
                "Customer cannot write a review because they didn't purchase this product.",
            });
          }

          return next();
        } catch (error) {
          return res.status(400).json({ message: "Invalid payload data." });
        }
      }
      default: {
        return res
          .status(403)
          .json({ message: "Unknown model name. Restricted access." });
      }
    }
  };
};

export {
  login,
  logout,
  verify_Auth,
  auth_route_test,
  safe_IsUserAuthenticated_mw,
  isUserAuthenticated,
  permitAdminOnly,
  permitUser,
  permitUserPost,
  replaceSession,
};
