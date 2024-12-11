import express from "express";
import { connectToDatabase } from "./db/createConnection";
import { createTables } from "./db/createTables";
import { addAppMiddleware } from "./utils/appMiddleware";
import { logToCloudWatch } from "./logs/logs";
import "colors";
import testRoutes from "./routes/testRoutes";
import itemRoutes from "./routes/itemRoutes";
import errorHandler from "./middleware/errorHandler";
import path from "path";
import dotenv from "dotenv";
dotenv.config();




(async () => {
  //DB
  const connection = await connectToDatabase();
  await createTables();


  //MIDDLEWARE
  const app = express();
  addAppMiddleware(app);


  //ROUTES
  app.use(express.static(path.join(__dirname, '../public')));
  app.get("/", (req, res) => { res.sendFile(path.join(__dirname, '../public', 'index.html')); });
  app.use("/api/test", testRoutes);
  app.use("/api/items", itemRoutes);


  //HANDLE ERRORS (must come at the end)
  app.use(errorHandler);


  //RUN SERVER
  const port = process.env.PORT || 80;
  app.listen(port, async () => {
    console.log(`Server is up on port ${port} in ${process.env.NODE_ENV} mode`.yellow);
    await logToCloudWatch('Server started on port 80');
  });

  process.on("unhandledRejection", (err: Error) => {
    console.log("Error!".red, err);
    console.log(`Error: ${err.message}`.red);
    process.exit(1);
  });

})();






