import express from "express";
import getFoodCost from "../controllers/costing.controller.js";
import { getDishList } from "../controllers/costing.controller.js";
import { getAllDishesSummary } from "../controllers/costing.controller.js";

const router = express.Router();
router.get("/food-cost/summary", getAllDishesSummary);
router.get("/food-cost/dishList", getDishList);
router.get("/food-cost/:dishName", getFoodCost);


export default router;
