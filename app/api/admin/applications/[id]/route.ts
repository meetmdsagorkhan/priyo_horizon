import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus } from "@prisma/client";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const application = await prisma.application.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        payment: true,
        documents: true,
        owners: true,
        services: true,
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error("Failed to fetch application:", error);
    return NextResponse.json({ error: "Failed to fetch application" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Only allow updating status for now
    if (!body.status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    const application = await prisma.application.update({
      where: { id: params.id },
      data: {
        status: body.status as ApplicationStatus,
      },
    });

    return NextResponse.json(application);
  } catch (error) {
    console.error("Failed to update application:", error);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}
