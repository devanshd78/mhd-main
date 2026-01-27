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

interface YoutubeInfo {
  channelId?: string;
  title?: string;
  handle?: string;
  urlByHandle?: string;
  urlById?: string;
  description?: string;
  country?: string;
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
  topicCategories?: string[];
  topicCategoryLabels?: string[];
  fetchedAt?: string;
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
  youtube?: YoutubeInfo | null;
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
  minComments?: number;   // 0..2
  minReplies?: number;    // 0..2
  requireLike?: boolean;
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
  isCompleted: number; // 0 | 1
  isPartial?: number; // 0 | 1
  doneCount?: number; // how many done by this user
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

    minComments?: number;
    minReplies?: number;
    requireLike?: boolean;
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
    isCompleted: number; // 0 | 1
    isPartial?: number; // 0 | 1
    doneCount?: number; // number completed by user
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
const MAX_SIZE = 10 * 1024 * 1024;

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
      const needed = d.needed || {};

      const need = `Need: likeRequired=${String(needed.requireLike)}, comments≥${needed.minComments}, replies≥${needed.minReplies}`;
      const got = `Detected → liked=${String(d.liked)}, comments=${d.commentCount}, replies=${d.replyCount}, handle=${String(d.user_id || "—")}`;

      // show handle variants if debug exists
      const dbg = d.debug || {};
      const ch = Array.isArray(dbg.comment_handles) ? dbg.comment_handles : [];
      const rh = Array.isArray(dbg.reply_handles) ? dbg.reply_handles : [];
      const variants =
        (ch.length || rh.length)
          ? `Handles found → comments: ${ch.slice(0, 6).join(", ") || "—"} | replies: ${rh.slice(0, 6).join(", ") || "—"}`
          : "";

      text = [need, got, variants].filter(Boolean).join(" | ");
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

type LinkRules = { minComments: number; minReplies: number; requireLike: boolean };

const clamp02 = (v: any, def: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(0, Math.min(2, Math.floor(n)));
};

const getLinkRules = (link: LinkItem | null): LinkRules => {
  // fallback defaults if API doesn’t send rules
  const minComments = clamp02((link as any)?.minComments, 2);
  const minReplies = clamp02((link as any)?.minReplies, 2);
  const requireLike = Boolean((link as any)?.requireLike ?? false);

  // Safety: do not allow both 0/0
  if (minComments === 0 && minReplies === 0) return { minComments: 2, minReplies: 2, requireLike };
  return { minComments, minReplies, requireLike };
};

const requiredKeysForRules = (rules: LinkRules): ImageKey[] => {
  const req: ImageKey[] = [];
  if (rules.requireLike) req.push("like");
  if (rules.minComments >= 1) req.push("comment1");
  if (rules.minComments >= 2) req.push("comment2");
  if (rules.minReplies >= 1) req.push("reply1");
  if (rules.minReplies >= 2) req.push("reply2");
  return req;
};

/* ===================== Frontend Compression ===================== */

const COMPRESS = {
  maxWidth: 1400,
  maxBytes: 9.5 * 1024 * 1024, // keep well under 10MB backend cap
  type: 'image/webp' as const,
  qualities: [0.82, 0.72, 0.62, 0.52, 0.42], // try in order
  scaleSteps: [1, 0.9, 0.8, 0.7],            // if still too big after qualities
};

const asWebpName = (name: string) => name.replace(/\.(jpe?g|png|webp)$/i, '') + '.webp';

async function fileToBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // Use createImageBitmap (applies EXIF orientation in most modern browsers)
  if ('createImageBitmap' in window) {
    try {
      // @ts-ignore: imageOrientation option supported in modern browsers
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // fall through
    }
  }
  // Fallback to HTMLImageElement
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function scaleForMaxWidth(w: number, h: number, maxWidth: number) {
  if (w <= maxWidth) return { w, h };
  const ratio = maxWidth / w;
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if ('OffscreenCanvas' in window) {
    // @ts-ignore
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function drawToCanvas(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number
): HTMLCanvasElement | OffscreenCanvas {
  const canvas = makeCanvas(width, height);
  // @ts-ignore
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source as any, 0, 0, width, height);
  }
  return canvas;
}

async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    // @ts-ignore
    return await canvas.convertToBlob({ type, quality });
  }
  return await new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, type, quality);
  });
}

/** Compress a single image file to WebP with target maxBytes & maxWidth. */
async function compressImageFile(file: File, opts = COMPRESS): Promise<File> {
  const bmp = await fileToBitmap(file);
  const srcW = 'width' in bmp ? (bmp as any).width : (bmp as HTMLImageElement).naturalWidth;
  const srcH = 'height' in bmp ? (bmp as any).height : (bmp as HTMLImageElement).naturalHeight;

  // Initial resize to fit maxWidth
  let { w, h } = scaleForMaxWidth(srcW, srcH, opts.maxWidth);
  let canvas = drawToCanvas(bmp, w, h);

  for (const scale of opts.scaleSteps) {
    if (scale !== 1) {
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      canvas = drawToCanvas(bmp, w, h);
    }

    for (const q of opts.qualities) {
      const blob = await canvasToBlob(canvas, opts.type, q);
      if (blob.size <= opts.maxBytes) {
        return new File([blob], asWebpName(file.name), { type: opts.type });
      }
    }
  }

  // If we still couldn't fit, return the smallest we tried (last attempt)
  const blob = await canvasToBlob(canvas, opts.type, opts.qualities[opts.qualities.length - 1]);
  return new File([blob], asWebpName(file.name), { type: opts.type });
}

async function compressPresentImages(
  input: Record<ImageKey, File | null>,
  opts = COMPRESS
): Promise<Partial<Record<ImageKey, File>>> {
  const out: Partial<Record<ImageKey, File>> = {};
  const keys = IMAGE_KEYS.filter((k) => !!input[k]);
  for (const key of keys) {
    out[key] = await compressImageFile(input[key] as File, opts);
  }
  return out;
}

/* ===================== Outcome Classification (YouTube) ===================== */

type OutcomeKey =
  | "saved"
  | "duplicate"
  | "invalid"
  | "captcha"
  | "skipped_policy"
  | "no_handle"
  | "no_channel"
  | "error"
  | "unknown";

const OUTCOME_LABELS: Record<OutcomeKey, string> = {
  saved: "Saved",
  duplicate: "Duplicate",
  invalid: "Invalid",
  captcha: "Captcha",
  skipped_policy: "Skipped (policy)",
  no_handle: "No handle",
  no_channel: "No channel",
  error: "Error",
  unknown: "Unknown",
};

// Helpers for reading the batch response safely
const firstOf = <T,>(arr?: T[] | null) => (Array.isArray(arr) && arr.length ? arr[0] : null);

// Prefer normalized → YouTube (object.handle) → more_info.handles → parse more_info.YouTube
const pickEmail = (r: BatchItemResult) => r.normalized?.email ?? firstOf(r.more_info?.emails) ?? null;

const pickHandle = (r: BatchItemResult) =>
  r.normalized?.handle ??
  (r.youtube && typeof r.youtube === "object" ? r.youtube.handle ?? null : null) ??
  (Array.isArray(r.more_info?.handles) && r.more_info!.handles!.length ? r.more_info!.handles![0] : null) ??
  (typeof r.more_info?.YouTube === "string"
    ? (r.more_info!.YouTube!.match(/@[\w.-]+/i)?.[0] ?? null)
    : null);

function classifyResult(r: BatchItemResult): { key: OutcomeKey; text: string; reason: string } {
  // Success/duplicate short-circuit
  if (r.db?.saved) return { key: "saved", text: OUTCOME_LABELS.saved, reason: r.youtubeMessage || r.details?.message || "" };
  if (r.details?.outcome === "duplicate") return { key: "duplicate", text: OUTCOME_LABELS.duplicate, reason: r.details?.message || "" };

  // Captcha
  if (r.has_captcha) return { key: "captcha", text: OUTCOME_LABELS.captcha, reason: r.details?.message || r.youtubeMessage || "" };

  const err = (r.error || "").toLowerCase();
  const msgRaw = (r.youtubeMessage || r.details?.message || r.error || "").trim();

  // Policy skip (subscriber bounds etc.)
  if (err.includes("subscribercount") || (r.youtubeMessage || "").toLowerCase().includes("subscriber policy")) {
    return { key: "skipped_policy", text: OUTCOME_LABELS.skipped_policy, reason: msgRaw || "Subscriber policy" };
  }

  // No handle / no channel
  if (err.includes("no youtube handle found")) {
    return { key: "no_handle", text: OUTCOME_LABELS.no_handle, reason: msgRaw || "No @handle present" };
  }
  if (err.includes("no youtube channel found")) {
    return { key: "no_channel", text: OUTCOME_LABELS.no_channel, reason: msgRaw || "Handle has no channel" };
  }

  // Explicit invalid from backend
  if (r.details?.outcome === "invalid") {
    return { key: "invalid", text: OUTCOME_LABELS.invalid, reason: msgRaw || "Invalid submission" };
  }

  // Generic errors
  if (r.error) return { key: "error", text: OUTCOME_LABELS.error, reason: msgRaw };

  return { key: "unknown", text: OUTCOME_LABELS.unknown, reason: "" };
}

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

  const validateImages = (rules: LinkRules) => {
    const required = requiredKeysForRules(rules);

    const missing: ImageKey[] = required.filter((k) => !images[k]);

    const errors: string[] = [];
    for (const k of IMAGE_KEYS) {
      if (imageErrors[k]) errors.push(`${k}: ${imageErrors[k]}`);
    }

    return { ok: missing.length === 0 && errors.length === 0, missing, errors, required };
  };


  const handleEntrySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLink || !userProfile) return;

    const rules = getLinkRules(selectedLink);
    const { ok, missing, errors, required } = validateImages(rules);

    if (!ok) {
      const lines = [
        missing.length ? `Missing required: ${missing.join(", ")}` : "",
        ...errors
      ].filter(Boolean);

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: "Please fix the upload issues",
        text: lines.join(" | "),
        showConfirmButton: false,
        timer: 2600,
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

    // ✅ Compress only what user uploaded (required + optional)
    const compressedMap = await compressPresentImages(images);
    (Object.entries(compressedMap) as [ImageKey, File][]).forEach(([key, f]) => {
      form.append(key, f, f.name);
    });

    try {
      setSubmitting(true);

      // Optional: turn on debug via env
      const debug = process.env.NEXT_PUBLIC_VERIFY_DEBUG === "1";
      const url = debug ? "/entry/user?debug=1" : "/entry/user";

      const res = await api.post<SubmitEntryResponse>(url, form, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { verification: v, entry: en } = res.data;
      const comments = Array.isArray(v.comment) ? v.comment : [];
      const replies = Array.isArray(v.replies) ? v.replies : [];

      const likeLine = rules.requireLike
        ? `<p><b>Liked:</b> ${v.liked ? "Yes ✅" : "No ❌"}</p>`
        : `<p><b>Liked:</b> Not required</p>`;

      const html = `
      <div style="text-align:left">
        <p><b>Handle:</b> ${escapeHtml(v.user_id || "—")}</p>
        ${likeLine}
        ${rules.minComments >= 1 ? `<p><b>Comment 1:</b> ${escapeHtml(comments[0] || "—")}</p>` : ""}
        ${rules.minComments >= 2 ? `<p><b>Comment 2:</b> ${escapeHtml(comments[1] || "—")}</p>` : ""}
        ${rules.minReplies >= 1 ? `<p><b>Reply 1:</b> ${escapeHtml(replies[0] || "—")}</p>` : ""}
        ${rules.minReplies >= 2 ? `<p><b>Reply 2:</b> ${escapeHtml(replies[1] || "—")}</p>` : ""}
        <p><b>Amount will be paid:</b> ₹${escapeHtml(String(en.totalAmount))}</p>
        <p><b>Date:</b> ${escapeHtml(new Date(en.createdAt).toLocaleString("en-US", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
      }))}</p>
      </div>
    `;

      setModalOpen(false);
      await Swal.fire({ icon: "success", title: "Verified", html, confirmButtonText: "OK", width: 600 });

      fetchLinks();
      fetchEmailTasks();
      setSelectedLink(null);
      resetImageState();
      setEntryName("");
    } catch (err) {
      const { icon, title, text } = buildErrorToast(err);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon,
        title,
        text,
        showConfirmButton: false,
        timer: 3600,
        timerProgressBar: true,
      });
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

  const openEmailTask = (task: EmailTaskItem) => {
    setSelectedTask(task);
    setEmailShots([]);
    setEmailShotError("");
    setEmailModalOpen(true);
  };

  const handleEmailFilesChange = (files: FileList | null) => {
    if (!selectedTask) return;

    setEmailShotError("");
    const arr = files ? Array.from(files) : [];
    const max = selectedTask.maxEmails;

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

    // compress all selected files first
    const compressedFiles = await Promise.all(files.map(f => compressImageFile(f)));

    const form = new FormData();
    form.append("userId", userProfile.userId);
    form.append("taskId", selectedTask._id);
    compressedFiles.forEach((f) => form.append("screenshots", f, f.name));

    try {
      setEmailSubmitting(true);

      const { data } = await api.post<EmailTaskBatchResponse>("/email/user/extract", form, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const results = Array.isArray(data?.results) ? data.results : [];

      // Count all outcomes precisely
      const initCounts: Record<OutcomeKey, number> = {
        saved: 0,
        duplicate: 0,
        invalid: 0,
        captcha: 0,
        skipped_policy: 0,
        no_handle: 0,
        no_channel: 0,
        error: 0,
        unknown: 0,
      };
      const counts = results.reduce((acc, r) => {
        const { key } = classifyResult(r);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, { ...initCounts });

      // Build compact HTML table with Outcome + Reason
      const rows = results.map((r, i) => {
        const email = pickEmail(r) ?? "";
        const handle = pickHandle(r) ?? "";
        const { text, reason } = classifyResult(r);

        return `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${handle || "—"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${email || "—"}</td>
      <td style=\"padding:6px 8px;border-bottom:1px solid #eee;text-transform:capitalize;\">${text}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${reason ? String(reason).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "—"}</td>
    </tr>
  `;
      }).join("");

      // Helper to render count chips only when non-zero
      const chip = (label: string, n: number) =>
        n > 0 ? `<span style="display:inline-block;margin:2px 6px 2px 0;padding:3px 8px;border:1px solid #e5e7eb;border-radius:999px;font-size:12px;">${label}: <b>${n}</b></span>` : "";

      const html = `
      <div style="text-align:left">
        <p style="margin:8px 0;">
          <b>Processed:</b> ${data.accepted}/${data.maxImages}
        </p>
        <div style="margin:6px 0 10px;">
          ${chip("Saved", counts.saved)}
          ${chip("Duplicate", counts.duplicate)}
          ${chip("Invalid", counts.invalid)}
          ${chip("Captcha", counts.captcha)}
          ${chip("Skipped (policy)", counts.skipped_policy)}
          ${chip("No handle", counts.no_handle)}
          ${chip("No channel", counts.no_channel)}
          ${chip("Error", counts.error)}
          ${chip("Unknown", counts.unknown)}
        </div>
        <div style="max-height:300px;overflow:auto;border:1px solid #eee;border-radius:6px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#fafafa">
                <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">#</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Handle</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Email</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Outcome</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Reason</th>
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
      minComments: l.minComments,
      minReplies: l.minReplies,
      requireLike: l.requireLike,
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
  const rules = getLinkRules(selectedLink);
  const requiredKeys = requiredKeysForRules(rules);
  const isRequired = (k: ImageKey) => requiredKeys.includes(k);
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
              const { expired, label } = getTimeLeft(item.createdAt, (item as any).expireIn || 0);

              if (item.kind === "link") {

                const linkRules = getLinkRules(item as any);
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
                      {typeof (item as any).target === "number" && (
                        <div className="flex justify-between">
                          <span>Target</span>
                          <span className="font-medium">{(item as any).target}</span>
                        </div>
                      )}
                      {typeof (item as any).amount === "number" && (
                        <div className="flex justify-between">
                          <span>Amount</span>
                          <span className="font-semibold">₹{(item as any).amount}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Expires</span>
                        <span className={expired ? "text-gray-400" : "text-green-600"}>{label}</span>
                      </div>

                      <div className="mt-2 border-t pt-2 space-y-1">
                        <div className="flex justify-between">
                          <span>Like</span>
                          <span className="font-medium">{linkRules.requireLike ? "Required" : "Not required"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Comments</span>
                          <span className="font-medium">Min {linkRules.minComments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Replies</span>
                          <span className="font-medium">Min {linkRules.minReplies}</span>
                        </div>
                      </div>

                    </CardContent>

                    <CardFooter className="p-4 pt-0">
                      {/* user can add entry for ANY non-expired, non-completed production */}
                      {item.isCompleted === 0 && !expired && (
                        <div className="w-full flex flex-col sm:flex-row gap-2 sm:justify-end">
                          <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            size="sm"
                            onClick={() => handleCopy((item as any).title)}
                          >
                            <ClipboardCopyIcon className="h-4 w-4 mr-1" /> Copy
                          </Button>
                          <Button
                            className="w-full sm:w-auto"
                            size="sm"
                            onClick={() =>
                              openEntryModal({
                                _id: item._id,
                                title: (item as any).title,
                                isLatest: !!item.isLatest,
                                target: (item as any).target,
                                amount: (item as any).amount,
                                createdAt: item.createdAt,
                                expireIn: (item as any).expireIn,
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
              const t = item as Extract<MergedItem, { kind: "task" }>;
              return (
                <Card
                  key={`task-${t._id}`}
                  className={`group rounded-xl hover:shadow-lg transition-shadow bg-white border shadow-sm ${t.isLatest ? "border-blue-500" : "border-gray-200"
                    }`}
                >
                  <CardHeader className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base sm:text-lg font-medium text-gray-800 break-words">
                        {t.targetUser || "Email Task"}
                      </CardTitle>

                      {/* status-aware badge */}
                      {(() => {
                        const done = Number(t.doneCount ?? 0);
                        const hasProgress = done > 0;
                        const status =
                          t.isCompleted === 1
                            ? { text: "Completed", cls: "border-green-500 text-green-600" }
                            : t.isPartial === 1 || hasProgress
                              ? { text: "In progress", cls: "border-amber-500 text-amber-600" }
                              : t.isLatest
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
                      <span className="font-medium">{t.platform}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Target / employee</span>
                      <span className="font-medium">{t.targetPerEmployee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount / person</span>
                      <span className="font-semibold">₹{t.amountPerPerson}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max screenshots</span>
                      <span className="font-medium">{t.maxEmails}</span>
                    </div>

                    {/* progress (doneCount / maxEmails) */}
                    {(() => {
                      const done = Number(t.doneCount ?? 0);
                      const target = Number(t.maxEmails ?? 0);
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
                          getTimeLeft(t.createdAt, t.expireIn).expired ? "text-gray-400" : "text-blue-600"
                        }
                      >
                        {label}
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    {(() => {
                      const expiredTask = getTimeLeft(t.createdAt, t.expireIn).expired;
                      if (t.isCompleted === 1) return null;
                      if (!expiredTask) {
                        const hasProgress = (t.isPartial === 1) || (Number(t.doneCount ?? 0) > 0);
                        return (
                          <div className="w-full flex sm:justify-end">
                            <Button
                              className="w-full sm:w-auto"
                              size="sm"
                              onClick={() =>
                                openEmailTask({
                                  _id: t._id,
                                  createdAt: t.createdAt,
                                  expireIn: t.expireIn,
                                  isLatest: t.isLatest,
                                  platform: t.platform,
                                  targetUser: t.targetUser,
                                  targetPerEmployee: t.targetPerEmployee,
                                  amountPerPerson: t.amountPerPerson,
                                  maxEmails: t.maxEmails,
                                  createdBy: "",
                                  isCompleted: t.isCompleted ?? 0,
                                  isPartial: t.isPartial ?? 0,
                                  doneCount: t.doneCount ?? 0,
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

      {/* Add Entry Dialog (Links) */}
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
                        <span className="text-sm font-semibold capitalize flex items-center gap-2">
                          {key === "like"
                            ? "Like"
                            : key === "comment1"
                              ? "Comment 1"
                              : key === "comment2"
                                ? "Comment 2"
                                : key === "reply1"
                                  ? "Reply 1"
                                  : "Reply 2"}
                          {isRequired(key) && (
                            <span className="text-[10px] px-2 py-[2px] rounded-full border bg-white">
                              Required
                            </span>
                          )}
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
