"use client";

import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import axios from "axios";

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
  MailCheck as MailCheckIcon,
} from "lucide-react";

import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

/* ===================== Types ===================== */

/* ==== Email Task Batch Response (from /email/user/extract) ==== */
interface BatchItemDetails {
  outcome?: "saved" | "duplicate" | "invalid" | string;
  message?: string;
  id?: string;
  emailId?: string;
  handleId?: string;
  emailUserId?: string;
  handleUserId?: string;
}

interface BatchItemResult {
  error?: string;
  has_captcha?: boolean;
  platform?: string;
  more_info?: {
    emails?: string[];
    handles?: string[];
    YouTube?: string | null;
  };
  normalized?: { email?: string | null; handle?: string | null };
  details?: BatchItemDetails;
  db?: { saved?: boolean; id?: string };
  youtube?: any;
  youtubeSaved?: boolean;
  youtubeMessage?: string | null;
}

interface EmailTaskBatchResponse {
  emailTaskId: string;
  platform: string;
  maxImages: number;
  accepted: number;
  results: BatchItemResult[];
}

interface LinkItem {
  _id: string;
  title: string;
  isLatest: boolean;
  target?: number;
  amount?: number;
  createdAt: string;
  expireIn?: number; // hours
  isCompleted: number; // 0 | 1
}

// Add these fields to the EmailTaskItem interface
interface EmailTaskItem {
  _id: string;
  createdBy: string;
  platform: string;
  targetUser?: string | number;
  targetPerEmployee: number;
  amountPerPerson: number;
  maxEmails: number;
  expireIn: number;
  createdAt: string;
  expiresAt?: string;
  status?: "active" | "expired";
  isLatest?: boolean;
  isCompleted: number;     // 0 | 1
  isPartial?: number;      // 0 | 1
  doneCount?: number;      // how many done by this user
}

// Include the new fields in the MergedItem `task` variant as well
type MergedItem =
  | {
    kind: "link";
    _id: string;
    createdAt: string;
    expireIn: number;
    isLatest?: boolean;
    title: string;
    target?: number;
    amount?: number;
    isCompleted: number;
  }
  | {
    kind: "task";
    _id: string;
    createdAt: string;
    expireIn: number;
    isLatest?: boolean;
    platform: string;
    targetUser?: string | number;
    targetPerEmployee: number;
    amountPerPerson: number;
    maxEmails: number;
    isCompleted: number;  // 0 | 1
    isPartial?: number;   // 0 | 1
    doneCount?: number;   // number completed by user
  };

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
  comment: string[] | null;
  replies: string[] | null;
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

/* ===================== Constants / Helpers ===================== */

type ImageKey = "like" | "comment1" | "comment2" | "reply1" | "reply2";
const IMAGE_KEYS: ImageKey[] = ["like", "comment1", "comment2", "reply1", "reply2"];

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const escapeHtml = (s: string) =>
  String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const formatMB = (bytes?: number) =>
  typeof bytes === "number" && isFinite(bytes) ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : "";

const isAxiosErr = (e: unknown): e is import("axios").AxiosError<any> => axios.isAxiosError(e);

const buildErrorToast = (err: unknown) => {
  let icon: "error" | "warning" | "info" = "error";
  let title = "Submission failed";
  let text = "Please try again.";

  // offline
  // @ts-ignore
  if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) {
    return { icon: "error" as const, title: "You're offline", text: "Reconnect and try again." };
  }
  // canceled upload
  // @ts-ignore
  if ((err as any)?.code === "ERR_CANCELED") {
    return { icon: "info" as const, title: "Upload canceled", text: "" };
  }

  if (!isAxiosErr(err)) return { icon, title, text };

  const status = err.response?.status;
  const data = err.response?.data ?? {};
  const code: string | undefined = data.code;
  const serverMsg: string | undefined = data.message;

  if (serverMsg) title = String(serverMsg);

  switch (code) {
    case "VALIDATION_ERROR":
      text = "userId, linkId, name, worksUnder, upiId are required.";
      icon = "warning";
      break;
    case "INVALID_OBJECT_ID":
      text = "The provided linkId is invalid.";
      icon = "warning";
      break;
    case "LINK_NOT_FOUND":
      text = "The specified link was not found.";
      icon = "warning";
      break;
    case "USER_NOT_FOUND":
      text = "User not found.";
      icon = "warning";
      break;
    case "MISSING_IMAGES": {
      const missing = Array.isArray(data.missing) ? data.missing.join(", ") : "";
      text = missing ? `Missing: ${missing}` : "Please upload all 5 screenshots.";
      icon = "warning";
      break;
    }
    case "INVALID_IMAGE_FILES": {
      const typeErr = (data.typeErrors || [])
        .map((t: any) => `${t.role} (${t.mimetype || "?"})`)
        .join(", ");
      const sizeErr = (data.sizeErrors || [])
        .map((s: any) => `${s.role} (${formatMB(s.size)})`)
        .join(", ");
      const parts: string[] = [];
      if (typeErr) parts.push(`Type issues: ${typeErr}`);
      if (sizeErr) parts.push(`Too large: ${sizeErr}`);
      if (data.allowed) parts.push(`Allowed: JPG/PNG/WebP`);
      if (data.maxBytes) parts.push(`Max: ${formatMB(data.maxBytes)} each`);
      text = parts.join(" | ") || "Some files were invalid.";
      icon = "warning";
      break;
    }
    case "NEAR_DUPLICATE":
      text = "These screenshots match a previous upload. Please capture fresh screenshots.";
      icon = "warning";
      break;
    case "DUPLICATE_BUNDLE_SIG":
      text = "A matching screenshot bundle already exists for this link (perceptual match).";
      icon = "warning";
      break;
    case "DUPLICATE_BUNDLE_SHA":
      text = "This exact set of image files was already submitted for this link.";
      icon = "warning";
      break;
    case "HANDLE_ALREADY_VERIFIED":
      text = "This handle has already been verified for this video.";
      icon = "warning";
      break;
    case "VERIFICATION_FAILED": {
      const d = data.details || {};
      const need = d.needed
        ? `Need: liked=${String(d.needed.liked)}, comments≥${d.needed.minComments}, replies≥${d.needed.minReplies}`
        : "";
      const got = `Detected → liked=${String(d.liked)}, comments=${d.commentCount}, replies=${d.replyCount}`;
      text = [need, got].filter(Boolean).join(" | ") || "Could not verify the screenshots.";
      icon = "warning";
      break;
    }
    case "UPI_MISMATCH":
      text = "The UPI ID in your profile must match exactly (case-insensitive).";
      icon = "warning";
      break;
    case "INVALID_UPI":
      text = "Please double-check your UPI format.";
      icon = "warning";
      break;
    case "ANALYZER_ERROR":
    case "PHASH_ERROR":
    case "DUP_CHECK_ERROR":
    case "SCREENSHOT_PERSIST_ERROR":
    case "ENTRY_PERSIST_ERROR":
      text = "A server error occurred. Please try again.";
      icon = "error";
      break;
    default: {
      if (status === 413) {
        title = "Files too large";
        text = "One or more images exceed the size limit. Please compress and retry.";
        icon = "warning";
      } else if (status === 409) {
        title = "Duplicate submission";
        text = "A matching submission already exists for this link.";
        icon = "warning";
      } else if (status === 422) {
        title = "Verification failed";
        text = "Could not verify the screenshots. Please try clearer images.";
        icon = "warning";
      } else if (status === 429) {
        title = "Too many attempts";
        text = "Please wait a moment and try again.";
        icon = "warning";
      } else if (status && status >= 500) {
        title = "Server unavailable";
        text = "Please try again in a minute.";
        icon = "error";
      } else {
        text = code ? `Error Code: ${code}` : (serverMsg || "Unexpected error.");
        icon = "error";
      }
    }
  }

  return { icon, title, text };
};

/* ===================== Component ===================== */

export default function Dashboard() {
  const router = useRouter();

  // Shareable Links
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [errorLinks, setErrorLinks] = useState("");

  // Email Tasks
  const [emailTasks, setEmailTasks] = useState<EmailTaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [errorTasks, setErrorTasks] = useState("");

  // Link entry modal + selection
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkItem | null>(null);

  // Email task screenshots modal + selection
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<EmailTaskItem | null>(null);
  const [emailShots, setEmailShots] = useState<File[]>([]); // multiple files at once
  const [emailShotError, setEmailShotError] = useState<string>(""); // single error message
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // Profile (read-only)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [entryName, setEntryName] = useState("");
  const [userUpi, setUserUpi] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [worksUnder, setWorksUnder] = useState<string>("");

  // Link proof images (5 fixed)
  type ImageErrors = Record<ImageKey, string | null>;
  const [images, setImages] = useState<Record<ImageKey, File | null>>({
    like: null,
    comment1: null,
    comment2: null,
    reply1: null,
    reply2: null,
  });
  const [imageErrors, setImageErrors] = useState<ImageErrors>({
    like: null,
    comment1: null,
    comment2: null,
    reply1: null,
    reply2: null,
  });
  const [submitting, setSubmitting] = useState(false);

  // Previews for fixed 5 (link flow only)
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

  // profile
  useEffect(() => {
    const c = new AbortController();
    const userId = localStorage.getItem("userId");
    if (userId) {
      api
        .get<{ user: UserProfile }>(`/user/getbyuserId/${userId}`, { withCredentials: true, signal: c.signal as any })
        .then((res) => {
          const prof = res.data.user;
          setUserProfile(prof);
          setEntryName(prof.name);
          setUserUpi(prof.upiId);
          setUserPhone(String(prof.phone));
          setUserEmail(prof.email);
          setWorksUnder(prof.worksUnder);
        })
        .catch((err) => {
          if (axios.isCancel(err)) return;
          console.error(err);
        });
    }
    return () => c.abort();
  }, []);

  // links
  // --- Data loaders (reusable) ---
  const fetchLinks = useCallback(async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      setErrorLinks("User not logged in");
      setLoadingLinks(false);
      return;
    }
    try {
      setLoadingLinks(true);
      const { data } = await api.post<LinkItem[]>("/user/link", { userId }, { withCredentials: true });
      setLinks(data);
      setErrorLinks("");
    } catch (err: any) {
      setErrorLinks(err?.response?.data?.error || "Unable to load links.");
    } finally {
      setLoadingLinks(false);
    }
  }, []);

  const fetchEmailTasks = useCallback(async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      setErrorTasks("User not logged in");
      setLoadingTasks(false);
      return;
    }
    try {
      setLoadingTasks(true);
      const res = await api.post("/user/emailtasks", { userId }, { withCredentials: true });
      const payload = res.data;
      const tasks = Array.isArray(payload) ? payload : Array.isArray(payload?.tasks) ? payload.tasks : [];
      setEmailTasks(tasks as EmailTaskItem[]);
      setErrorTasks("");
    } catch (e: any) {
      setErrorTasks(e?.response?.data?.error || "Unable to load email tasks.");
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);
  useEffect(() => { fetchEmailTasks(); }, [fetchEmailTasks]);


  /* ===================== Utils ===================== */

  const getTimeLeft = (createdAt: string, expireIn: number = 0) => {
    const expiry = new Date(new Date(createdAt).getTime() + expireIn * 3600 * 1000);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return { expired: true, label: "Expired" } as const;
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return { expired: false, label: `${hrs}h ${mins}m` } as const;
  };

  const handleCopy = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
      }
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: "Link copied", showConfirmButton: false, timer: 1500, timerProgressBar: true });
    } catch {
      Swal.fire({ toast: true, position: "top-end", icon: "error", title: "Copy failed", showConfirmButton: false, timer: 1500 });
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    Swal.fire({ toast: true, position: "top-end", icon: "info", title: "Logged out", showConfirmButton: false, timer: 1500, timerProgressBar: true });
    router.push("/user/login");
  };

  /* ===================== Link entry (fixed 5) ===================== */

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
      setWorksUnder(userProfile.worksUnder);
    }
    resetImageState();
    setModalOpen(true);
  };

  const onImageChange = (key: ImageKey, fileList: FileList | null) => {
    const file = fileList?.[0] ?? null;
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
        toast: true, position: "top-end", icon: "warning",
        title: "Please fix the upload issues", text: lines.join(" | "),
        showConfirmButton: false, timer: 2200, timerProgressBar: true,
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
      const res = await api.post<SubmitEntryResponse>("/entry/user", form, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { verification: v, entry: en } = res.data;
      const comments = Array.isArray(v.comment) ? v.comment : [];
      const replies = Array.isArray(v.replies) ? v.replies : [];

      const html = `
        <div style="text-align:left">
          <p><b>Handle:</b> ${escapeHtml(v.user_id || "—")}</p>
          <p><b>Liked:</b> ${v.liked ? "Yes ✅" : "No ❌"}</p>
          <p><b>Comment 1:</b> ${escapeHtml(comments[0] || "—")}</p>
          <p><b>Comment 2:</b> ${escapeHtml(comments[1] || "—")}</p>
          <p><b>Reply 1:</b> ${escapeHtml(replies[0] || "—")}</p>
          <p><b>Reply 2:</b> ${escapeHtml(replies[1] || "—")}</p>
          <p><b>Amount will be paid:</b> ₹${escapeHtml(String(en.totalAmount))}</p>
          <p><b>Date:</b> ${escapeHtml(new Date(en.createdAt).toLocaleString('en-US', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }))}</p>
        </div>
      `;

      setModalOpen(false);
      await Swal.fire({ icon: "success", title: escapeHtml("Verified"), html, confirmButtonText: "OK", width: 600 });
      fetchLinks();
      fetchEmailTasks();
      setSelectedLink(null);
      resetImageState();
      setEntryName("");
    } catch (err) {
      const { icon, title, text } = buildErrorToast(err);
      Swal.fire({ toast: true, position: "top-end", icon, title, text, showConfirmButton: false, timer: 3200, timerProgressBar: true });
    } finally {
      setSubmitting(false);

    }
  };

  /* ===================== Email task screenshots (multiple; no previews) ===================== */

  const resetEmailTaskState = () => {
    setEmailShots([]);
    setEmailShotError("");
    setSelectedTask(null);
  };

  // Helpers for reading the batch response safely
  const firstOf = <T,>(arr?: T[] | null) => (Array.isArray(arr) && arr.length ? arr[0] : null);

  const handleFromYouTube = (yt?: string | null) => {
    if (!yt) return null;
    const m = String(yt).match(/@[\w.-]+/i);
    return m ? m[0] : null;
  };

  const pickEmail = (r: BatchItemResult) =>
    r.normalized?.email ?? firstOf(r.more_info?.emails) ?? null;

  const pickHandle = (r: BatchItemResult) =>
    r.normalized?.handle ??
    firstOf(r.more_info?.handles) ??
    handleFromYouTube(r.more_info?.YouTube) ??
    null;


  const openEmailTask = (task: EmailTaskItem) => {
    setSelectedTask(task);
    setEmailShots([]);        // start empty; user can pick many at once
    setEmailShotError("");
    setEmailModalOpen(true);
  };

  const handleEmailFilesChange = (files: FileList | null) => {
    if (!selectedTask) return;

    setEmailShotError("");
    const arr = files ? Array.from(files) : [];
    const max = selectedTask.maxEmails;

    // validations
    const validated: File[] = [];
    for (const f of arr) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setEmailShotError("Unsupported file type detected. Use JPG/PNG/WebP.");
        return;
      }
      if (f.size > MAX_SIZE) {
        setEmailShotError(`One or more files exceed ${formatMB(MAX_SIZE)}.`);
        return;
      }
      validated.push(f);
      if (validated.length >= max) break; // cap at maxEmails
    }

    setEmailShots(validated);
  };

  const removeEmailFileAt = (idx: number) => {
    setEmailShots((prev) => prev.filter((_, i) => i !== idx));
  };

  const validateEmailShots = () => {
    if (!selectedTask) return { ok: false, err: "No task selected." };
    if (emailShots.length === 0) return { ok: false, err: "Please select at least one screenshot." };
    if (emailShots.length > selectedTask.maxEmails) {
      return { ok: false, err: `You can upload at most ${selectedTask.maxEmails} screenshots for this task.` };
    }
    if (emailShotError) return { ok: false, err: emailShotError };
    return { ok: true, err: "" };
  };

  const submitEmailTaskShots = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !userProfile) return;

    const { ok, err } = validateEmailShots();
    if (!ok) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: "Please fix the upload issues",
        text: err,
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
      });
      return;
    }

    const files = emailShots.slice(0, selectedTask.maxEmails);

    const form = new FormData();
    form.append("userId", userProfile.userId);
    form.append("taskId", selectedTask._id);
    files.forEach((f) => form.append("screenshots", f)); // field name expected by backend

    try {
      setEmailSubmitting(true);

      const { data } = await api.post<EmailTaskBatchResponse>("/email/user/extract", form, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const results = Array.isArray(data?.results) ? data.results : [];
      const saved = results.filter(r => r.db?.saved).length;
      const duplicates = results.filter(r => r.details?.outcome === "duplicate").length;
      const invalid = results.filter(r =>
        r.details?.outcome === "invalid" || r.error
      ).length;
      const captcha = results.filter(r => r.has_captcha).length;

      // Build compact HTML table
      const rows = results.map((r, i) => {
        const email = pickEmail(r) ?? "";
        const handle = pickHandle(r) ?? "";
        const outcome =
          r.db?.saved
            ? "saved"
            : r.details?.outcome || (r.has_captcha ? "captcha" : r.error ? "error" : "unknown");

        return `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${handle || "—"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${email || "—"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-transform:capitalize;">${outcome}</td>
    </tr>
  `;
      }).join("");


      const html = `
      <div style="text-align:left">
        <p style="margin:8px 0;">
          <b>Processed:</b> ${data.accepted}/${data.maxImages}
          &nbsp; | &nbsp; <b>Saved:</b> ${saved}
          &nbsp; | &nbsp; <b>Duplicates:</b> ${duplicates}
          &nbsp; | &nbsp; <b>Invalid:</b> ${invalid}
          &nbsp; | &nbsp; <b>Captcha:</b> ${captcha}
        </p>
        <div style="max-height:300px;overflow:auto;border:1px solid #eee;border-radius:6px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#fafafa">
                <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">#</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Handle</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Email</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Outcome</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

      setEmailModalOpen(false);
      fetchLinks();
      fetchEmailTasks();
      await Swal.fire({
        icon: "success",
        title: "Processed screenshots",
        html,
        confirmButtonText: "OK",
        width: 720
      });

      resetEmailTaskState();
    } catch (err) {
      const { icon, title, text } = buildErrorToast(err);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon,
        title,
        text,
        showConfirmButton: false,
        timer: 3200,
        timerProgressBar: true,
      });
    } finally {
      setEmailSubmitting(false);
    }
  };


  /* ===================== Merge (Newest First) ===================== */

  const mergedItems = useMemo<MergedItem[]>(() => {
    const safeLinks = Array.isArray(links) ? links : [];
    const safeTasks = Array.isArray(emailTasks) ? emailTasks : [];

    const linkItems: MergedItem[] = safeLinks.map((l) => ({
      kind: "link",
      _id: l._id,
      createdAt: l.createdAt,
      expireIn: l.expireIn ?? 0,
      isLatest: l.isLatest,
      title: l.title,
      target: l.target,
      amount: l.amount,
      isCompleted: l.isCompleted,
    }));

    const taskItems: MergedItem[] = safeTasks.map((t) => ({
      kind: "task",
      _id: t._id,
      createdAt: t.createdAt,
      expireIn: t.expireIn,
      isLatest: t.isLatest,
      platform: t.platform,
      targetUser: t.targetUser,
      targetPerEmployee: t.targetPerEmployee,
      amountPerPerson: t.amountPerPerson,
      maxEmails: t.maxEmails,

      // NEW:
      isCompleted: t.isCompleted ?? 0,
      isPartial: t.isPartial ?? 0,
      doneCount: t.doneCount ?? 0,
    }));


    return [...linkItems, ...taskItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [links, emailTasks]);

  const anyLoading = loadingLinks || loadingTasks;
  const anyError = errorLinks || errorTasks;

  /* ===================== Render ===================== */

  if (anyLoading) return <div className="flex justify-center items-center h-[60vh] text-sm">Loading...</div>;
  if (anyError) return <div className="text-center text-red-600 py-10 px-4">{anyError}</div>;

  return (
    <>
      {/* Header */}
      <header className="bg-white sticky top-0 z-20 shadow-sm px-4 sm:px-6 py-3 flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-semibold truncate pr-3">Available Items</h1>
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

      {/* Feed: Shareable Links + Email Tasks interleaved (newest first) */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {mergedItems.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">
              Nothing available right now.
            </Card>
          ) : (
            mergedItems.map((item) => {
              const { expired, label } = getTimeLeft(item.createdAt, item.expireIn || 0);

              if (item.kind === "link") {
                return (
                  <Card
                    key={`link-${item._id}`}
                    className={`group rounded-xl hover:shadow-lg transition-shadow bg-white border shadow-sm ${item.isLatest ? "border-green-500" : "border-gray-200"
                      }`}
                  >
                    <CardHeader className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <CardTitle className="text-base sm:text-lg font-medium text-gray-800 flex-1 min-w-0 break-words">
                          {item.title}
                        </CardTitle>
                        {item.isCompleted === 1 ? (
                          <Badge variant="outline" className="flex-shrink-0 border-green-500 text-green-600 bg-transparent">
                            Completed
                          </Badge>
                        ) : item.isLatest ? (
                          <Badge variant="outline" className="flex-shrink-0 border-green-500 text-green-600 bg-transparent">
                            Latest
                          </Badge>
                        ) : null}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-2 p-4 text-sm text-gray-700">
                      {typeof item.target === "number" && (
                        <div className="flex justify-between">
                          <span>Target</span>
                          <span className="font-medium">{item.target}</span>
                        </div>
                      )}
                      {typeof item.amount === "number" && (
                        <div className="flex justify-between">
                          <span>Amount</span>
                          <span className="font-semibold">₹{item.amount}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Expires</span>
                        <span className={expired ? "text-gray-400" : "text-green-600"}>{label}</span>
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 pt-0">
                      {item.isCompleted === 0 && item.isLatest && !expired && (
                        <div className="w-full flex flex-col sm:flex-row gap-2 sm:justify-end">
                          <Button variant="outline" className="w-full sm:w-auto" size="sm" onClick={() => handleCopy(item.title)}>
                            <ClipboardCopyIcon className="h-4 w-4 mr-1" /> Copy
                          </Button>
                          <Button
                            className="w-full sm:w-auto"
                            size="sm"
                            onClick={() =>
                              openEntryModal({
                                _id: item._id,
                                title: item.title,
                                isLatest: !!item.isLatest,
                                target: item.target,
                                amount: item.amount,
                                createdAt: item.createdAt,
                                expireIn: item.expireIn,
                                isCompleted: item.isCompleted,
                              } as LinkItem)
                            }
                          >
                            <PlusIcon className="h-4 w-4 mr-1" /> Add Entry
                          </Button>
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              }

              // Email task card
              return (
                <Card
                  key={`task-${item._id}`}
                  className={`group rounded-xl hover:shadow-lg transition-shadow bg-white border shadow-sm ${item.isLatest ? "border-blue-500" : "border-gray-200"
                    }`}
                >
                  <CardHeader className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base sm:text-lg font-medium text-gray-800 break-words">
                        {item.targetUser || "Email Task"}
                      </CardTitle>

                      {/* NEW: status-aware badge */}
                      {(() => {
                        const done = Number(item.doneCount ?? 0);
                        const hasProgress = done > 0;
                        const status =
                          item.isCompleted === 1
                            ? { text: "Completed", cls: "border-green-500 text-green-600" }
                            : item.isPartial === 1 || hasProgress
                              ? { text: "In progress", cls: "border-amber-500 text-amber-600" }
                              : item.isLatest
                                ? { text: "Latest", cls: "border-blue-500 text-blue-600" }
                                : null;

                        return status ? (
                          <Badge variant="outline" className={`flex-shrink-0 bg-transparent ${status.cls}`}>
                            {status.text}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 p-4 text-sm text-gray-700">
                    <div className="flex justify-between">
                      <span>Platform</span>
                      <span className="font-medium">{item.platform}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Target / employee</span>
                      <span className="font-medium">{item.targetPerEmployee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount / person</span>
                      <span className="font-semibold">₹{item.amountPerPerson}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max screenshots</span>
                      <span className="font-medium">{item.maxEmails}</span>
                    </div>

                    {/* NEW: progress (doneCount / targetPerEmployee) */}
                    {(() => {
                      const done = Number(item.doneCount ?? 0);
                      const target = Number(item.maxEmails ?? 0);
                      const pct = Math.max(0, Math.min(100, target ? Math.round((done / target) * 100) : 0));
                      return (
                        <div>
                          <div className="flex justify-between">
                            <span>Progress</span>
                            <span className="font-medium">
                              {done}/{target}
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-blue-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex justify-between">
                      <span>Expires</span>
                      <span
                        className={
                          getTimeLeft(item.createdAt, item.expireIn).expired ? "text-gray-400" : "text-blue-600"
                        }
                      >
                        {label}
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    {(() => {
                      const expired = getTimeLeft(item.createdAt, item.expireIn).expired;
                      if (item.isCompleted === 1) {
                        // Completed: no action
                        return null;
                      }
                      if (!expired) {
                        const hasProgress = (item.isPartial === 1) || (Number(item.doneCount ?? 0) > 0);
                        return (
                          <div className="w-full flex sm:justify-end">
                            <Button
                              className="w-full sm:w-auto"
                              size="sm"
                              onClick={() =>
                                openEmailTask({
                                  _id: item._id,
                                  createdAt: item.createdAt,
                                  expireIn: item.expireIn,
                                  isLatest: item.isLatest,
                                  platform: item.platform,
                                  targetUser: item.targetUser,
                                  targetPerEmployee: item.targetPerEmployee,
                                  amountPerPerson: item.amountPerPerson,
                                  maxEmails: item.maxEmails,
                                  createdBy: "",

                                  // pass through NEW fields too
                                  isCompleted: item.isCompleted ?? 0,
                                  isPartial: item.isPartial ?? 0,
                                  doneCount: item.doneCount ?? 0,
                                } as EmailTaskItem)
                              }
                            >
                              <MailCheckIcon className="h-4 w-4 mr-1" />
                              {hasProgress ? "Continue" : "Upload Screenshot"}
                            </Button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardFooter>
                </Card>
              );
            })
          )}
        </section>
      </main>

      {/* Add Entry Dialog (Links - unchanged) */}
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

              {/* Image uploads (fixed 5) */}
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

            {/* Sticky footer actions */}
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

      {/* Email Task Screenshots Dialog (multiple selection, no previews) */}
      <Dialog
        open={emailModalOpen}
        onOpenChange={(open) => {
          setEmailModalOpen(open);
          if (!open) resetEmailTaskState();
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-2xl p-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 pb-2">
            <DialogTitle className="text-lg sm:text-xl">Upload Email Task Screenshots</DialogTitle>
          </DialogHeader>

          <form onSubmit={submitEmailTaskShots} className="px-4 sm:px-6 pb-3">
            <div className="max-h-[70vh] sm:max-h-[65vh] overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Platform</span>
                    <span className="font-medium">{selectedTask?.platform ?? "—"}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-700">Target / employee</span>
                    <span className="font-medium">{selectedTask?.targetPerEmployee ?? "—"}</span>
                  </div>
                </div>
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Amount / person</span>
                    <span className="font-medium">₹{selectedTask?.amountPerPerson ?? "—"}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-700">Max screenshots</span>
                    <span className="font-medium">{selectedTask?.maxEmails ?? "—"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Screenshots</span>
                  <span className="text-xs text-gray-500">
                    Accepted: JPG/PNG/WebP • Max 10MB each
                  </span>
                </div>

                {/* Single input with multiple selection */}
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleEmailFilesChange(e.target.files)}
                  className="file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:bg-white file:hover:bg-gray-50 file:text-sm"
                  aria-label="Upload screenshots"
                />

                {/* list file names (no previews) */}
                {emailShots.length > 0 && (
                  <div className="mt-2 border rounded-lg p-2 bg-gray-50">
                    <ul className="space-y-1 text-sm">
                      {emailShots.map((f, i) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {f.name} — {formatMB(f.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeEmailFileAt(i)}
                            className="text-gray-500 hover:text-gray-700"
                            aria-label={`Remove ${f.name}`}
                            title="Remove"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-1 text-xs text-gray-500">
                      Selected {emailShots.length}/{selectedTask?.maxEmails ?? 0}
                    </div>
                  </div>
                )}

                {emailShotError && (
                  <p className="text-[12px] text-red-600" role="alert" aria-live="polite">
                    {emailShotError}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="mt-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  resetEmailTaskState();
                  setEmailModalOpen(false);
                }}
                className="w-full sm:w-auto"
                disabled={emailSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={emailSubmitting}>
                {emailSubmitting ? "Uploading…" : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
