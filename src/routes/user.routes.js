import { Router } from "express";
import {registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    getcurrentuser,
    updateInfo,
    updateavatar,
    updatecover} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyjwt } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name:'avatar',
            maxCount:1
        },
        {
            name: "coverImage",
            maxCount:1
        }
    ]),
    registerUser
    );

router.route("/login").post(loginUser);

//secured routes
router.route("/logout").post(verifyjwt,logoutUser);
router.route("/refreshTokens").post(refreshAccessToken);
router.route("/changePassword").post(verifyjwt,changePassword);


export default router;