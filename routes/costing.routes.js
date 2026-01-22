import express from "express";
import getFoodCost from "../controllers/costing.controller.js";

const router = express.Router();

router.get("/food-cost/:dishName", getFoodCost);

export default router;
