import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Message from "@/models/Message";

export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { message: "User ID is required" },
        { status: 400 }
      );
    }

    const messages = await Message.find({
      $or: [
        {
          senderId: userId,
          receiverId: "Admin",
        },
        {
          senderId: "Admin",
          receiverId: userId,
        },
      ],
    }).sort({ createdAt: 1 });

    return NextResponse.json({
      messages,
    });
  } catch (error) {
    console.error("Fetch messages error:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch messages",
      },
      { status: 500 }
    );
  }
}