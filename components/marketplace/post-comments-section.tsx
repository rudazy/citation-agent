"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UsernameSetupForm } from "@/components/marketplace/username-setup-form";
import { fetchWithRetry } from "@/lib/client-fetch";
import { fetchProfile, type ProfileStatus } from "@/lib/profile-client";
import { buildCommentTree, type CommentNode, type FlatComment } from "@/lib/comment-tree";
import { formatUsernameDisplay } from "@/lib/username";
import { formatPaymentDate } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

type Props = {
  postId: string;
  initialCount?: number;
  unlocked: boolean;
};

type PendingSubmit = {
  text: string;
  parentId: string | null;
};

function CommentComposer({
  placeholder,
  submitLabel,
  disabled,
  posting,
  onSubmit,
}: {
  placeholder: string;
  submitLabel: string;
  disabled?: boolean;
  posting: boolean;
  onSubmit: (text: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div className="space-y-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder={placeholder}
        disabled={disabled || posting}
        className={cn(
          "w-full rounded border border-[#333] bg-[#111] px-3 py-2 font-mono text-xs text-[#f5f5f5]",
          "placeholder:text-[#555] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5c842]/40",
        )}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={posting || !draft.trim() || disabled}
        onClick={() => {
          const text = draft.trim();
          if (!text) return;
          void Promise.resolve(onSubmit(text)).then(() => setDraft(""));
        }}
        className="border-[#f5c842]/35 font-mono text-xs text-[#f5c842] hover:bg-[#f5c842]/10"
      >
        {posting ? (
          <>
            <Loader2 size={14} className="animate-spin mr-1" />
            Posting…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </div>
  );
}

function CommentThreadItem({
  comment,
  depth,
  replyingToId,
  posting,
  onReplyClick,
  onCancelReply,
  onSubmitReply,
}: {
  comment: CommentNode;
  depth: number;
  replyingToId: string | null;
  posting: boolean;
  onReplyClick: (id: string) => void;
  onCancelReply: () => void;
  onSubmitReply: (parentId: string, text: string) => void | Promise<void>;
}) {
  const isReplying = replyingToId === comment.id;

  return (
    <li className={cn("space-y-2", depth > 0 && "ml-3 border-l border-[#1f1f1f] pl-3")}>
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-[#666]">
          <span className="text-[#f5c842]">{formatUsernameDisplay(comment.username)}</span>
          <span>{formatPaymentDate(comment.createdAt)}</span>
          <button
            type="button"
            onClick={() => (isReplying ? onCancelReply() : onReplyClick(comment.id))}
            className="text-[#888] hover:text-[#f5c842] transition-colors"
          >
            {isReplying ? "Cancel" : "Reply"}
          </button>
        </div>
        <p className="font-mono text-xs leading-relaxed text-[#c8c8c8] whitespace-pre-wrap">
          {comment.body}
        </p>
      </div>

      {isReplying && (
        <CommentComposer
          placeholder={`Reply to ${formatUsernameDisplay(comment.username)}…`}
          submitLabel="Post reply"
          posting={posting}
          onSubmit={(text) => onSubmitReply(comment.id, text)}
        />
      )}

      {comment.replies.length > 0 && (
        <ul className="space-y-2.5">
          {comment.replies.map((reply) => (
            <CommentThreadItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              replyingToId={replyingToId}
              posting={posting}
              onReplyClick={onReplyClick}
              onCancelReply={onCancelReply}
              onSubmitReply={onSubmitReply}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function PostCommentsSection({ postId, initialCount = 0, unlocked }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [comments, setComments] = useState<FlatComment[]>([]);
  const [count, setCount] = useState(initialCount);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmit | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry(
        `/api/marketplace/comments?postId=${encodeURIComponent(postId)}`,
      );
      const data = (await res.json()) as {
        comments?: FlatComment[];
        count?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Failed to load comments (${res.status})`);
      }
      const rows = data.comments ?? [];
      setComments(rows);
      setCount(data.count ?? rows.length);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const status = await fetchProfile();
      setProfile(status);
      return status;
    } catch {
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    void loadComments();
  }, [open, loaded, loadComments]);

  useEffect(() => {
    if (!unlocked || !open) return;
    void loadProfile();
  }, [unlocked, open, loadProfile]);

  async function submitComment(
    text: string,
    options: { parentId?: string | null; username?: string } = {},
  ) {
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          postId,
          body: text,
          ...(options.parentId ? { parentId: options.parentId } : {}),
          ...(options.username ? { username: options.username } : {}),
        }),
      });
      const data = (await res.json()) as {
        comment?: FlatComment;
        error?: string;
        code?: string;
      };
      if (res.status === 403 && data.code === "USERNAME_REQUIRED") {
        setNeedsUsername(true);
        setPendingSubmit({ text, parentId: options.parentId ?? null });
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? `Failed to post comment (${res.status})`);
      }
      if (data.comment) {
        setComments((prev) => [...prev, data.comment!]);
        setCount((n) => n + 1);
      }
      setPendingSubmit(null);
      setNeedsUsername(false);
      setReplyingToId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  if (!unlocked) return null;

  return (
    <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#a3a3a3]">
          <MessageSquare size={14} className="text-[#f5c842]" />
          Comments ({count})
        </span>
        <ChevronDown
          size={14}
          className={cn("text-[#666] transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-[#1f1f1f] px-3 py-3">
          {loading && (
            <div className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
              <Loader2 size={12} className="animate-spin" />
              Loading comments…
            </div>
          )}

          {!loading && comments.length === 0 && (
            <p className="font-mono text-[10px] text-[#666]">No comments yet.</p>
          )}

          <ul className="space-y-2.5">
            {commentTree.map((comment) => (
              <CommentThreadItem
                key={comment.id}
                comment={comment}
                depth={0}
                replyingToId={replyingToId}
                posting={posting}
                onReplyClick={setReplyingToId}
                onCancelReply={() => setReplyingToId(null)}
                onSubmitReply={(parentId, text) => submitComment(text, { parentId })}
              />
            ))}
          </ul>

          {needsUsername && (
            <div className="rounded border border-[#f5c842]/20 bg-[#111] px-3 py-3 space-y-2">
              <p className="font-mono text-[10px] text-[#888]">
                Choose a username to post your comment.
              </p>
              <UsernameSetupForm
                compact
                profile={profile}
                submitLabel="Save and comment"
                onSaved={async (saved) => {
                  setProfile(saved);
                  setNeedsUsername(false);
                  if (pendingSubmit?.text.trim()) {
                    await submitComment(pendingSubmit.text, {
                      parentId: pendingSubmit.parentId,
                      username: saved.username ?? undefined,
                    });
                  }
                }}
              />
            </div>
          )}

          {!needsUsername && (
            <div className="space-y-2 border-t border-[#1f1f1f] pt-3">
              {profile?.displayName && (
                <p className="font-mono text-[10px] text-[#666]">
                  Posting as {profile.displayName}
                </p>
              )}
              <CommentComposer
                placeholder="Add a comment…"
                submitLabel="Post comment"
                posting={posting}
                disabled={profileLoading}
                onSubmit={(text) => submitComment(text)}
              />
            </div>
          )}

          {error && <p className="font-mono text-[10px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}