"use client";

import React, { useEffect, useMemo, useState, ChangeEvent, DragEvent, FormEvent } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Trash2 as TrashIcon,
  Info as InfoIcon,
  PlayCircle,
  Camera,
  Music2,
  X,
  ImageIcon,
  CheckCircle2,
} from "lucide-react";

// NEW: SweetAlert2
import Swal from "sweetalert2";

// Small reusable toast helper
const toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  didOpen: (t) => {
    t.addEventListener("mouseenter", Swal.stopTimer);
    t.addEventListener("mouseleave", Swal.resumeTimer);
  },
});

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type Platform = "youtube" | "instagram" | "tiktok";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_FILES = 1;
const MAX_FILES = 5;

const PLATFORM_META: Record<
  Platform,
  { title: string; description: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  youtube: {
    title: "YouTube Email Screenshots",
    description: "Upload 1-5 clear screenshots of YouTube-related emails with timestamps visible.",
    icon: <PlayCircle className="h-5 w-5" />,
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
  },
  instagram: {
    title: "Instagram Email Screenshots",
    description: "Upload 1-5 clear screenshots of Instagram-related emails with timestamps visible.",
    icon: <Camera className="h-5 w-5" />,
    color: "text-pink-600",
    bgColor: "bg-pink-50 border-pink-200",
  },
  tiktok: {
    title: "TikTok Email Screenshots",
    description: "Upload 1-5 clear screenshots of TikTok-related emails with timestamps visible.",
    icon: <Music2 className="h-5 w-5" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200",
  },
};

const formatMB = (bytes?: number) =>
  typeof bytes === "number" && isFinite(bytes) ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : "";

// -----------------------------------------------------------------------------
// Platform Upload Component
// -----------------------------------------------------------------------------
function PlatformUpload({
  platform,
  disabled = false,
  onSubmit,
}: {
  platform: Platform;
  disabled?: boolean;
  onSubmit?: (files: File[]) => Promise<void> | void;
}) {
  const meta = PLATFORM_META[platform];

  const [files, setFiles] = useState<File[]>([]);
  const [, setErrors] = useState<string[]>([]); // not rendered; we use toasts instead
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) return "Unsupported file type";
    if (file.size > MAX_SIZE) return "File too large (>10MB)";
    return null;
  };

  const addFiles = (newFiles: FileList | File[]) => {
    if (disabled || submitting) return;

    const incoming = Array.from(newFiles);
    const remaining = MAX_FILES - files.length;

    if (remaining <= 0) {
      toast.fire({ icon: "info", title: `Limit reached (${MAX_FILES} files)` });
      return;
    }

    // Enforce remaining capacity
    const slice = incoming.slice(0, remaining);
    if (incoming.length > slice.length) {
      toast.fire({ icon: "info", title: `You can add only ${remaining} more file${remaining === 1 ? "" : "s"}` });
    }

    const accepted: File[] = [];
    let rejectedCount = 0;

    slice.forEach((file) => {
      const err = validateFile(file);
      if (err) {
        rejectedCount += 1;
      } else {
        accepted.push(file);
      }
    });

    if (rejectedCount > 0) {
      toast.fire({ icon: "error", title: `${rejectedCount} file${rejectedCount === 1 ? "" : "s"} rejected (type/size)` });
    }

    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted]);
      setErrors([]);
      toast.fire({ icon: "success", title: `Added ${accepted.length} file${accepted.length === 1 ? "" : "s"}` });
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
    // Reset to allow re-selecting same file
    e.target.value = "";
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled || submitting) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !submitting) setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const removed = prev[index]?.name;
      const next = prev.filter((_, i) => i !== index);
      if (removed) toast.fire({ icon: "info", title: `Removed ${removed}` });
      return next;
    });
  };

  const resetAll = () => {
    setFiles([]);
    setErrors([]);
    setConfirmAccurate(false);
    toast.fire({ icon: "info", title: "Cleared all files" });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (files.length < MIN_FILES) {
      toast.fire({ icon: "warning", title: `Add at least ${MIN_FILES} screenshot${MIN_FILES === 1 ? "" : "s"}` });
      return;
    }
    if (!confirmAccurate) {
      toast.fire({ icon: "warning", title: "Please confirm authenticity" });
      return;
    }

    try {
      setSubmitting(true);
      // Simulated API call — replace with your real upload
      await new Promise((r) => setTimeout(r, 1200));
      onSubmit?.(files);
      toast.fire({
        icon: "success",
        title: `Submitted ${files.length} screenshot${files.length === 1 ? "" : "s"} for ${meta.title.split(" ")[0]}`,
      });
      resetAll();
    } catch (err) {
      toast.fire({ icon: "error", title: "Upload failed. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = files.length >= MIN_FILES && files.length <= MAX_FILES && confirmAccurate;

  return (
    <Card className={`rounded-3xl shadow-lg border-2 ${meta.bgColor} transition-all duration-300`}>
      <CardHeader className="p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <CardTitle className="text-2xl font-semibold flex items-center gap-3">
              <div className={`p-3 rounded-2xl bg-white shadow-sm ${meta.color}`}>{meta.icon}</div>
              {meta.title}
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">{meta.description}</CardDescription>
          </div>
          <Badge variant={files.length > 0 ? "default" : "outline"} className="text-lg px-4 py-2 rounded-full">
            {files.length}/{MAX_FILES} files
          </Badge>
        </div>
      </CardHeader>

      <form onSubmit={submit}>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Upload Area */}
            <section className="xl:col-span-2 space-y-6">
              {/* Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ${
                  dragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
                } ${disabled || submitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !disabled && !submitting && document.getElementById("file-input")?.click()}
              >
                <div className="text-center">
                  <div className="mx-auto mb-4 p-4 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white w-fit">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Upload Email Screenshots</h3>
                  <p className="text-gray-600 mb-4">Drag and drop your screenshots here, or click to browse</p>
                  <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                    <span>JPG, PNG, WebP</span>
                    <span>•</span>
                    <span>Max 10MB each</span>
                    <span>•</span>
                    <span>1-{MAX_FILES} files</span>
                  </div>
                </div>

                <input
                  id="file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={handleInputChange}
                  disabled={disabled || submitting}
                  className="sr-only"
                />
              </div>

              {/* File Previews */}
              {files.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold">Uploaded Screenshots</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetAll}
                      disabled={disabled || submitting}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {files.map((file, index) => (
                      <div key={file.name + index} className="relative group bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="aspect-video relative">
                          <img src={previews[index]} alt={`Screenshot ${index + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => removeFile(index)}
                              className="rounded-full p-2"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatMB(file.size)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Sidebar */}
            <aside className="space-y-6">
              {/* Requirements */}
              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <InfoIcon className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">Requirements</h3>
                  </div>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Upload 1-5 clear email screenshots</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Email address and timestamps visible</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Unedited, authentic screenshots</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>JPG, PNG, or WebP format</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Confirmation */}
              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmAccurate}
                      onChange={(e) => setConfirmAccurate(e.target.checked)}
                      disabled={disabled || submitting}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm leading-relaxed">
                      I confirm these are authentic, unedited screenshots from my own account.
                    </span>
                  </label>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                disabled={disabled || submitting || !isValid}
              >
                {submitting ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Submit Screenshots ({files.length})
                  </>
                )}
              </Button>

              {/* Progress */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Progress</span>
                    <span>
                      {files.length}/{MAX_FILES} files
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(files.length / MAX_FILES) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </aside>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Main Page Component
// -----------------------------------------------------------------------------
export default function EmailProofPage() {
  const [active, setActive] = useState<Platform>("youtube");

  const handleSubmit = (platform: Platform) => (files: File[]) => {
    // Your API integration here
    console.log(`Submitting ${platform} screenshots:`, files);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <ImageIcon className="h-8 w-8" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Email Screenshot Verification
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Upload email screenshots from your preferred social media platform to verify your account activity. Select a
            platform below and upload 1-5 clear screenshots.
          </p>
        </div>

        <Tabs value={active} onValueChange={(v) => setActive(v as Platform)} className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="grid grid-cols-3 h-12 bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl p-2 border">
              <TabsTrigger
                value="youtube"
                className="gap-2 rounded-xl data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:shadow-sm"
              >
                <PlayCircle className="h-4 w-4" />
                <span className="font-medium">YouTube</span>
              </TabsTrigger>
              <TabsTrigger
                value="instagram"
                className="gap-2 rounded-xl data-[state=active]:bg-pink-50 data-[state=active]:text-pink-700 data-[state=active]:shadow-sm"
              >
                <Camera className="h-4 w-4" />
                <span className="font-medium">Instagram</span>
              </TabsTrigger>
              <TabsTrigger
                value="tiktok"
                className="gap-2 rounded-xl data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
              >
                <Music2 className="h-4 w-4" />
                <span className="font-medium">TikTok</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="youtube">
            <PlatformUpload platform="youtube" onSubmit={handleSubmit("youtube")} />
          </TabsContent>
          <TabsContent value="instagram">
            <PlatformUpload platform="instagram" onSubmit={handleSubmit("instagram")} />
          </TabsContent>
          <TabsContent value="tiktok">
            <PlatformUpload platform="tiktok" onSubmit={handleSubmit("tiktok")} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
