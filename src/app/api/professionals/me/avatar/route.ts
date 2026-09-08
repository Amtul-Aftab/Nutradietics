import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireProfessional } from "@/lib/professional";
import {
  isAllowedImageType,
  uploadAvatar,
  StorageNotConfiguredError,
} from "@/lib/storage";

export const runtime = "nodejs";

// Upload/replace the current professional's profile photo (Req 15).
export async function POST(request: Request) {
  try {
    const { professional } = await requireProfessional();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Expected a multipart form upload." },
        { status: 400 },
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!isAllowedImageType(file.type)) {
      return NextResponse.json(
        { error: "Please upload an image file (JPEG, PNG, WebP, or GIF)." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const url = await uploadAvatar(professional.id, bytes, file.type);

    const updated = await prisma.professional.update({
      where: { id: professional.id },
      data: { avatarUrl: url },
    });

    return NextResponse.json({ avatarUrl: updated.avatarUrl });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return NextResponse.json(
        { error: "Photo uploads are not available right now." },
        { status: 503 },
      );
    }
    return authErrorResponse(error);
  }
}
