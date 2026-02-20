import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { storage } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attachment = await db.attachment.findUnique({
      where: { id: params.id },
    });

    if (!attachment || attachment.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // For object storage, redirect to a signed URL (avoids proxying bytes through the server)
    if (storage.driver === "object") {
      const url = await storage.signedUrl(attachment.storagePath, 300);
      if (url) {
        return NextResponse.redirect(url);
      }
    }

    // Local storage: read and serve directly
    const fileBuffer = await storage.download(attachment.storagePath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${attachment.fileName}"`,
        "Content-Length": String(attachment.fileSize),
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
