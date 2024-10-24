import { Router } from "express";
import * as controller from "../controller/apiController";
import * as payment from "../controller/paymentController";
import * as auth from "../controller/authController";

const router = Router();

router.get("/test", controller.test_get);

//payment api
router.post(
  "/create-payment-intent",
  auth.verify_Auth,
  payment.stripe_create_intent
);
router.get("/get-cus", payment.stripe_get_customer);
router.post("/update-intent/:intentId", payment.stripe_update_intent);
router.post("/payment/info", payment.retrieve_pay_info);

//all products
router.get("/products", controller.products_get); //**available
router.post(
  "/products",
  auth.verify_Auth,
  auth.permitAdminOnly,
  controller.products_post
); //**only by admins - protect sensitive info

//all products by category
router.get("/products/category/:categoryId", controller.productsByCategory_get); //**available

//single product
router.get("/product/:productId", controller.product_detail_get); //**available
router.put(
  "/product/:productId",
  auth.verify_Auth,
  auth.permitAdminOnly,
  controller.product_detail_put
); //**only by admins - protect sensitive info
router.delete(
  "/product/:productId",
  auth.verify_Auth,
  auth.permitAdminOnly,
  controller.product_detail_delete
); //**only by admins - protect sensitive info

//all categories
router.get("/categories", controller.categories_get); //**available
router.post(
  "/categories",
  auth.verify_Auth,
  auth.permitAdminOnly,
  controller.categories_post
); //**only by admins - protect sensitive info

//single category
router.get("/category/:categoryId", controller.category_detail_get); //**available

router.put(
  "/category/:categoryId",
  auth.verify_Auth,
  auth.permitAdminOnly,
  controller.category_detail_put
); //**only by admins - protect sensitive info

router.delete(
  "/category/:categoryId",
  auth.verify_Auth,
  auth.permitAdminOnly,
  controller.category_detail_delete
); //**only by admins - protect sensitive info

//all reviews of a product
router.get("/reviews", controller.reviews_get); //**available
router.post(
  "/reviews",
  auth.verify_Auth,
  auth.permitUserPost("Reviews"),
  controller.reviews_post
); //**only verified purchases

//reviews by product id
router.get("/reviews/product/:productId", controller.reviewsByProduct_get); //**available
//get a single review of a product
router.get("/review/:reviewId", controller.review_detail_get); //**available
router.put(
  "/review/:reviewId",
  auth.verify_Auth,
  auth.permitUser("Reviews"),
  controller.review_detail_put
); //**only by the user or admin [restrict PUT control]
router.delete(
  "/review/:reviewId",
  auth.verify_Auth,
  auth.permitUser("Reviews"),
  controller.review_detail_delete
); //**only by the user or admin

//Customer api
router.get(
  "/customers",
  auth.verify_Auth,
  auth.permitAdminOnly,
  controller.customer_list
); //**only by admins - protect sensitive info

router.post("/customers", controller.customer_create); //**available

router.get(
  "/customer/:customerId",
  auth.verify_Auth,
  auth.permitUser("Customers"),
  controller.customer_detail
); //**only by the user or admins - protect sensitive info
router.put(
  "/customer/:customerId",
  auth.verify_Auth,
  auth.permitUser("Customers"),
  auth.replaceSession,
  controller.customer_detail_put
); //only by the user with strict PUT control and admins - protect sensitive info
router.delete(
  "/customer/:customerId",
  auth.verify_Auth,
  auth.permitUser("Customers"),
  controller.customer_detail_delete
); //**only by the user or admins - protect sensitive info

router.get(
  "/orderhistory",
  auth.verify_Auth,
  auth.permitAdminOnly,
  controller.orderHistory_list
); //**only by admins - protect sensitive info

router.get(
  "/orderhistory/customer/:customerId",
  auth.verify_Auth,
  auth.permitUser("Orders"),
  controller.orderHistory_by_customer
); //**only the user by admins - protect sensitive info

router.post(
  "/orderhistory",
  auth.verify_Auth,
  auth.permitUserPost("Orders"),
  controller.orderHistory_create
); //**only by the user or admins - Logic includes verifying the purchase before adding

router.get(
  "/orderhistory/:orderId",
  auth.verify_Auth,
  auth.permitUser("Orders-GET"),
  controller.orderHistory_detail
); //**only by the user or admins - protect sensitive info

router.put(
  "/orderhistory/:orderId",
  auth.verify_Auth,
  auth.permitAdminOnly,
  controller.orderHistory_detail_put
); //**only by admins - protect sensitive info

router.delete(
  "/orderhistory/:orderId",
  auth.verify_Auth,
  auth.permitAdminOnly,
  controller.orderHistory_detail_delete
); //**only by admins - protect sensitive info

// router.post("/overwrite", controller.overwrite);
export default router;
