import { Router } from "express";
import { search, autocomplete } from "../controllers/search.controller.js";

const router = Router();
router.get("/", search);
router.get("/autocomplete", autocomplete);
export default router;
