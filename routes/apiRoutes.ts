import { Router } from "express";
import * as controller from "../controller/apiController";

const router = Router();

router.get("/test", controller.test_get);

//all products
router.get("/products", controller.products_get);
router.post("/products", controller.products_post);

//single product
router.get("/product/:productId", controller.product_detail_get);
router.put("/product/:productId");
router.delete("/product/:productId");

//all categories
router.get("/categories", controller.categories_get);
router.post("/categories", controller.categories_post);
//single category
router.get("/category/:categoryId", controller.category_detail_get);
router.put("/category/:categoryId");
router.delete("/category/:categoryId");

//all reviews of a product
router.get("/product/:productId/reviews").post("/product/:productId/reviews");
//get a single review of a product
router
  .get("/product/:productId/review/:reviewId")
  .put("/product/:productId/review/:reviewId")
  .delete("/product/:productId/review/:reviewId");

router.use((req, res, next) => {
  return res.sendStatus(404);
});
export default router;
