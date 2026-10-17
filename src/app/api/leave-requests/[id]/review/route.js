
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import LeaveRequest from "@/models/LeaveRequest";

export async function POST(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;
    const { status } = await request.json();

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { message: "Invalid request ID" },
        { status: 400 }
      );
    }

    if (!["Approved", "Rejected"].includes(status)) {
      return NextResponse.json(
        { message: "Invalid status" },
        { status: 400 }
      );
    }

    const updatedRequest = await LeaveRequest.findOneAndUpdate(
      { _id: id, status: "Pending" },
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!updatedRequest) {
      return NextResponse.json(
        { message: "Request not found or already reviewed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: `Leave request ${status.toLowerCase()}`,
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Review leave request error:", error);

    return NextResponse.json(
      { message: "Failed to review leave request" },
      { status: 500 }
    );
  }
}
