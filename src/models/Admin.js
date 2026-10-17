import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Admin =
  mongoose.models.Admin ||
  mongoose.model("Admin", AdminSchema);

export default Admin;