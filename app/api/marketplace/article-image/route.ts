import { NextResponse } from "next/server";
import { verifyPublishRequest } from "@/lib/publish-auth";
import {
  ARTICLE_IMAGE_BUCKET,
  buildArticleImageStoragePath,
  publicArticleImageUrl,
  validateArticleImageFile,
} from "@/lib/article-image";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSupabaseUrl } from "@/lib/supabase/config";

export async function POST(request: Request) {
  const publishAuth = await verifyPublishRequest(request);
  if (!publishAuth) {
    return NextResponse.json(
      { error: "Connect your wallet and sign to upload images" },
      { status: 401 },
    );
  }

  const supabase = getAdminClient();
  const supabaseUrl = getSupabaseUrl();
  if (!supabase || !supabaseUrl) {
    return NextResponse.json({ error: "Image uploads are not configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "Missing image file" }, { status: 400 });
  }

  const validationError = validateArticleImageFile(fileValue);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const storagePath = buildArticleImageStoragePath(
    publishAuth.connectedWallet,
    fileValue.type,
  );
  if (!storagePath) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  const bytes = Buffer.from(await fileValue.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(ARTICLE_IMAGE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: fileValue.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[article-image] Upload failed:", uploadError.message);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }

  const url = publicArticleImageUrl(supabaseUrl, storagePath);
  return NextResponse.json({ url, path: storagePath });
}