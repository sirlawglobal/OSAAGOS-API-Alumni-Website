const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
dotenv.config();
const { JWT_SECRET } = require("../config/jwt");

const { transporter } = require("../config/email");
const crypto = require("crypto");
// Generate JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: "1h" });
};


exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    // Check if a user with the same email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // Create and save the new user
    const user = new User({ name, email, password, role });
    await user.save();

    // Generate a verification token
    // const verificationToken = jwt.sign({ userId: user._id }, JWT_SECRET, {
    //   expiresIn: "1d",
    // });

    // Generate the verification URL using environment variable or config
    // const verificationUrl = `sandbox609197615c364f21847af2042f044dfe.mailgun.org/api/users/verify/${verificationToken}`;

    // Send a verification email using Mailgun

    // const mailOptions = {
    //   from: "no-reply@sandbox609197615c364f21847af2042f044dfe.mailgun.org", // Use your Mailgun verified domain
    //   to: email,
    //   subject: "Email Verification",
    //   text: `Hello ${name},\n\nPlease verify your email by clicking on the following link: \n\n${verificationUrl}\n\nThe link will expire in 24 hours.\n\nBest Regards,\nYour Company Name`,
    // };
    // const sendNotifation = sendmail(name, verificationToken, email);
    return res.status(201).json({
      message:
        "User registered successfully. Please check your email for verification.",
    });
    // }

    // mg.messages().send(mailOptions, (error, body) => {
    //   if (error) {
    //     console.error("Error sending email:", error);
    //     return res
    //       .status(500)
    //       .json({ message: "User registered but email could not be sent" });
    //   } else {
    //     console.log("Verification email sent:", body);
    //     return res
    //       .status(201)
    //       .json({
    //         message:
    //           "User registered successfully. Please check your email for verification.",
    //       });
    //   }
    // });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Verify email
exports.verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // Find the user and mark them as verified
    const user = await User.findById(userId);
    if (!user)
      return res
        .status(400)
        .json({ message: "Invalid token or user not found" });

    user.isVerified = true;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Login a user
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = generateToken(user._id, user.role);
    res.json({ token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get current user profile by ID
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get current user profile by email
exports.getUserProfileByEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(
      user.toJSON({
        virtuals: true,
        versionKey: false,
        transform: (doc, ret) => {
          delete ret.password;
          delete ret.plainPassword;
          return ret;
        },
      })
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Fetch all users excluding admins
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: "admin" } }).select(
      "-password"
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update user profile
// Update user profile
exports.updateUserProfile = async (req, res) => {
  const {
    name,
    email,
    phone,
    education,
    profession,
    graduationYear,
    fieldOfStudy,
    role,
    company,
    address,
  } = req.body;

  try {
    // Find the user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prepare update fields for non-email fields
    const updateFields = {};

    if (name && name !== user.name) {
      updateFields.name = name;
    }
    if (phone && phone !== user.phone) {
      updateFields.phone = phone;
    }
    if (education && education !== user.education) {
      updateFields.education = education;
    }
    if (profession && profession !== user.profession) {
      updateFields.profession = profession;
    }
    if (graduationYear && graduationYear !== user.graduationYear) {
      updateFields.graduationYear = graduationYear;
    }
    if (fieldOfStudy && fieldOfStudy !== user.fieldOfStudy) {
      updateFields.fieldOfStudy = fieldOfStudy;
    }
    if (address && address !== user.address) {
      updateFields.address = address;
    }
    if (company && company !== user.company) {
      updateFields.company = company;
    }
    if (role && role !== user.role) {
      updateFields.role = role;
    }

    // Update profile picture if a new file is uploaded
    if (req.file) {
      updateFields.profilePicture = req.file;
    }

    // Apply updates for non-email fields
    const updatedUser = await User.findByIdAndUpdate(req.user._id, updateFields, { new: true, runValidators: true });

    // Handle email update separately
    let emailConflictMessage = null;
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        emailConflictMessage = 'Email already exists and not updated';
      } else {
        // Update the email if it's unique
        await User.findByIdAndUpdate(req.user._id, { email }, { new: true, runValidators: true });
      }
    }

    // Return the updated user details with a possible email conflict message
    const finalUser = await User.findById(req.user._id).select('-password -plainPassword'); // Exclude sensitive fields
    res.json({
      user: finalUser,
      message: emailConflictMessage || 'User profile updated successfully',
    });
  } catch (error) {
    if (error.code === 11000) { // Duplicate key error code
      return res.status(400).json({ message: 'Duplicate key error' });
    }
    res.status(400).json({ error: error.message });
  }
};




exports.searchAlumni = async (req, res) => {
  try {
    const { name, graduationYear, fieldOfStudy } = req.query;

    let query = {};

    if (name) {
      query.name = { $regex: name, $options: "i" }; // Case-insensitive regex search
    }

    if (graduationYear) {
      query.graduationYear = graduationYear;
    }

    if (fieldOfStudy) {
      query.fieldOfStudy = { $regex: fieldOfStudy, $options: "i" }; // Case-insensitive regex search
    }

    const alumni = await User.find(query);
    res.json(alumni);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin-only example
exports.adminDashboard = (req, res) => {
  res.send("Admin Dashboard - Access Granted");
};
