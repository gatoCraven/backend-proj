import { Router } from "express";
import {registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    getcurrentuser,
    updateInfo,
    updateavatar,
    updatecover,
    getchannel,
    getwatchHistory} from "../controllers/user.controller.js";
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
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyjwt,changePassword);
router.route("/update-avatar").patch(
    verifyjwt,
    upload.single("avatar"),
    updateavatar
);
router.route("/update-cover").patch(
    verifyjwt,
    upload.single("cover"),
    updatecover
);
router.route("/update-acount").patch(verifyjwt,updateInfo);
router.route("/current-user").get(verifyjwt,getcurrentuser);

router.route("/c/:username").get(verifyjwt,getchannel);
router.route("/history").get(verifyjwt,getwatchHistory);

export default router;