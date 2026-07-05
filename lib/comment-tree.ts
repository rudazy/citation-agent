export type FlatComment = {
  id: string;
  postId: string;
  parentId: string | null;
  username: string;
  body: string;
  createdAt: string;
};

export type CommentNode = FlatComment & {
  replies: CommentNode[];
};

/** Build a nested tree from a flat comment list (ordered oldest-first per branch). */
export function buildCommentTree(comments: FlatComment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, replies: [] });
  }

  for (const comment of comments) {
    const node = nodes.get(comment.id);
    if (!node) continue;

    if (comment.parentId && nodes.has(comment.parentId)) {
      nodes.get(comment.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Total comments including replies. */
export function countComments(comments: FlatComment[]): number {
  return comments.length;
}