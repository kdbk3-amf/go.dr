const Chamber=require("../models/chamber.model");

exports.getAllChambers=async(req,res)=>{

    try{

        const chambers=await Chamber.getAll();

        res.json({
            success:true,
            count:chambers.length,
            data:chambers
        });

    }catch(error){

        res.status(500).json({
            success:false,
            message:error.message
        });

    }

};

exports.getChamberById=async(req,res)=>{

    try{

        const chamber=await Chamber.getById(req.params.id);

        if(!chamber){

            return res.status(404).json({
                success:false,
                message:"Chamber not found"
            });

        }

        res.json({
            success:true,
            data:chamber
        });

    }catch(error){

        res.status(500).json({
            success:false,
            message:error.message
        });

    }

};

exports.createChamber=async(req,res)=>{

    try{

        const chamber=await Chamber.create(req.body);

        res.status(201).json({
            success:true,
            data:chamber
        });

    }catch(error){

        res.status(500).json({
            success:false,
            message:error.message
        });

    }

};

exports.updateChamber=async(req,res)=>{

    try{

        const chamber=await Chamber.update(req.params.id,req.body);

        res.json({
            success:true,
            data:chamber
        });

    }catch(error){

        res.status(500).json({
            success:false,
            message:error.message
        });

    }

};

exports.deleteChamber=async(req,res)=>{

    try{

        await Chamber.delete(req.params.id);

        res.json({
            success:true,
            message:"Chamber deleted successfully"
        });

    }catch(error){

        res.status(500).json({
            success:false,
            message:error.message
        });

    }

};

exports.searchChambers=async(req,res)=>{

    try{

        const chambers=await Chamber.search(req.query.q);

        res.json({
            success:true,
            count:chambers.length,
            data:chambers
        });

    }catch(error){

        res.status(500).json({
            success:false,
            message:error.message
        });

    }

};
