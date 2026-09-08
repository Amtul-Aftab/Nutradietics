"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorBanner } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";

export function AvatarUpload({
  initialUrl,
  name,
}: {
  initialUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/professionals/me/avatar", {
      method: "POST",
      body,
    });
    setUploading(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Unable to upload the photo.");
      return;
    }
    const d = await res.json();
    setUrl(d.avatarUrl);
    toast("Profile photo updated.");
    router.refresh();
  }

  return (
    <div className="avatar-upload">
      <Avatar url={url} name={name} size={96} />
      <div>
        {error && (
          <ErrorBanner title="Upload failed">
            <p>{error}</p>
          </ErrorBanner>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          hidden
        />
        <Button
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          loading={uploading}
        >
          {url ? "Change photo" : "Upload photo"}
        </Button>
        <p className="appointment__hint">
          A single profile photo shown to clients. JPEG, PNG, WebP, or GIF.
        </p>
      </div>
    </div>
  );
}
