import { Request, Response, NextFunction } from "express";
import "dotenv/config";
import Stripe from "stripe";
import mongoose from "mongoose";
import Product from "../models/Product";
import { CartItemsType, CartItemZodSchema } from "../models/Customer";
import { z } from "zod";

const stripe = new Stripe(process.env.STRIPE_SECRET || "");

//input: shipping code
//returns: shipping cost in cents
const getShippingFromCode = (shippingCode: number) => {
  //1 -> Free Shipping -> $0
  //2 -> Ground Shipping -> $5.99
  //3 -> Next Day Air -> $15.99
  switch (shippingCode) {
    case 1:
      return 0;
    case 2:
      return 599;
    case 3:
      return 1599;
    default:
      throw new Error(
        "Unexpected error occured while calculating shipping cost."
      );
  }
};
async function calculateItemAmount(cart: CartItemsType[]): Promise<number> {
  const productQuery = cart.map((item) => ({
    _id: new mongoose.Types.ObjectId(item._id),
  }));
  if (productQuery.length <= 0) return 0;

  const productsAgg = Product.aggregate([
    { $match: { $or: [...productQuery] } },
  ]);
  const products = await productsAgg;
  // console.log(products);
  if (products.length === 0) return 0;
  const totalPrice = products.reduce((prev, curr) => {
    const cartItem = cart.find((p) => p._id.toString() === curr._id.toString());

    const productTotal = cartItem!.cart_quantity * curr.price;
    return prev + productTotal;
  }, 0);
  const fixedPrice = Number(totalPrice.toFixed(2));

  return fixedPrice;
}

const stripe_get_customer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  //default for tests -> cus_QszC7xA9EHyBL9
  try {
    const customers = await stripe.customers.list({
      limit: 10,
    });
    return res.json({ customers });
  } catch (error) {
    return next(error);
  }
};

const stripe_update_intent = async (
  req: Request<
    { intentId: string },
    {},
    { shippingCode: number; cart: CartItemsType[] }
  >,
  res: Response,
  next: NextFunction
) => {
  req.body.shippingCode = +req.body.shippingCode;
  try {
    if (req.params.intentId === "undefined") {
      return res.status(400).json({ error: "Provide the payment intent id." });
    }
    if (!req.body.cart) {
      return res
        .status(400)
        .json({ error: "Provide the shopping cart in the payload." });
    }
    if (
      !req.body.shippingCode ||
      req.body.shippingCode < 0 ||
      req.body.shippingCode > 3
    ) {
      return res
        .status(400)
        .json({ error: "Provide a valid shipping code in the payload." });
    }
    const schemaRes = z.array(CartItemZodSchema).safeParse(req.body.cart);
    // console.log(req.body.cart);
    if (!schemaRes.success) {
      // console.log(schemaRes.error);
      return res.status(400).json({ error: schemaRes.error });
    }
    // console.log(req.body);

    const shippingCostInCents = getShippingFromCode(req.body.shippingCode);
    const newCostInDollars = await calculateItemAmount(req.body.cart);
    const itemAmountInCents =
      Math.round(100 * newCostInDollars) + shippingCostInCents;

    const itemAmountInDollars = Number((itemAmountInCents / 100).toFixed(2));
    const shippingCostInDollars = Number(
      (shippingCostInCents / 100).toFixed(2)
    );
    const cartIdsAsStr = schemaRes.data.map((d) => d._id).join(",");

    // type PaymentIntentMetadata = {
    //   total:number,
    //   shipping_code:number|string,
    //   shipping:number,
    //   cartTotal:number,
    //   cartProductIdsAsStr:string
    // }

    const response = await stripe.paymentIntents.update(req.params.intentId, {
      amount: itemAmountInCents,
      metadata: {
        total: itemAmountInDollars,
        shipping_code: req.body.shippingCode,
        shipping: shippingCostInDollars,
        cartTotal: newCostInDollars,
        cartProductIdsAsStr: cartIdsAsStr,
      },
    });
    if (!response) {
      return res.status(400).json({ error: "Failed to update payment info." });
    }

    return res.json({
      amount: {
        total: itemAmountInDollars,
        shipping_code: req.body.shippingCode,
        shipping: shippingCostInDollars,
        cartTotal: newCostInDollars,
      },
    });
  } catch (error) {
    console.log(error);
  }
};
const retrieve_pay_info = async (
  req: Request<{}, {}, { payIntent: string }>,
  res: Response,
  next: NextFunction
) => {
  const paymentIntentId = req.body.payIntent;
  if (!paymentIntentId) {
    return next();
  }
  try {
    const response = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!response) {
      return res.status(400).json({ error: "Payment id doesn't exist." });
    }

    return res.json({ data: response.metadata });
  } catch (error) {
    return res.status(400).json({ message: error });
  }
};
const stripe_create_intent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  //get cart items from req.body (_id,price,cartQuantity,etc.)
  //cents (x) dollar amount
  const cart = req.body.cart;
  // console.log("cart", cart);
  if (!cart) {
    return res.sendStatus(400);
  }

  // const itemAmount = 100 * 1;
  try {
    const cartAmount = await calculateItemAmount(cart);
    // const cartAmount = 1;
    const itemAmount = Math.round(100 * cartAmount) + getShippingFromCode(1);

    console.log("cents", itemAmount);
    if (itemAmount <= 0) return res.sendStatus(400);

    // const customer = await stripe.customers.create({
    //   name: "Bob Smith",
    //   email: "bob.smith@example.com",
    //   address: {
    //     line1: "123 Main St.",
    //     state: "MO",
    //     country: "US",
    //     postal_code: "64110",
    //     city: "Kansas City",
    //   },
    //   metadata: {},
    // });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: itemAmount,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {},
      customer: "cus_QszC7xA9EHyBL9",
      setup_future_usage: "on_session",
      payment_method_options: {
        card: {
          require_cvc_recollection: true,
        },
      },
    });
    const customerSession = await stripe.customerSessions.create({
      customer: "cus_QszC7xA9EHyBL9",
      components: {
        payment_element: {
          enabled: true,
          features: {
            payment_method_redisplay: "enabled",
            payment_method_save: "enabled",
            payment_method_save_usage: "on_session",
            payment_method_remove: "enabled",
          },
        },
      },
    });
    const customer: any = await stripe.customers.retrieve("cus_QszC7xA9EHyBL9");

    return res.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      customer_session_client_secret: customerSession.client_secret,
      customer: { address: customer.address, name: customer.name },
      payAmount: paymentIntent.amount / 100,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  stripe_create_intent,
  stripe_get_customer,
  stripe_update_intent,
  retrieve_pay_info,
};
