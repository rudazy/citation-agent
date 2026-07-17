import { NextResponse, type NextRequest } from "next/server";
import { getPublishedPostById, listPostVersionMeta } from "@/lib/creator-posts";

/** Public edit changelog for a post — metadata only, never historical bodies. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const post = await getPublishedPostById(id);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const versions = await listPostVersionMeta(id);
  return NextResponse.json({
    id,
    currentVersion: post.editVersion ?? 1,
    lastEditedAt: post.lastEditedAt ?? null,
    versions,
  });
}
