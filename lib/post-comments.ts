import { getAdminClient } from "@/lib/supabase/admin";
import { isCreatorOwnedPost } from "@/lib/citation-creator-access";
import { getPriorUnlockIdsForWallets } from "@/lib/citation-prior-unlock";
import { getCreatorContentById, type CreatorContent } from "@/lib/citations";
import { formatUsernameDisplay } from "@/lib/username";
import type { PlatformProfile } from "@/lib/platform-profile";

export type PostComment = {
  id: string;
  postId: string;
  parentId: string | null;
  username: string;
  body: string;
  createdAt: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  platform_profiles: { username: string } | { username: string }[] | null;
};

function rowToComment(row: CommentRow): PostComment | null {
  const profile = Array.isArray(row.platform_profiles)
    ? row.platform_profiles[0]
    : row.platform_profiles;
  if (!profile?.username) return null;

  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id ?? null,
    username: profile.username,
    body: row.body.trim(),
    createdAt: row.created_at,
  };
}

export async function listCommentsForPost(postId: string): Promise<PostComment[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, parent_id, body, created_at, platform_profiles (username)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("[post-comments] list failed:", error?.message);
    return [];
  }

  return (data as CommentRow[])
    .map(rowToComment)
    .filter((row): row is PostComment => row !== null);
}

export async function getCommentCountsForPosts(
  postIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (postIds.length === 0) return result;

  const supabase = getAdminClient();
  if (!supabase) return result;

  const { data, error } = await supabase
    .from("post_comments")
    .select("post_id")
    .in("post_id", postIds);

  if (error || !data) return result;

  for (const row of data) {
    const id = row.post_id as string;
    result.set(id, (result.get(id) ?? 0) + 1);
  }
  return result;
}

export type AddCommentResult =
  | { ok: true; comment: PostComment }
  | { ok: false; error: string; status: number };

/** True when any viewer wallet paid to unlock or published the post. */
export async function canCommentOnPost(
  post: CreatorContent,
  viewerWallets: Set<string>,
): Promise<boolean> {
  if (viewerWallets.size === 0) return false;
  if (isCreatorOwnedPost(post, viewerWallets)) return true;
  const unlocked = await getPriorUnlockIdsForWallets(viewerWallets, [post.id]);
  return unlocked.has(post.id);
}

async function getCommentById(commentId: string): Promise<{
  id: string;
  post_id: string;
  parent_id: string | null;
} | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, parent_id")
    .eq("id", commentId)
    .maybeSingle();

  if (error || !data) return null;
  return data as { id: string; post_id: string; parent_id: string | null };
}

export async function addComment(params: {
  postId: string;
  profile: PlatformProfile;
  viewerWallets: Set<string>;
  body: string;
  parentId?: string | null;
}): Promise<AddCommentResult> {
  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Comments are not configured", status: 503 };
  }

  const postId = params.postId.trim();
  if (!postId) {
    return { ok: false, error: "Missing post id", status: 400 };
  }

  const body = params.body.trim();
  if (body.length < 1) {
    return { ok: false, error: "Comment cannot be empty", status: 400 };
  }
  if (body.length > 2000) {
    return { ok: false, error: "Comment must be 2000 characters or fewer", status: 400 };
  }

  const post = await getCreatorContentById(postId);
  if (!post) {
    return { ok: false, error: "Post not found", status: 404 };
  }

  const allowed = await canCommentOnPost(post, params.viewerWallets);
  if (!allowed) {
    return {
      ok: false,
      error: "Unlock this post before commenting",
      status: 403,
    };
  }

  let parentId: string | null = params.parentId?.trim() || null;
  if (parentId) {
    const parent = await getCommentById(parentId);
    if (!parent) {
      return { ok: false, error: "Parent comment not found", status: 404 };
    }
    if (parent.post_id !== postId) {
      return {
        ok: false,
        error: "Reply must be on the same post",
        status: 400,
      };
    }
  } else {
    parentId = null;
  }

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      profile_id: params.profile.id,
      parent_id: parentId,
      body,
    })
    .select("id, post_id, parent_id, body, created_at")
    .single();

  if (error || !data) {
    console.error("[post-comments] insert failed:", error?.message);
    return { ok: false, error: "Failed to save comment", status: 500 };
  }

  return {
    ok: true,
    comment: {
      id: data.id as string,
      postId: data.post_id as string,
      parentId: (data.parent_id as string | null) ?? null,
      username: params.profile.username,
      body: data.body as string,
      createdAt: data.created_at as string,
    },
  };
}

export function commentAuthorLabel(username: string): string {
  return formatUsernameDisplay(username);
}