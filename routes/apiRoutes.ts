import { Router } from "express";
import * as controller from "../controller/apiController";

const router = Router();

router.get("/test", controller.test_get);

//all products
router.get("/products", controller.products_get);
router.post("/products", controller.products_post);

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
//get a single review of a product
router.get("/review/:reviewId", controller.review_detail_get);
router.put("/review/:reviewId", controller.review_detail_put);
router.delete("/review/:reviewId", controller.review_detail_delete);

router.use((req, res, next) => {
  return res.sendStatus(404);
});
export default router;
