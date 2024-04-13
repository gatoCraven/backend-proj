import {asynchandler} from "../utils/asynchandler.js";
import { apiError } from "../utils/apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCLoud } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiresponse.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const isPasswordCorrect = async function(password,user){
    const isCorrect =  await bcrypt.compare(password,user.password);
    console.log(isCorrect);
    return isCorrect;
}

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
        throw new apiError(400,"email or username required.");
    }
    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new apiError(404,"User not found.")
    }

    if(!password){
        throw new apiError(400,"Password Required")
    }

    const validatePassword = await user.isPasswordCorrect(password);

    if(!validatePassword){
        throw new apiError(403,"Bad Credentials");
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

const getcurrentuser = asynchandler(async (req,res)=>{
    // const user = await User.findById(req.user?._id).select("-password -refreshToken");
    return res
    .status(200)
    .json(new apiResponse(200,req.user,"user fetched succesfully."));
});

const updateInfo = asynchandler(async (req,res)=>{
    const {username,email,fullname} = req.body;
    if(!fullname||!email||!username){
        throw new apiError(400,"All fields are required.")
    }
    const user =await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email,
                username
            }
        },
        {new:true}).select("-password -refreshToken");
    
    return res
    .status(200)
    .json(new apiResponse(
        200,
        user,
        "User info updated."
    ));
});

const updateavatar = asynchandler(async(req,res)=>{
    let avatarlocalpath = req.file?.path;
    // if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0){
    //     avatarlocalpath = req.files.avatar[0].path;
    // }
    if(!avatarlocalpath){
        throw new apiError(400,"Avatar Image not uploaded.")
    }
    const avatar = await uploadOnCLoud(avatarlocalpath);

    if(!avatar.url){
        throw new apiError(400,"Error while uploading avatar.")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
    {
        $set:{avatar:avatar.url}
    },{new : true}).select("-password -refreshToken");

    return res
    .status(200)
    .json(new apiResponse(
        200,
        user,
        "Avatar Image updated."
    ));
});

const updatecover = asynchandler(async(req,res)=>{
    let coverlocalpath = req.file?.path;
    // if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0){
    //     avatarlocalpath = req.files.avatar[0].path;
    // }
    if(!coverlocalpath){
        throw new apiError(400,"Cover Image not uploaded.")
    }
    const cover = await uploadOnCLoud(coverlocalpath);

    if(!cover.url){
        throw new apiError(400,"Error while uploading cover.")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
    {
        $set:{coverImage:cover.url}
    },{new : true}).select("-password -refreshToken");

    return res
    .status(200)
    .json(new apiResponse(
        200,
        user,
        "Cover Image updated."
    ));
});

const getchannel = asynchandler(async(req,res)=>{
    const {username} = req.params;

    if(!username?.trim()){
        throw new apiError(400, 'Username is required');
    }

    const channel = await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscibers"
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                subscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                username:1,
                subscribersCount:1,
                subscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ]);
    console.log(channel);
    if(!channel?.length){
        throw new apiError(404,"Data not found");
    }
    return res
    .status(200)
    .json(new apiResponse(
        200,
        channel[0],
        "Channel fetched successfully."
    ));
});

const getwatchHistory = asynchandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        },
    ]);
    return res
    .status(200)
    .json(new apiResponse(
        200,
        user[0].getwatchHistory,
        "Watch History fetched."
    ))
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    getcurrentuser,
    updateInfo,
    updateavatar,
    updatecover,
    getchannel,
    getwatchHistory
};