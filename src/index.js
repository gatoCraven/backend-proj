import connectDB from "./db/index.js";
import {app} from "./app.js"
import dotenv from "dotenv";
dotenv.config();
connectDB()
.then(()=>{
    app.on("error",(err)=>{
        console.log(`Error : ${err}`);
        throw(err);
    })
    app.listen(process.env.port || 5000,()=>{
        console.log(`Server is running on port ${process.env.port}`);
    })
})
.catch((err)=>{console.log("DB Connection Failed",err);});