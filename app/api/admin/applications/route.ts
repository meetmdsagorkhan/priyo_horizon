import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const applications = await prisma.application.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        payment: true,
      },
    });

    return NextResponse.json(applications);
  } catch (error) {
    console.error("Failed to fetch applications:", error);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}
