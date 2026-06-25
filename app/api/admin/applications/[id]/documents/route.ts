import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocumentStatus, type DocumentType } from "@prisma/client";
import { saveDocumentMeta } from "@/lib/launch-repository";
import { createDocumentUploadUrl, isS3Configured } from "@/lib/storage";
import { slugifyFileName } from "@/lib/utils";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const application = await prisma.application.findUnique({
      where: { id: params.id },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const body = await request.json();
    const { documentType, fileName, mimeType, size } = body;

    if (!documentType || !fileName || !mimeType || size === undefined) {
      return NextResponse.json({ error: "Missing required document fields" }, { status: 400 });
    }

    const storageKey = `${application.draftToken}/${documentType}/${Date.now()}-${slugifyFileName(fileName)}`;

    if (!isS3Configured()) {
      const document = await saveDocumentMeta({
        draftToken: application.draftToken,
        type: documentType as DocumentType,
        fileName,
        mimeType,
        size,
        storageKey,
        uploadStatus: DocumentStatus.uploaded, // skip pending for mock
      });

      return NextResponse.json({ mockUpload: true, document });
    }

    const signedUrl = await createDocumentUploadUrl({
      bucket: process.env.S3_BUCKET!,
      key: storageKey,
      contentType: mimeType,
    });

    const document = await saveDocumentMeta({
      draftToken: application.draftToken,
      type: documentType as DocumentType,
      fileName,
      mimeType,
      size,
      storageKey,
      uploadStatus: DocumentStatus.pending_upload,
    });

    return NextResponse.json({ mockUpload: false, signedUrl, document });
  } catch (error) {
    console.error("Failed to prepare admin document upload:", error);
    return NextResponse.json({ error: "Unable to prepare upload." }, { status: 500 });
  }
}
