import { Response, Request, NextFunction } from "express";
import { validationResult, body, query, param } from "express-validator";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import "dotenv/config";
import Customer, { ICustomer } from "../models/Customer";
import mongoose, { Document, Types } from "mongoose";
import Review from "../models/Review";

export type PermitModels =
  | "Orders"
  | "Reviews"
  | "Customers"
  | "Categories"
  | "Products";
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
const login = async (
  req: Request<{}, {}, { email: string; password: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    // const cookieToken = req.cookies.token;
    if (req.user) {
      console.log("user is already logged in");
      return res.sendStatus(200);
    }
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
      expiresIn: "15m",
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
        maxAge: 1000 * 60 * 15, // 15m,
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
  return res.status(403).json("message: You are unauthorized.");
};
const permitUser = (model: PermitModels) => {
  //For http verbs: GET(details),PUT,DELETE
  //Allows admin users or authenticated user who owns the resource to continue to next endpoint;
  //returns 403 if user doesn't own the accessible resource;
  return async (
    req: Request<{ reviewId: string; customerId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const userId = req?.user?.id;
    console.log(userId);
    if (req.user.is_admin) {
      return next();
    }
    switch (model) {
      case "Reviews": {
        // :reviewId [DELETE OR PUT]
        //check if its the user's own resource
        const userReview = await Review.findById(req.params.reviewId);
        if (!userReview) {
          return res.sendStatus(404);
        }

        if (userReview.reviewer.toString() === userId) {
          return next();
        } else {
          return res
            .status(403)
            .json({ message: "You are unauthorized to access this resource." });
        }
      }
      case "Customers": {
        // :customerId
        //check if its the user's own resource
        const customer = await Customer.findById(req.params.customerId);
        if (!customer) {
          return res.sendStatus(404);
        }

        if (customer.id === userId) {
          return next();
        } else {
          return res
            .status(403)
            .json({ message: "You are unauthorized to access this resource." });
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
const permitUserPost = () => {
  //For http verb: POST
  //POST logic is different from permitUsers logic
  //Allows admin users or authenticated user who owns the resource to continue to next endpoint;
  //returns 403 if user doesn't own the accessible resource;
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
};
