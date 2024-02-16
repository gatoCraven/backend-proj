import {asynchandler} from "../utils/asynchandler.js";
import { apiError } from "../utils/apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCLoud } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiresponse.js";

const registerUser = asynchandler(async (req, res) => {
    
    const {username,fullname,email,password} = req.body;
    if([fullname,username,email,password].some((field)=>field?.trim === "")){
        throw new apiError(400, `All fields must be filled`);
    }
    // Checking if the user already exists in the database
    const existedUser = User.findOne({
        $or : [{username},{email}]
    });
    console.log(existedUser);
    if(existedUser?._id){
        throw new apiError(409,"Username or email already in use.")
    }
    console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImagePath = req.files?.coverimage[0]?.path;
    if(!avatarLocalPath){
        throw new apiError(409,"Avatar Image is required.")
    }

    const avatar = await uploadOnCLoud(avatarLocalPath);
    const coverImage = await uploadOnCLoud(coverImagePath);

    if(!avatar){
        throw new apiError(409,"Avatar Image is required.");
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase() 
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    console.log(createdUser);
    res.send(createdUser);

    return res.status(201).json(new apiResponse(201,createdUser,"User Created."));
});


export {registerUser};