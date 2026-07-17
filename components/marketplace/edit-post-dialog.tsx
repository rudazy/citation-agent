"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArticleBodyEditor } from "@/components/marketplace/article-body-editor";
import { resolveCatalogAuthHeaders } from "@/lib/citation-catalog-auth";
import { tryPublisherCitationAccess } from "@/lib/citation-unlock-client";
import { publishHeaders, signPublishAuth } from "@/lib/publish-client";
import { getEthereumProvider } from "@/lib/wallet-connection-client";

export type EditablePost = {
  id: string;
  title: string;
  subheading?: string;
  price_usdc: string;
  tags?: string[];
  cover_image_url?: string | null;
};

type Props = {
  post: EditablePost;
  connected: `0x${string}`;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

/**
 * Edit a published post. The previous content is version-snapshotted
 * server-side, so buyers see an explicit "Updated vN" changelog — edits are
 * never silent.
 */
export function EditPostDialog({ post, connected, open, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(post.title);
  const [subheading, setSubheading] = useState(post.subheading ?? "");
  const [body, setBody] = useState("");
  const [priceUsdc, setPriceUsdc] = useState(post.price_usdc);
  const [tags, setTags] = useState((post.tags ?? []).join(", "));
  const [coverImageUrl, setCoverImageUrl] = useState(post.cover_image_url ?? "");
  const [changeNote, setChangeNote] = useState("");
  const [loadingBody, setLoadingBody] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load the current body via publisher access when the dialog opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingBody(true);
    void (async () => {
      try {
        const authHeaders = await resolveCatalogAuthHeaders({ signIfMissing: true });
        const access = await tryPublisherCitationAccess(post.id, authHeaders);
        if (!cancelled && access?.status === "ok") {
          setBody(access.body);
        } else if (!cancelled) {
          toast.error("Could not load the post body", {
            description: "Sign the publisher check with the wallet that published this post.",
          });
        }
      } finally {
        if (!cancelled) setLoadingBody(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, post.id]);

  const save = useCallback(async () => {
    if (!body.trim()) {
      toast.error("Post body is empty — wait for it to load or write new content");
      return;
    }
    setSaving(true);
    try {
      const provider = await getEthereumProvider();
      if (!provider) throw new Error("Connect the wallet that published this post");

      const payload = {
        title,
        subheading,
        body,
        priceUsdc,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        coverImageUrl: coverImageUrl.trim() || undefined,
      };

      const auth = await signPublishAuth(provider, connected, payload);
      const res = await fetch("/api/marketplace/citations", {
        method: "PATCH",
        headers: publishHeaders(auth),
        body: JSON.stringify({
          id: post.id,
          title: payload.title,
          subheading: payload.subheading,
          body: payload.body,
          price_usdc: payload.priceUsdc,
          tags: payload.tags,
          cover_image_url: payload.coverImageUrl,
          change_note: changeNote.trim() || undefined,
        }),
      });

      let data: { error?: string; post?: { edit_version?: number } } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        // handled below via res.ok
      }
      if (!res.ok) throw new Error(data.error ?? `Edit failed (${res.status})`);

      toast.success("Post updated", {
        description: `Now v${data.post?.edit_version ?? "?"} — readers see the edit history`,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      if ((err as { code?: number }).code === 4001) {
        toast.message("Signature cancelled");
        return;
      }
      toast.error("Could not save the edit", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }, [body, changeNote, connected, coverImageUrl, onClose, onSaved, post.id, priceUsdc, subheading, tags, title]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#1f1f1f] bg-[#0a0a0a] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 tracking-wide">
            <PencilLine size={16} className="text-[#f5c842]" />
            Edit post
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-[#666]">
            Edits are versioned. Buyers keep access and see an &quot;Updated&quot; changelog entry.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title" className="font-mono text-xs text-[#888]">
              Title
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-[#333] bg-[#111] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-subheading" className="font-mono text-xs text-[#888]">
              Teaser
            </Label>
            <Input
              id="edit-subheading"
              value={subheading}
              onChange={(e) => setSubheading(e.target.value)}
              className="border-[#333] bg-[#111] font-mono text-sm"
            />
          </div>

          {loadingBody ? (
            <div className="flex items-center gap-2 py-6 font-mono text-xs text-[#666]">
              <Loader2 size={14} className="animate-spin" />
              Loading post body…
            </div>
          ) : (
            <ArticleBodyEditor
              id="edit-body"
              value={body}
              onChange={setBody}
              connected={connected}
              disabled={saving}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-price" className="font-mono text-xs text-[#888]">
                Price (USDC)
              </Label>
              <Input
                id="edit-price"
                inputMode="decimal"
                value={priceUsdc}
                onChange={(e) => setPriceUsdc(e.target.value)}
                className="border-[#333] bg-[#111] font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tags" className="font-mono text-xs text-[#888]">
                Tags
              </Label>
              <Input
                id="edit-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="border-[#333] bg-[#111] font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-cover" className="font-mono text-xs text-[#888]">
              Cover image URL (optional)
            </Label>
            <Input
              id="edit-cover"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://…"
              className="border-[#333] bg-[#111] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-note" className="font-mono text-xs text-[#888]">
              What changed (shown in the public edit history)
            </Label>
            <Input
              id="edit-note"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Fixed a typo in the methodology section"
              maxLength={280}
              className="border-[#333] bg-[#111] font-mono text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="border-[#333]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving || loadingBody}
              className="bg-[#f5c842] text-[#0a0a0a] hover:bg-[#f5c842]/90"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Signing…
                </>
              ) : (
                "Sign and save"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
