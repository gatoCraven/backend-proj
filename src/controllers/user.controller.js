import {asynchandler} from "../utils/asynchandler.js";
import { apiError } from "../utils/apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCLoud } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiresponse.js";

const registerUser = asynchandler(async (req, res) => {
    
    const {username,fullname,email,password} = req.body;
    // if([fullname,username,email,password].some((field)=>field?.trim == "")){
    //     throw new apiError(400, `All fields must be filled`);
    // }
    if(!(username || fullname || email || password)){
        throw new apiError(400, `All fields must be filled`);
    }
    // Checking if the user already exists in the database
    const existedUser = await User.findOne({
        $or : [{username},{email}]
    });

    if(existedUser?._id){
        throw new apiError(409,"Username or email already in use.")
    }

    let avatarLocalPath; //= req.files?.avatar[0]?.path;
    let coverImagepath;
    if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0){
        avatarLocalPath = req.files.avatar[0].path;
    }
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImagepath = req.files.coverImage[0].path;
    }
    
    if(!avatarLocalPath){
        throw new apiError(409,"Avatar Image is required.")
    }

    const avatar = await uploadOnCLoud(avatarLocalPath);
    const coverImage = await uploadOnCLoud(coverImagepath);

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

    return res.status(201).json(new apiResponse(201,createdUser,"User Created."));
});

const generateTokens = async (user)=>{
    try {
        const accessToken =  await user.generateAccessTokens();
        const refreshToken = await user.generateRefreshTokens();
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false});

        return {accessToken,refreshToken};
        
    } catch (error) {
        throw new  apiError(500, error?.message || "Something went wrong" );
    }
}

const loginUser = asynchandler(async (req,res)=>{
    const {email,username,password} = req.body;

    if(!(email || username)){
        return apiError(400,"email or username required.");
    }
    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        return apiError(404,"User not found.")
    }

    if(!password){
        return apiError(400,"Password Required")
    }

    const validatePassword = user.isPasswordCorrect(password);

    if(!validatePassword){
        return apiError(403,"Bad Credentials")
    }

    const {accessToken,refreshToken} = await generateTokens(user);
    const logUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly:true,
        secure:true
    }
    const response = new apiResponse(200,
        {
        user:logUser,
        accessToken,
        refreshToken
    },
    "User Logged in succesfully");

    return res
    .status(200)
    // .cookie("accesstoken",accessToken,options)
    // .cookie("refreshtoken",refreshToken,options)
    .json(response)
});

const logoutUser = asynchandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        }
    );

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    // .clearCookie("accesstoken",options)
    // .clearCookie("refreshtoken",options)
    .json(new apiResponse(200,{} ,'Logged out Successfully'));
});

export {
    registerUser,
    loginUser,
    logoutUser
};