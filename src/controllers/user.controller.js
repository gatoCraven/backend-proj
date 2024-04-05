import {asynchandler} from "../utils/asynchandler.js";
import { apiError } from "../utils/apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCLoud } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiresponse.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const passwordHash = async function(password){
    // if(!this.isModified(this.password)) {return next;}
    return await bcrypt.hash(password, 10);
};

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
    const hashedPassword = await passwordHash(password);
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password : hashedPassword,
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

const refreshAccessToken =  asynchandler(async(req,res)=>{
    const token = 
        // req.cookies?.accessToken ||
        req.body.refreshToken;
    
        if(!token){
            throw new apiError(401,"Unauthorised request");
        }

        try {
            const decodedToken = jwt.verify(token , process.env.REFRESH_TOKEN_SECRET);

            const user = await User.findById(decodedToken?._id);
            
            if(!user){
                throw new apiError(401,"Invalid refresh token");
            }
            
            if(user?.refreshToken !== token){
                throw new apiError(401,"Refresh Token invalid/expired");
            }
    
            const {accessToken,refreshToken} =await generateTokens(user);

            const options = {
                httpOnly:true,
                secure:true
            }
            
            const response = new apiResponse(200,
                {
                accessToken,
                refreshToken
            },
            "Access Token refreshed succesfully");
        
            return res
            .status(200)
            // .cookie("accesstoken",accessToken,options)
            // .cookie("refreshtoken",refreshToken,options)
            .json(response)
        } catch (error) {
            throw new apiError(401, error?.message || "Error while refreshing token")
        }
});

const changePassword = asynchandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
        throw new apiError(403,"Old Password is incorrect!");
    }
    user.password = await passwordHash(newPassword);
    await user.save({validateBeforeSave:false});

    return res.
    status(200).
    json(new apiResponse(
        200,
        {},
        "Password Changed Successfully."
    ));
});

// const updateInfo = asynchandler((req,res)=>{
//     const user = await User.findById(req.user?._id);
//     const updates = req.body
// });

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword
};