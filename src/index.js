import connectDB from "./db/index.js";
import {app} from "./app.js"
import dotenv from "dotenv";

const port= (process.env.port || 5000)
dotenv.config();
connectDB()
.then(()=>{
    app.on("error",(err)=>{
        console.log(`Error : ${err}`);
        throw(err);
    })
    app.listen(port,()=>{
        console.log(`Server is running on port ${port}`);
    })
})
.catch((err)=>{console.log("DB Connection Failed",err);});