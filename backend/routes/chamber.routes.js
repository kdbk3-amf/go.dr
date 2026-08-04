const express=require("express");

const router=express.Router();

const chamberController=require("../controllers/chamber.controller");

router.get("/",chamberController.getAllChambers);

router.get("/search",chamberController.searchChambers);

router.get("/:id",chamberController.getChamberById);

router.post("/",chamberController.createChamber);

router.put("/:id",chamberController.updateChamber);

router.delete("/:id",chamberController.deleteChamber);

module.exports=router;
