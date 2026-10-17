
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeaveRequest from "@/models/LeaveRequest";

export async function GET() {
  try {
    await connectDB();

    const requests = await LeaveRequest.find({})
      .sort({ createdAt: -1 });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Fetch leave requests error:", error);

    return NextResponse.json(
      { message: "Failed to fetch leave requests" },
      { status: 500 }
    );
  }
}
