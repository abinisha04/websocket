import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import Admin from "@/models/Admin";

export async function POST(request) {
  try {
    await connectDB();

    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      return NextResponse.json(
        { message: "Admin already exists" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      userId: crypto.randomUUID(),
      name,
      email,
      passwordHash,
      role: "admin",
    });

    return NextResponse.json({
      message: "Admin created successfully",
      userId: admin.userId,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Failed to create admin" },
      { status: 500 }
    );
  }
}