import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  try {
    await connectDB();

    const allUsers = await User.find({});

    console.log("ALL USERS IN ADMIN DB:", allUsers);

    const users = await User.find(
      { role: "user" },
      {
        userId: 1,
        name: 1,
        email: 1,
        role: 1,
      }
    );

    console.log("USER ROLE MATCH:", users);

    return NextResponse.json({
      users,
    });
  } catch (error) {
    console.error("Fetch users error:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch users",
        error: error.message,
      },
      { status: 500 }
    );
  }
}