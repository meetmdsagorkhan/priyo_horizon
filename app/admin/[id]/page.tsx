import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminApplicationView } from "@/components/admin/admin-application-view";

export const dynamic = "force-dynamic";

export default async function AdminApplicationDetailsPage({
  params,
}: {
  params: { id: string };
}) {
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
    notFound();
  }

  return <AdminApplicationView application={application} />;
}
