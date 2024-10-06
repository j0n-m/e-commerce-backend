import { Router } from "express";
import * as controller from "../controller/apiController";
import * as payment from "../controller/paymentController";
import { verify_Auth } from "../controller/authController";

const router = Router();

router.get("/test", controller.test_get);

//payment api
router.post("/create-payment-intent", payment.stripe_create_intent);
router.get("/get-cus", payment.stripe_get_customer);
router.post("/update-intent/:intentId", payment.stripe_update_intent);
router.post("/payment/info", payment.retrieve_pay_info);

//all products
router.get("/products", controller.products_get);
router.post("/products", controller.products_post);

//all products by category
router.get("/products/category/:categoryId", controller.productsByCategory_get);

//single product
router.get("/product/:productId", controller.product_detail_get);
router.put("/product/:productId", controller.product_detail_put);
router.delete("/product/:productId", controller.product_detail_delete);

//all categories
router.get("/categories", controller.categories_get);
router.post("/categories", controller.categories_post);
//single category
router.get("/category/:categoryId", controller.category_detail_get);
router.put("/category/:categoryId", controller.category_detail_put);
router.delete("/category/:categoryId", controller.category_detail_delete);

//all reviews of a product
router.get("/reviews", controller.reviews_get);
router.post("/reviews", controller.reviews_post);

//reviews by product id
router.get("/reviews/product/:productId", controller.reviewsByProduct_get);
//get a single review of a product
router.get("/review/:reviewId", controller.review_detail_get);
router.put("/review/:reviewId", controller.review_detail_put);
router.delete("/review/:reviewId", controller.review_detail_delete);

//Customer api
router.get("/customers", controller.customer_list);
router.post("/customers", controller.customer_create);

router.get("/customer/:customerId", controller.customer_detail);
router.put("/customer/:customerId", controller.customer_detail_put);
router.delete("/customer/:customerId", controller.customer_detail_delete);

router.get("/orderhistory", controller.orderHistory_list);
router.get(
  "/orderhistory/customer/:customerId",
  controller.orderHistory_by_customer
);
router.post("/orderhistory", controller.orderHistory_create);
router.get("/orderhistory/:orderId", controller.orderHistory_detail);
router.put("/orderhistory/:orderId", controller.orderHistory_detail_put);
router.delete("/orderhistory/:orderId", controller.orderHistory_detail_delete);

// router.use((req, res, next) => {
//   // return res.sendStatus(404);
//   return next();
// });
router.post("/overwrite", controller.overwrite);
export default router;
