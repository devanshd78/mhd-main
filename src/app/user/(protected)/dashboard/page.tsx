"use client";

import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

import {
  User as UserIcon,
  ClipboardCopy as ClipboardCopyIcon,
  Plus as PlusIcon,
  LogOut as LogOutIcon,
  Image as ImageIcon,
  X as XIcon,
} from "lucide-react";

import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

interface LinkItem {
  _id: string;
  title: string;
  isLatest: boolean;
  target?: number;
  amount?: number;
  createdAt: string;
  expireIn?: number; // in hours
  isCompleted: number; // 0 | 1
}

interface UserProfile {
  _id: string;
  userId: string;
  name: string;
  phone: number;
  email: string;
  upiId: string;
  worksUnder: string;
}

interface SubmitVerification {
  liked: boolean;
  user_id: string | null;
  comment: string[];
  replies: string[];
  verified: boolean;
}

interface SubmitEntryResponse {
  message: string;
  verification: SubmitVerification;
  entry: {
    entryId: string;
    linkId: string;
    name: string;
    upiId: string;
    type: number;
    status: string | null;
    userId: string;
    worksUnder: string;
    linkAmount: number;
    totalAmount: number;
    screenshotId: string;
    isUpdated: number;
    _id: string;
    createdAt: string;
    history: any[];
    __v: number;
  };
}

// basic sanitizer for injecting dynamic text into SweetAlert HTML
const escapeHtml = (s: string) =>
  String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");


type ImageKey = "like" | "comment1" | "comment2" | "reply1" | "reply2";
const IMAGE_KEYS: ImageKey[] = ["like", "comment1", "comment2", "reply1", "reply2"];

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default function Dashboard() {
  const router = useRouter();

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkItem | null>(null);

  const [entryName, setEntryName] = useState("");
  const [userUpi, setUserUpi] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [worksUnder, setWorksUnder] = useState<string>("");

  const [images, setImages] = useState<Record<ImageKey, File | null>>({
    like: null,
    comment1: null,
    comment2: null,
    reply1: null,
    reply2: null,
  });

  const [imageErrors, setImageErrors] = useState<Record<ImageKey, string | null>>({
    like: null,
    comment1: null,
    comment2: null,
    reply1: null,
    reply2: null,
  });

  const [submitting, setSubmitting] = useState(false);

  const previews = useMemo(() => {
    const obj: Record<ImageKey, string | null> = {
      like: null,
      comment1: null,
      comment2: null,
      reply1: null,
      reply2: null,
    };
    for (const key of IMAGE_KEYS) obj[key] = images[key] ? URL.createObjectURL(images[key] as File) : null;
    return obj;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const key of IMAGE_KEYS) if (previews[key]) URL.revokeObjectURL(previews[key] as string);
    };
  }, [previews]);

  // force re-render for timers
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // load user profile
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      api
        .get<{ user: UserProfile }>(`/user/getbyuserId/${userId}`, { withCredentials: true })
        .then((res) => {
          const prof = res.data.user;
          setUserProfile(prof);
          setEntryName(prof.name);
          setUserUpi(prof.upiId);
          setUserPhone(String(prof.phone));
          setUserEmail(prof.email);
          setWorksUnder(prof.worksUnder);
        })
        .catch(console.error);
    }
  }, []);

  // load all links
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      setError("User not logged in");
      setLoading(false);
      return;
    }
    api
      .post<LinkItem[]>("/user/link", { userId }, { withCredentials: true })
      .then((res) => setLinks(res.data))
      .catch((err) => setError(err.response?.data?.error || "Unable to load links."))
      .finally(() => setLoading(false));
  }, []);

  const getTimeLeft = (createdAt: string, expireIn: number = 0) => {
    const expiry = new Date(new Date(createdAt).getTime() + expireIn * 3600 * 1000);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return { expired: true, label: "Expired" } as const;
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return { expired: false, label: `${hrs}h ${mins}m` } as const;
  };

  const handleCopy = (text: string) =>
    navigator.clipboard.writeText(text).then(() =>
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Link copied",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      })
    );

  const handleLogout = () => {
    localStorage.clear();
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "info",
      title: "Logged out",
      showConfirmButton: false,
      timer: 1500,
      timerProgressBar: true,
    });
    router.push("/user/login");
  };

  const resetImageState = () => {
    setImages({ like: null, comment1: null, comment2: null, reply1: null, reply2: null });
    setImageErrors({ like: null, comment1: null, comment2: null, reply1: null, reply2: null });
  };

  const openEntryModal = (link: LinkItem) => {
    setSelectedLink(link);
    if (userProfile) {
      setEntryName(userProfile.name);
      setUserUpi(userProfile.upiId);
      setUserPhone(String(userProfile.phone));
      setUserEmail(userProfile.email);
    }
    resetImageState();
    setModalOpen(true);
  };

  const onImageChange = (key: ImageKey, fileList: FileList | null) => {
    const file = fileList?.[0] ?? null;

    // clear previous error
    setImageErrors((prev) => ({ ...prev, [key]: null }));

    if (!file) {
      setImages((prev) => ({ ...prev, [key]: null }));
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageErrors((prev) => ({ ...prev, [key]: "Unsupported file type. Use JPG/PNG/WebP." }));
      return;
    }

    if (file.size > MAX_SIZE) {
      setImageErrors((prev) => ({ ...prev, [key]: "File too large. Max 10MB." }));
      return;
    }

    setImages((prev) => ({ ...prev, [key]: file }));
  };

  const validateImages = () => {
    const missing: ImageKey[] = IMAGE_KEYS.filter((k) => !images[k]);
    const errors: string[] = [];

    for (const k of IMAGE_KEYS) {
      if (imageErrors[k]) errors.push(`${k}: ${imageErrors[k]}`);
    }
    return { ok: missing.length === 0 && errors.length === 0, missing, errors };
  };

  const handleEntrySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLink || !userProfile) return;

    const { ok, missing, errors } = validateImages();
    if (!ok) {
      const lines = [missing.length ? `Missing: ${missing.join(", ")}` : "", ...errors].filter(Boolean);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: "Please fix the upload issues",
        text: lines.join(" | "),
        showConfirmButton: false,
        timer: 2200,
        timerProgressBar: true,
      });
      return;
    }

    const form = new FormData();
    form.append("userId", userProfile.userId);
    form.append("name", entryName);
    form.append("upiId", userUpi);
    form.append("linkId", selectedLink._id);
    form.append("type", String(1));
    form.append("worksUnder", worksUnder);
    IMAGE_KEYS.forEach((key) => {
      if (images[key]) form.append(`${key}`, images[key] as File);
    });

    try {
      setSubmitting(true);

      // ⬇️ IMPORTANT: use the response shape you shared
      const res = await api.post<SubmitEntryResponse>("/entry/user", form, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { message, verification: v, entry: en } = res.data;

      // Build a friendly detail view
      const commentsList = v.comment.slice(0, 3).map((c) => `<li>${escapeHtml(c)}</li>`).join("");
      const repliesList = v.replies.slice(0, 3).map((r) => `<li>${escapeHtml(r)}</li>`).join("");

      const html = `
  <div style="text-align:left">
    <p><b>Handle:</b> ${escapeHtml(v.user_id || "—")}</p>
    <p><b>Liked:</b> ${v.liked ? "Yes ✅" : "No ❌"}</p>
    <p><b>Comment 1:</b> ${escapeHtml(v.comment[0] || "—")}</p>
    <p><b>Comment 2:</b> ${escapeHtml(v.comment[1] || "—")}</p>
    <p><b>Reply 1:</b> ${escapeHtml(v.replies[0] || "—")}</p>
    <p><b>Reply 2:</b> ${escapeHtml(v.replies[1] || "—")}</p>
    <p><b>Amount will be paid:</b> ₹${escapeHtml(String(en.totalAmount))}</p>
    <p><b>Date:</b> ${escapeHtml(new Date(en.createdAt).toLocaleString('en-US', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }))}</p>
  </div>
`;

      // Close the upload modal before showing the summary
      setModalOpen(false);

      await Swal.fire({
        icon: "success",
        title: escapeHtml("Verified"),
        html,
        confirmButtonText: "OK",
        width: 600,
      });

    } catch (err: any) {
      const data = err?.response?.data || {};
      const code = (data.code as string) || undefined;
      const message = data.message || "Submission failed";

      let extra = "";
      if (code === "MISSING_IMAGES" && Array.isArray(data.missing)) {
        extra = `Missing: ${data.missing.join(", ")}`;
      } else if (code === "INVALID_IMAGE_FILES") {
        const typeErr = (data.typeErrors || []).map((t: any) => `${t.role} (${t.mimetype})`).join(", ");
        const sizeErr = (data.sizeErrors || []).map((s: any) => `${s.role} (${Math.round(s.size / 1024 / 1024)}MB)`).join(", ");
        const parts: string[] = [];
        if (typeErr) parts.push(`Type issues: ${typeErr}`);
        if (sizeErr) parts.push(`Too large: ${sizeErr}`);
        if (data.allowed) parts.push(`Allowed: JPG/PNG/WebP`);
        if (data.maxBytes) parts.push(`Max: 10MB each`);
        extra = parts.join(" | ");
      } else if (code === "NEAR_DUPLICATE") {
        extra = "These screenshots match a previous upload. Please capture fresh screenshots.";
      } else if (code === "VERIFICATION_FAILED") {
        const d = data.details || {};
        const need = d.needed ? `Need: liked=${d.needed.liked}, comments>=${d.needed.minComments}, replies>=${d.needed.minReplies}` : "";
        const got = `Detected → liked=${String(d.liked)}, comments=${d.commentCount}, replies=${d.replyCount}`;
        extra = [need, got].filter(Boolean).join(" | ");
      } else if (code === "UPI_MISMATCH") {
        extra = "The UPI ID in your profile must match exactly (case-insensitive).";
      } else if (code === "INVALID_UPI") {
        extra = "Please double-check your UPI format.";
      } else if (
        code === "ANALYZER_ERROR" ||
        code === "PHASH_ERROR" ||
        code === "DUP_CHECK_ERROR" ||
        code === "SCREENSHOT_PERSIST_ERROR" ||
        code === "ENTRY_PERSIST_ERROR"
      ) {
        extra = "A server error occurred. Please try again.";
      }

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: message,
        text: extra,
        showConfirmButton: false,
        timer: 2800,
        timerProgressBar: true,
      });
    } finally {
      setSubmitting(false);
      setSelectedLink(null);
      resetImageState();
    }
  };


  if (loading) return <div className="flex justify-center items-center h-[60vh] text-sm">Loading...</div>;
  if (error) return <div className="text-center text-red-600 py-10 px-4">{error}</div>;

  return (
    <>
      {/* Header */}
      <header className="bg-white sticky top-0 z-20 shadow-sm px-4 sm:px-6 py-3 flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-semibold truncate pr-3">Available Links</h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <Avatar className="cursor-pointer h-9 w-9 sm:h-10 sm:w-10" onClick={() => router.push("/user/my-account")}>
            <AvatarFallback>
              <UserIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1 px-2 sm:px-3">
            <LogOutIcon className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {links.map((link) => {
            const { expired, label } = getTimeLeft(link.createdAt, link.expireIn || 0);
            return (
              <Card
                key={link._id}
                className={`group rounded-xl hover:shadow-lg transition-shadow bg-white border shadow-sm ${link.isLatest ? "border-green-500" : "border-gray-200"
                  }`}
              >
                <CardHeader className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base sm:text-lg font-medium text-gray-800 flex-1 min-w-0 break-words">
                      {link.title}
                    </CardTitle>
                    {link.isCompleted === 1 ? (
                      <Badge
                        variant="outline"
                        className="flex-shrink-0 border-green-500 text-green-600 bg-transparent"
                      >
                        Completed
                      </Badge>
                    ) : link.isLatest ? (
                      <Badge
                        variant="outline"
                        className="flex-shrink-0 border-green-500 text-green-600 bg-transparent"
                      >
                        Latest
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-2 p-4 text-sm text-gray-700">
                  {link.target != null && (
                    <div className="flex justify-between">
                      <span>Target</span>
                      <span className="font-medium">{link.target}</span>
                    </div>
                  )}
                  {link.amount != null && (
                    <div className="flex justify-between">
                      <span>Amount</span>
                      <span className="font-semibold">₹{link.amount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Expires</span>
                    <span className={expired ? "text-gray-400" : "text-green-600"}>{label}</span>
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-0">
                  {link.isCompleted === 0 && link.isLatest && !expired && (
                    <div className="w-full flex flex-col sm:flex-row gap-2 sm:justify-end">
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        size="sm"
                        onClick={() => handleCopy(link.title)}
                      >
                        <ClipboardCopyIcon className="h-4 w-4 mr-1" /> Copy
                      </Button>
                      <Button className="w-full sm:w-auto" size="sm" onClick={() => openEntryModal(link)}>
                        <PlusIcon className="h-4 w-4 mr-1" /> Add Entry
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>

            );
          })}
        </section>
      </main>

      {/* Dialog */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetImageState();
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-2xl p-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 pb-2">
            <DialogTitle className="text-lg sm:text-xl">Add Entry</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEntrySubmit} className="px-4 sm:px-6 pb-3">
            {/* Scrollable form body */}
            <div className="max-h-[70vh] sm:max-h-[65vh] overflow-y-auto space-y-4 pr-1">
              {/* Locked user info */}
              <label className="block">
                <span className="text-sm text-gray-700">Name</span>
                <Input value={entryName} disabled />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-700">Phone</span>
                  <Input value={userPhone} disabled />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-700">Email</span>
                  <Input value={userEmail} disabled />
                </label>
              </div>

              {selectedLink?.amount != null && (
                <label className="block">
                  <span className="text-sm text-gray-700">Amount</span>
                  <Input value={`₹${selectedLink.amount}`} disabled />
                </label>
              )}

              <label className="block">
                <span className="text-sm text-gray-700">UPI ID</span>
                <Input value={userUpi} disabled />
              </label>

              {/* Image uploads */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Upload Proof Images</span>
                  <span className="text-xs text-gray-500">Required: 5 images</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {IMAGE_KEYS.map((key) => (
                    <div key={key} className="border rounded-xl p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold capitalize">
                          {key === "like"
                            ? "Like"
                            : key === "comment1"
                              ? "Comment 1"
                              : key === "comment2"
                                ? "Comment 2"
                                : key === "reply1"
                                  ? "Reply 1"
                                  : "Reply 2"}
                        </span>
                        {images[key] && (
                          <button
                            type="button"
                            onClick={() => setImages((prev) => ({ ...prev, [key]: null }))}
                            className="text-gray-500 hover:text-gray-700"
                            aria-label={`Remove ${key}`}
                            title="Remove"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {previews[key] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previews[key] as string}
                          alt={`${key} preview`}
                          className="w-full h-28 sm:h-40 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="flex h-28 sm:h-40 items-center justify-center rounded-lg border border-dashed bg-white">
                          <div className="flex flex-col items-center text-gray-500">
                            <ImageIcon className="h-8 w-8 mb-2" />
                            <span className="text-[11px]">No file selected</span>
                          </div>
                        </div>
                      )}

                      <div className="mt-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e: ChangeEvent<HTMLInputElement>) => onImageChange(key, e.target.files)}
                          required
                          className="file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:bg-white file:hover:bg-gray-50 file:text-sm"
                          aria-label={`Upload ${key}`}
                        />
                        <p className="mt-1 text-[11px] text-gray-500">Accepted: JPG/PNG/WebP • Max 10MB each</p>
                        {imageErrors[key] && (
                          <p className="mt-1 text-[11px] text-red-600" role="alert" aria-live="polite">
                            {imageErrors[key]}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sticky footer actions for mobile */}
            <DialogFooter className="mt-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  resetImageState();
                  setModalOpen(false);
                }}
                className="w-full sm:w-auto"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
