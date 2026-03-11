"use client";

import { useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import {
  Paperclip,
  Upload,
  Trash2,
  FileText,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
  FolderOpen,
} from "lucide-react";

const CATEGORIES = [
  { id: "bank_statement", label: "Bank Statements" },
  { id: "tds_certificate", label: "TDS Certificates" },
  { id: "gst_return", label: "GST Returns" },
  { id: "other", label: "Other Documents" },
] as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  return <FileText className="h-4 w-4 text-gray-500" />;
}

export default function DocumentsPage() {
  const { activeCompanyId } = useCompanyStore();
  const [activeCategory, setActiveCategory] = useState<string>("bank_statement");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const utils = trpc.useUtils();

  const { data: documents, isLoading } = trpc.attachment.listDocuments.useQuery(
    { companyId: activeCompanyId!, category: activeCategory },
    { enabled: !!activeCompanyId }
  );

  const deleteMutation = trpc.attachment.delete.useMutation({
    onSuccess: () => utils.attachment.listDocuments.invalidate({ companyId: activeCompanyId!, category: activeCategory }),
  });

  const uploadFile = useCallback(
    async (file: File) => {
      if (!activeCompanyId) return;
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("companyId", activeCompanyId);
        formData.append("entityType", "document");
        formData.append("entityId", activeCategory);
        const res = await fetch("/api/attachments", { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json(); alert(err.error || "Upload failed"); }
        else { utils.attachment.listDocuments.invalidate({ companyId: activeCompanyId!, category: activeCategory }); }
      } catch { alert("Upload failed"); }
      finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    },
    [activeCompanyId, activeCategory, utils]
  );

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (file) uploadFile(file); }
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) uploadFile(file); }, [uploadFile]);

  if (!activeCompanyId) return <div className="flex items-center justify-center h-64"><p className="text-sm text-gray-500">Select a company to view documents.</p></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload and manage bank statements, TDS certificates, and other documents.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeCategory === cat.id ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{cat.label}</button>
        ))}
      </div>

      <div className="bg-white rounded-lg border">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Paperclip className="h-4 w-4 text-gray-400" />
            {CATEGORIES.find((c) => c.id === activeCategory)?.label}
            {documents && documents.length > 0 && <span className="text-xs font-normal bg-gray-100 rounded-full px-2 py-0.5 text-gray-500">{documents.length}</span>}
          </div>
          <div>
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.xls,.doc,.docx,.csv,.txt" onChange={handleFileInput} />
            <Button variant="outline" size="sm" className="h-8" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"} ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}>
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <p className="text-sm text-gray-500">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className={`h-8 w-8 ${dragOver ? "text-blue-500" : "text-gray-300"}`} />
                <p className="text-sm text-gray-500">{dragOver ? "Drop file here" : "Drag & drop a file here, or click to browse"}</p>
                <p className="text-xs text-gray-400">PDF, images, Excel, Word, CSV (max 10MB)</p>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : documents && documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-md border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
                  {getFileIcon(doc.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(doc.fileSize)} &middot; {new Date(doc.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1">
                    <a href={`/api/attachments/${doc.id}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-600" title="View"><ExternalLink className="h-3.5 w-3.5" /></Button>
                    </a>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" title="Delete" onClick={() => { if (confirm("Delete this document?")) deleteMutation.mutate({ id: doc.id }); }} disabled={deleteMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-3"><FolderOpen className="h-6 w-6 text-gray-300" /></div>
              <p className="text-sm text-gray-500">No documents uploaded yet</p>
              <p className="text-xs text-gray-400 mt-1">Upload files using the button above or drag & drop</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
