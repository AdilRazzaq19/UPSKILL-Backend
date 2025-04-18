const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
dotenv.config();
const app = express();
const MODE = process.env.MODE;
const PORT = process.env.PORT;

const RegisterController = require("./Routes/RegisterRouter");
const LoginController=require("./Routes/LoginRouter")
const OnBoardingController=require("./Routes/OnBoardingRouter")
const ThemeController=require("./Routes/ThemeRouter");
const SectionController=require("./Routes/SectionRouter")
const ModuleController=require("./Routes/ModuleRouter")
const VideoController=require("./Routes/VideoRouter")
const QuizController=require("./Routes/QuizRouter");
const progressController=require("./Routes/ProgressRouter");
const badgeRoutes = require("./Routes/BadgeRouter");
const LearningController=require("./Routes/LearningRouter")
const flashcardRoutes = require("./Routes/FlashcardRouter");
const feedbackRoutes=require("./Routes/FeedbackRouter")
const socialRoutes=require("./Routes/SocialRouter")
const skillRoutes=require("./Routes/SkillRouter")
const videoChatRoutes = require('./Routes/ChatRouter');
const exerciseRoutes = require("./Routes/ApplyRouter");
const learningPathRoutes=require("./Routes/LearningPathRouter");
const quickReviewRoutes=require("./Routes/QuickReviewRouter");
const logger=require("./middleware/logger")

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  credentials: true,
  origin: '*' 
}));
app.use(logger);


app.use("/register", RegisterController);
app.use("/login", LoginController);
app.use("/onBoarding",OnBoardingController);
app.use("/theme",ThemeController);
app.use("/section",SectionController);
app.use("/module",ModuleController);
app.use("/video",VideoController);
app.use("/quiz", QuizController);
app.use("/progress",progressController);
app.use("/badges", badgeRoutes);
app.use("/learning",LearningController)
app.use("/flashcards", flashcardRoutes);
app.use("/feedback",feedbackRoutes)
app.use("/auth",socialRoutes);
app.use("/skill",skillRoutes);
app.use('/chat', videoChatRoutes);
app.use("/apply", exerciseRoutes);
app.use("/learningPath",learningPathRoutes)
app.use("/quickReview",quickReviewRoutes)
// Connect to MongoDB
if (MODE === "development") {
  mongoose.connect(process.env.MONGO_URI);}
// } else if (MODE === "production") {
//   mongoose.connect(process.env.MONGO_URI_PROD);
// }

const db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:")).once(
  "open",
  () => {
    console.log("Connected to MongoDB");
  }
);

// Routes
app.get("/", (req, res) => {
  res.send("Hello World from Upskill!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
