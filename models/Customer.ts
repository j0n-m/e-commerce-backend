import mongoose, { Types } from "mongoose";
const Schema = mongoose.Schema;
import { z } from "zod";
/*
const userTest = {
  _id: "testid",
  username: "jon",
  email: "test@gmail.com",
  password: "testing",
  createdAt: new Date(),
  firstName: "Jon",
  lastName: "Mon",
  shipping_address: {
    field: "any address",
  },
  past_orders: [{ cartItems: "cart items", order_created: "some date" }],
};

*/
const COUNTRY_VALUES = z.enum(["US", "CA"], {
  message: "Shipping address country must be either 'US' or 'CA'",
});

export const ShippingAddress = z.object({
  line1: z
    .string({ message: "Shipping address line 1 must be provided." })
    .min(2),
  line2: z.string().optional(),
  city: z.string({ message: "Shipping address city must be provided." }).min(2),
  state: z
    .string({
      message: "Shipping address state must be at least 2 characters long.",
    })
    .min(2),
  postal_code: z
    .string({ message: "Shipping postal code must be provided." })
    .min(1),
  country: COUNTRY_VALUES,
});

export const addressSchema = z.object({
  name: z.string(),
  phone: z.string().optional(),
  address: ShippingAddress,
});

export const CartItemZodSchema = z.object({
  _id: z.string(),
  name: z
    .string({ message: "Item name must be atleast 2 characters long." })
    .min(2),
  brand: z
    .string({ message: "Item brand must be atleast 2 characters long." })
    .min(2),
  price: z.number({ message: "Price must be numeric." }),
  retail_price: z.number({ message: "Retail must be numeric." }),
  quantity: z.number({ message: "Quantity must be an integer value." }).int(),
  cart_quantity: z
    .number({ message: "Cart_quantity must be an integer value." })
    .int(),
  category: z
    .array(
      z.object({
        alias: z.string().optional(),
        _id: z.string({ message: "Cart category id must be valid." }),
        name: z
          .string({
            message: "Cart category name must be atleast 2 characters long",
          })
          .min(2),
      })
    )
    .min(1, "Cart item's category must have at least one category object."),
  image_src: z.string().optional(),
  discount: z.number().optional(),
});

export type CartItemsType = z.infer<typeof CartItemZodSchema>;

type AddressOption = z.infer<typeof addressSchema>;

// interface OrderHistory {
//   order_date: Date;
//   cart: Array<CartItemsType>;
// }

export interface ICustomer {
  username: string;
  email: string;
  password: string;
  created_at: Date;
  first_name: string;
  is_admin: boolean;
  user_code: 1 | 2 | 3 | 4;
  last_name: string;
  shipping_address: AddressOption | null;
}
const customerSchema = new Schema<ICustomer>({
  username: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 16,
    lowercase: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    minlength: 4,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 5,
  },
  created_at: {
    type: Date,
    required: true,
  },
  first_name: {
    type: String,
    required: true,
    minlength: 2,
    lowercase: true,
  },
  last_name: {
    type: String,
    required: true,
    minlength: 1,
    lowercase: true,
  },
  is_admin: {
    type: Boolean,
    default: false,
    required: true,
  },
  user_code: {
    type: Number,
    enum: [1, 2, 3, 4],
    default: 1,
    required: true,
  },
  shipping_address: {
    name: {
      type: String,
      minlength: 3,
    },
    phone: {
      type: String,
    },
    address: {
      line1: {
        type: String,
        minlength: 1,
      },
      line2: {
        type: String,
      },
      city: {
        type: String,
        minlength: 1,
      },
      state: {
        type: String,
        minlength: 1,
      },
      postal_code: {
        type: String,
        minlength: 1,
      },
      country: {
        type: String,
        enum: ["US", "CA"],
      },
    },
  },
});

customerSchema.virtual("fullName").get(function () {
  return `${this.first_name} ${this.last_name}`;
});

export default mongoose.model("Customer", customerSchema);
