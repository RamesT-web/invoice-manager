"use client";

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Paperclip, Upload, Trash2, FileText, Image as ImageIcon, Loader2, ExternalLink } from "lucide-react";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-gray-500" />;
}

interface AttachmentPanelProps {
  entityType: "invoice" | "vendor_bill";
  entityId: string;
}

export function AttachmentPanel({ entityType, entityId }: AttachmentPanelProps) {
  const { activeCompanyId } = useCompanyStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();

  const { data: attachments, isLoading } = trpc.attachment.list.useQuery(
    { entityType, entityId },
    { enabled: !!entityId }
  );

  const deleteMutation = trpc.attachment.delete.useMutation({
    onSuccess: () => utils.attachment.list.invalidate({ entityType, entityId }),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeCompanyId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("companyId", activeCompanyId);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);

      const res = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Upload failed");
      } else {
        utils.attachment.list.invalidate({ entityType, entityId });
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Attachments
            {attachments && attachments.length > 0 && (
              <span className="text-xs font-normal bg-muted rounded-full px-2 py-0.5">
                {attachments.length}
              </span>
            )}
          </CardTitle>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.xls,.doc,.docx,.csv,.txt"
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Upload className="h-3.5 w-3.5 mr-1" />
              )}
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !attachments?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No attachments yet. Upload PDFs, images, or documents.
          </p>
        ) : (
          <div className="space-y-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-3 p-2 rounded-md border bg-muted/30 hover:bg-muted/50"
              >
                {getFileIcon(att.mimeType)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(att.fileSize)}</p>
                </div>
                <div className="flex gap-1">
                  <a
                    href={`/api/attachments/${att.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="View">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    title="Delete"
                    onClick={() => {
                      if (confirm("Delete this attachment?")) {
                        deleteMutation.mutate({ id: att.id });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
