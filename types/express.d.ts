import { Request } from "express";
import { IShippingInfo } from "../models/OrderHistory";
import { IShippingAddress } from "../models/Customer";
import { Jwt, JwtPayload } from "jsonwebtoken";

// type UserPayload = {
//   id: string;
//   username: string;
//   user_code: 1 | 2 | 3 | 4;
//   is_admin: boolean;
//   email: string;
//   created_at: Date;
//   first_name: string;
//   last_name: string;
//   shipping_address: IShippingAddress;
// };
declare global {
  namespace Express {
    interface Request {
      user?: any; // Replace 'any' with your desired object type
    }
  }
}
