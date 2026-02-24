import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    // 🔥 Performance Analytics (ML Friendly)
    totalInterviews: {
      type: Number,
      default: 0,
    },

    averagePerformance: {
      type: Number,
      default: 0,
    },

    interviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Interview",
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
