import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Message from "@/models/Message";

export async function GET() {
  try {
    await connectDB();

    const messages = await Message.find({
      $or: [
        {
          senderId: "Admin",
        },
        {
          receiverId: "Admin",
        },
      ],
    }).sort({ createdAt: 1 });

    return NextResponse.json({
      messages,
    });
  } catch (error) {
    console.error("Fetch admin messages error:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch messages",
      },
      { status: 500 }
    );
  }
}