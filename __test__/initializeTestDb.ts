import mongoose from "mongoose";
import Category from "../models/Category";
import Product from "../models/Product";
import Customer from "../models/Customer";
import OrderHistory, { IOrderHistory } from "../models/OrderHistory";

export const categoryIds: string[] = [];
export const productIds: string[] = [];
export const customerIds: string[] = [];
export const orderIds: string[] = [];

export default async function initializeTestDb() {
  await createCategory();
  await createProducts();
  await createCustomer();
  await createOrderHistory();
}

async function createCategory() {
  const category = new Category({
    name: "Electronics-test",
  });
  const category2 = new Category({
    name: "Test",
  });

  await category.save();
  await category2.save();

  categoryIds.push(category.id, category2.id);
}
async function createProducts() {
  const product = new Product({
    name: "test-nintendo",
    brand: "test-brand",
    price: 100.01,
    retail_price: 200.99,
    description: "test description.",
    highlights: [],
    quantity: 23,
    category: [categoryIds[0]],
    total_bought: 190,
    tags: ["nintendo"],
    image_src: "",
  });
  const product2 = new Product({
    name: "test-item",
    brand: "test-brand2",
    price: 49.99,
    retail_price: 199,
    description: "test description 2.",
    highlights: [],
    quantity: 230,
    category: [categoryIds[1]],
    total_bought: 10,
    tags: ["test"],
    image_src: "",
  });
  await product.save();
  await product2.save();

  productIds.push(product.id, product2.id);
}

async function createCustomer() {
  const customer = new Customer({
    username: "Pbody",
    email: "1234@1234.com",
    password: "unhashedpass",
    created_at: "2024-09-29T03:33:20.715Z",
    first_name: "testname",
    last_name: "Sherman",
    is_admin: false,
    user_code: 1,
    shipping_address: null,
    order_history: null,
  });
  const newCustomer = await customer.save();
  customerIds.push(newCustomer.id);
}
async function createOrderHistory() {
  const order = new OrderHistory<IOrderHistory>({
    cart: [
      {
        _id: productIds[0],
        name: "test",
        brand: "test",
        price: 2,
        retail_price: 43,
        quantity: 3,
        cart_quantity: 1,
        category: [
          {
            _id: categoryIds[0],
            name: "catname",
          },
        ],
      },
    ],
    shipping: {
      code: 1,
      cost: 0,
    },
    customer_id: new mongoose.Types.ObjectId(customerIds[0]),
    cart_total: 6,
    order_date: new Date("2024-10-01T22:31:31.507Z"),
  });
  orderIds.push(order.id);
  await order.save();
}
