import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { storage } from "@/lib/storage";
import { uploadLimiter } from "@/lib/rate-limit";
import crypto from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/plain",
];

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit by user
    const rl = uploadLimiter.check(`upload:${session.user.id}`);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Upload rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const companyId = formData.get("companyId") as string | null;
    const entityType = formData.get("entityType") as string | null;
    const entityId = formData.get("entityId") as string | null;

    if (!file || !companyId || !entityType || !entityId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify user is a member of this company
    const membership = await db.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: session.user.id as string,
        },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Validate entity type
    if (!["invoice", "vendor_bill"].includes(entityType)) {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    // Validate mime type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    // Sanitize filename: only allow safe characters
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const storedName = `${uniqueId}_${safeName}`;

    // Storage key: companyId/entityType/uniqueId_filename
    const storageKey = `${companyId}/${entityType}/${storedName}`;

    // Write file via storage adapter
    const buffer = Buffer.from(await file.arrayBuffer());
    await storage.upload(storageKey, buffer, file.type);

    // Create DB record
    const attachment = await db.attachment.create({
      data: {
        companyId,
        entityType,
        entityId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath: storageKey,
        uploadedBy: session.user.id as string,
      },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
