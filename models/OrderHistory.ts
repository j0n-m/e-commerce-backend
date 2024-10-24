import mongoose, { Types } from "mongoose";
import { CartItemsType, CartItemZodSchema } from "./Customer";

const Schema = mongoose.Schema;

export type IShippingInfo = {
  code: 1 | 2 | 3;
  cost: number;
};
export type IOrderHistory = {
  customer_id: mongoose.Types.ObjectId;
  order_date: Date;
  shipping: IShippingInfo;
  cart_total: number;
  cart: CartItemsType[];
};

const orderHistorySchema = new Schema<IOrderHistory>({
  customer_id: {
    type: Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  order_date: {
    type: Date,
    required: true,
  },
  cart_total: {
    type: Number,
    required: true,
  },
  shipping: {
    code: {
      type: Number,
      min: 1,
      max: 3,
      required: true,
    },
    cost: {
      type: Number,
      required: true,
    },
  },
  cart: [
    {
      _id: { type: Schema.ObjectId, ref: "Product", required: true },
      name: {
        type: String,
        minlength: 2,
      },
      brand: String,
      price: Number,
      retail_price: Number,
      quantity: Number,
      cart_quantity: Number,
      category: [
        {
          alias: String,
          _id: String,
          name: String,
        },
      ],
      image_src: String,
      discount: Number,
    },
  ],
});

export default mongoose.model("OrderHistory", orderHistorySchema);
