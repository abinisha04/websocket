
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeaveRequest from "@/models/LeaveRequest";

export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { message: "userId is required" },
        { status: 400 }
      );
    }

    const requests = await LeaveRequest.find({ userId })
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

export async function POST(request) {
  try {
    await connectDB();

    const { userId, userName, startDate, endDate, reason } =
      await request.json();

    if (
      !userId ||
      !userName ||
      !startDate ||
      !endDate ||
      typeof reason !== "string" ||
      !reason.trim()
    ) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate date-only values in YYYY-MM-DD format.
    const validDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    if (
      !validDate(startDate) ||
      !validDate(endDate) ||
      startDate > endDate
    ) {
      return NextResponse.json(
        { message: "Please provide valid leave dates" },
        { status: 400 }
      );
    }

    const leaveRequest = await LeaveRequest.create({
      userId,
      userName,
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: new Date(`${endDate}T00:00:00.000Z`),
      reason: reason.trim(),
      status: "Pending",
    });

    return NextResponse.json(
      {
        message: "Leave request submitted",
        request: leaveRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create leave request error:", error);

    return NextResponse.json(
      { message: "Failed to submit leave request" },
      { status: 500 }
    );
  }
}
