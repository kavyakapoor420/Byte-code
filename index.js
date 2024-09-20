import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = 3000;

// Set up session management
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport Serialize/Deserialize
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// GitHub OAuth Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/github/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, { profile, accessToken });
    }
  )
);

// GitHub API to check if user follows a specific account
const checkGitHubFollow = async (accessToken) => {
  try {
    const response = await axios.get(
      "https://api.github.com/user/following/bytemait",
      {
        headers: {
          Authorization: `token ${accessToken}`,
        },
      }
    );
    return response.status === 204;
  } catch (error) {
    return false; // If not following or any error
  }
};

// Google OAuth Strategy
// Google OAuth Strategy
passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Ensure the access token is passed for subscription check
          profile.accessToken = accessToken;
          const isSubscribed = await checkYouTubeSubscription(accessToken);
          if (isSubscribed) {
            return done(null, profile);
          } else {
            return done(null, false, {
              message: "Not subscribed to BYTE channel",
            });
          }
        } catch (error) {
          console.error("Error checking YouTube subscription:", error);
          return done(null, false, { message: "Failed to verify subscription" });
        }
      }
    )
  );
  
  // YouTube subscription check function
  async function checkYouTubeSubscription(accessToken) {
    const channelId = "UCgIzTPYitha6idOdrr7M8sQ"; // Replace with BYTE's actual channel ID
  
    try {
      const response = await axios.get(
        "https://www.googleapis.com/youtube/v3/subscriptions",
        {
          params: {
            part: "snippet",
            mine: true,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
  
      if (!response.data.items || response.data.items.length === 0) {
        return false; // User is not subscribed to any channels
      }
  
      const subscriptions = response.data.items;
      return subscriptions.some(
        (subscription) => subscription.snippet.resourceId.channelId === channelId
      );
    } catch (error) {
      console.error("Error fetching YouTube subscriptions:", error);
      return false;
    }
  }
  

// Route for the home page
app.get("/", (req, res) => {
  res.send(
    '<a href="/auth/github">Login with GitHub</a> | <a href="/auth/google">Login with Google</a>'
  );
});

// GitHub Authentication
app.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["user:follow"] })
);

app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/" }),
  async (req, res) => {
    const { accessToken } = req.user;
    const isFollowing = await checkGitHubFollow(accessToken);
    if (isFollowing) {
      res.redirect("/private");
    } else {
        res.send("follow byte on github")
    //   res.render("error.ejs", {
    //     message: "You need to follow BYTE GitHub account to access this page.",      });
    }
  }
);

// Google authentication routes
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/youtube.readonly",
    ], // Include YouTube scope
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  async (req, res) => {
    try {
      const accessToken = req.user.accessToken; // Get access token from user data
      const isSubscribed = await checkYouTubeSubscription(accessToken); // Check YouTube subscription
      if (isSubscribed) {
        res.redirect("/private"); // Redirect if subscribed
      } else {
        res.render("error.ejs", {
          message:
            "You need to subscribe to BYTE YouTube channel to access this page.",
        });
      }
    } catch (error) {
      console.error("Error during Google authentication:", error);
      res.render("error.ejs", {
        message: "An error occurred during authentication.",
      });
    }
  }
);

// Private Route
app.get("/private", (req, res) => {
  if (req.isAuthenticated()) {
    res.send("Welcome to the private page!");
  } else {
    res.send("Unauthorized access");
  }
});

// Error route to display custom error messages
app.get("/error", (req, res) => {
  res.render("error.ejs");
});

// Listen on port 3000
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


