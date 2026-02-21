"use client";

import React, { useCallback, useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
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
  MailCheck as MailCheckIcon,
  X as XIcon,
} from "lucide-react";

import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

/* ===================== Types ===================== */
type CountryOption = { value: string; label?: string };

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

interface ScreenshotAction {
  kind: "comment" | "reply";
  videoId: string;
  commentId: string;
  parentId?: string | null;
  permalink: string;
  text?: string | null;
  authorChannelId?: string | null;
  publishedAt?: string | null;
}

interface ScreenshotDoc {
  screenshotId: string;
  linkId: string;
  userId: string;
  videoId: string;
  channelId: string;
  commentIds?: string[];
  replyIds?: string[];
  actions: ScreenshotAction[];
  createdAt: string;
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

  minComments?: number; // 0..2
  minReplies?: number; // 0..2
  requireLike?: boolean; // NOT supported for API-key method
}

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
  doneCount?: number;
  minFollowers?: number;
  maxFollowers?: number;
  countries?: CountryOption[];
  categories?: string[];
}

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
    minFollowers?: number;
    maxFollowers?: number;
    countries?: CountryOption[];
    categories?: string[];
  };

interface UserProfile {
  _id: string;
  userId: string;
  name: string;
  phone: number;
  email: string;
  upiId: string;
  worksUnder: string;
  ytChannelId?: string; // (optional / legacy)
}

interface SubmitVerificationYT {
  verified: boolean;
  channel_id: string;
  comments: string[]; // returned IDs
  replies: string[]; // returned IDs
  reasons: string[];
  rules: { min_comments: number; min_replies: number; require_like: boolean };
}

interface SubmitEntryResponse {
  message: string;
  verification: SubmitVerificationYT;
  screenshot?: ScreenshotDoc;
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

const fmtFollowers = (n?: number) =>
  typeof n === "number" && isFinite(n) ? new Intl.NumberFormat("en-IN").format(n) : "—";

const fmtFollowersRange = (min?: number, max?: number) => {
  const hasMin = typeof min === "number" && isFinite(min);
  const hasMax = typeof max === "number" && isFinite(max);
  if (!hasMin && !hasMax) return "Any";
  if (hasMin && hasMax) return `${fmtFollowers(min)} - ${fmtFollowers(max)}`;
  if (hasMin) return `≥ ${fmtFollowers(min)}`;
  return `≤ ${fmtFollowers(max)}`;
};

type CountryLike = CountryOption | string;

function normalizeCountries(input?: CountryLike[] | null) {
  const raw = Array.isArray(input) ? input : [];
  const cleaned = raw
    .map((c: any) => {
      const value = (c?.value ?? c)?.toString?.() ?? "";
      const label = (c?.label ?? c?.name ?? c?.value ?? c)?.toString?.() ?? "";
      return { value: value.trim(), label: label.trim() };
    })
    .filter((c) => c.value || c.label);

  // Deduplicate by normalized value/label
  const seen = new Set<string>();
  const deduped = cleaned.filter((c) => {
    const key = (c.value || c.label).toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const tokens = deduped.map((c) => (c.value || c.label).toUpperCase());
  const isAll =
    tokens.includes("ANY") || tokens.includes("ALL") || tokens.includes("*") || tokens.includes("GLOBAL");

  if (isAll) return { mode: "all" as const, items: [] as { value: string; label: string }[] };

  // If nothing, treat as Any
  if (!deduped.length) return { mode: "any" as const, items: [] as { value: string; label: string }[] };

  return { mode: "list" as const, items: deduped };
}

function CountriesBadges({
  countries,
  maxVisible = 4,
}: {
  countries?: CountryLike[] | null;
  maxVisible?: number;
}) {
  const normalized = normalizeCountries(countries);

  if (normalized.mode === "all")
    return <Badge variant="outline" className="bg-transparent">All Countries</Badge>;

  if (normalized.mode === "any")
    return <Badge variant="outline" className="bg-transparent">Any</Badge>;

  const items = normalized.items;
  const visible = items.slice(0, maxVisible);
  const hidden = items.length - visible.length;

  const fullText = items.map((c) => c.label || c.value).join(", ");

  return (
    <div
      className="flex flex-wrap justify-end gap-1 max-w-full overflow-hidden"
      title={fullText}
    >
      {visible.map((c, idx) => (
        <Badge
          key={`${c.value}-${idx}`}
          variant="secondary"
          className="text-xs max-w-full truncate"
        >
          {(c.label || c.value).toUpperCase()}
        </Badge>
      ))}
      {hidden > 0 && (
        <Badge variant="outline" className="bg-transparent text-xs shrink-0">
          +{hidden}
        </Badge>
      )}
    </div>
  );
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

const escapeHtml = (s: string) =>
  String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const formatMB = (bytes?: number) =>
  typeof bytes === "number" && isFinite(bytes) ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : "";

const isAxiosErr = (e: unknown): e is import("axios").AxiosError<any> => axios.isAxiosError(e);

type LinkRules = { minComments: number; minReplies: number; requireLike: boolean };

const clamp02 = (v: any, def: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(0, Math.min(2, Math.floor(n)));
};

const getLinkRules = (link: LinkItem | null): LinkRules => {
  const minComments = clamp02((link as any)?.minComments, 2);
  const minReplies = clamp02((link as any)?.minReplies, 2);
  const requireLike = Boolean((link as any)?.requireLike ?? false);
  if (minComments === 0 && minReplies === 0) return { minComments: 2, minReplies: 2, requireLike };
  return { minComments, minReplies, requireLike };
};

/* ===================== YouTube permalink parsing (ONLY from comment/reply links) ===================== */

const YT_VIDEO_ID_RE = /(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&#/]|$)/;

function safeUrl(input: string): URL | null {
  const s = (input || "").trim();
  if (!s) return null;
  try {
    return new URL(s);
  } catch {
    // try to rescue common copy/paste without protocol
    try {
      return new URL("https://" + s.replace(/^\/\//, ""));
    } catch {
      return null;
    }
  }
}

function extractYouTubeVideoId(input: string): string | null {
  const u = safeUrl(input);
  if (u) {
    // watch?v=
    const v = u.searchParams.get("v");
    if (v && /^[0-9A-Za-z_-]{11}$/.test(v)) return v;

    // youtu.be/ID, /shorts/ID, /embed/ID
    const path = u.pathname || "";
    const m = path.match(/\/(shorts|embed)\//);
    if (m) {
      const after = path.split(m[0])[1] || "";
      const id = after.split("/")[0];
      if (/^[0-9A-Za-z_-]{11}$/.test(id)) return id;
    }
    const seg = path.split("/").filter(Boolean);
    if (u.hostname.includes("youtu.be") && seg[0] && /^[0-9A-Za-z_-]{11}$/.test(seg[0])) return seg[0];

    // fallback regex on full url
    const m2 = (u.toString() || "").match(YT_VIDEO_ID_RE);
    return m2?.[1] ?? null;
  }

  // final fallback: regex on raw input
  const m = (input || "").match(YT_VIDEO_ID_RE);
  return m?.[1] ?? null;
}

function extractLcParam(input: string): string | null {
  const u = safeUrl(input);
  if (u) {
    const lc = u.searchParams.get("lc");
    return lc ? decodeURIComponent(lc) : null;
  }
  // fallback regex
  const m = (input || "").match(/[?&]lc=([^&]+)/i);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

type ParsedYtPermalink = {
  raw: string;
  videoId: string | null;
  lc: string | null; // comment key OR "parent.replyKey" (permalink style)
  kind: "comment" | "reply" | "unknown";
  parentId?: string;
  replyKey?: string;
};

function parseYtPermalink(link: string): ParsedYtPermalink {
  const raw = (link || "").trim();
  const videoId = extractYouTubeVideoId(raw);
  const lc = extractLcParam(raw);

  if (!videoId || !lc) return { raw, videoId, lc, kind: "unknown" };

  if (lc.includes(".")) {
    const [parentId, replyKey] = lc.split(".", 2);
    return { raw, videoId, lc, kind: "reply", parentId, replyKey };
  }

  return { raw, videoId, lc, kind: "comment" };
}

function deriveCampaignVideoId(selectedLink: LinkItem | null): string | null {
  // Your "title" is being copied, so it’s usually the campaign video URL.
  // If it's not a URL, we just return null and validate using first comment/reply link.
  return selectedLink?.title ? extractYouTubeVideoId(selectedLink.title) : null;
}

/* ===================== Frontend Compression (Email tasks) ===================== */

const COMPRESS = {
  maxWidth: 1400,
  maxBytes: 9.5 * 1024 * 1024,
  type: "image/webp" as const,
  qualities: [0.82, 0.72, 0.62, 0.52, 0.42],
  scaleSteps: [1, 0.9, 0.8, 0.7],
};

const asWebpName = (name: string) => name.replace(/\.(jpe?g|png|webp)$/i, "") + ".webp";

async function fileToBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      // @ts-ignore
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch { }
  }
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
  if ("OffscreenCanvas" in window) {
    // @ts-ignore
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function drawToCanvas(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number
): HTMLCanvasElement | OffscreenCanvas {
  const canvas = makeCanvas(width, height);
  // @ts-ignore
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source as any, 0, 0, width, height);
  }
  return canvas;
}

async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    // @ts-ignore
    return await canvas.convertToBlob({ type, quality });
  }
  return await new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      type,
      quality
    );
  });
}

async function compressImageFile(file: File, opts = COMPRESS): Promise<File> {
  const bmp = await fileToBitmap(file);
  const srcW = "width" in bmp ? (bmp as any).width : (bmp as HTMLImageElement).naturalWidth;
  const srcH = "height" in bmp ? (bmp as any).height : (bmp as HTMLImageElement).naturalHeight;

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

  const blob = await canvasToBlob(canvas, opts.type, opts.qualities[opts.qualities.length - 1]);
  return new File([blob], asWebpName(file.name), { type: opts.type });
}

/* ===================== Outcome Classification (Email task) ===================== */

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

const firstOf = <T,>(arr?: T[] | null) => (Array.isArray(arr) && arr.length ? arr[0] : null);

const pickEmail = (r: BatchItemResult) => r.normalized?.email ?? firstOf(r.more_info?.emails) ?? null;

const pickHandle = (r: BatchItemResult) =>
  r.normalized?.handle ??
  (r.youtube && typeof r.youtube === "object" ? r.youtube.handle ?? null : null) ??
  (Array.isArray(r.more_info?.handles) && r.more_info!.handles!.length ? r.more_info!.handles![0] : null) ??
  (typeof r.more_info?.YouTube === "string" ? r.more_info!.YouTube!.match(/@[\w.-]+/i)?.[0] ?? null : null);

function classifyResult(r: BatchItemResult): { key: OutcomeKey; text: string; reason: string } {
  if (r.db?.saved) return { key: "saved", text: OUTCOME_LABELS.saved, reason: r.youtubeMessage || r.details?.message || "" };
  if (r.details?.outcome === "duplicate") return { key: "duplicate", text: OUTCOME_LABELS.duplicate, reason: r.details?.message || "" };
  if (r.has_captcha) return { key: "captcha", text: OUTCOME_LABELS.captcha, reason: r.details?.message || r.youtubeMessage || "" };

  const err = (r.error || "").toLowerCase();
  const msgRaw = (r.youtubeMessage || r.details?.message || r.error || "").trim();

  if (err.includes("subscribercount") || (r.youtubeMessage || "").toLowerCase().includes("subscriber policy")) {
    return { key: "skipped_policy", text: OUTCOME_LABELS.skipped_policy, reason: msgRaw || "Subscriber policy" };
  }
  if (err.includes("no youtube handle found")) return { key: "no_handle", text: OUTCOME_LABELS.no_handle, reason: msgRaw || "No @handle present" };
  if (err.includes("no youtube channel found")) return { key: "no_channel", text: OUTCOME_LABELS.no_channel, reason: msgRaw || "Handle has no channel" };
  if (r.details?.outcome === "invalid") return { key: "invalid", text: OUTCOME_LABELS.invalid, reason: msgRaw || "Invalid submission" };
  if (r.error) return { key: "error", text: OUTCOME_LABELS.error, reason: msgRaw };
  return { key: "unknown", text: OUTCOME_LABELS.unknown, reason: "" };
}

/* ===================== Error Toast (supports YouTube verification) ===================== */

const buildErrorToast = (err: unknown) => {
  let icon: "error" | "warning" | "info" = "error";
  let title = "Submission failed";
  let text = "Please try again.";

  // @ts-ignore
  if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) {
    return { icon: "error" as const, title: "You're offline", text: "Reconnect and try again." };
  }
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
    case "UPI_MISMATCH":
      text = "The UPI ID in your profile must match exactly (case-insensitive).";
      icon = "warning";
      break;
    case "INVALID_UPI":
      text = "Please double-check your UPI format.";
      icon = "warning";
      break;

    // YouTube verification
    case "NOT_ENOUGH_COMMENTS":
      text = "Please paste the required YouTube comment link(s).";
      icon = "warning";
      break;
    case "NOT_ENOUGH_REPLIES":
      text = "Please paste the required YouTube reply link(s).";
      icon = "warning";
      break;
    case "INVALID_PERMALINK":
      text = "Invalid YouTube permalink. Use Share → Copy link from the comment/reply.";
      icon = "warning";
      break;
    case "COMMENT_LINK_MUST_BE_TOPLEVEL":
      text = "Comment links must be top-level comments (not replies).";
      icon = "warning";
      break;
    case "WRONG_VIDEO":
      text = "One or more links are from the wrong video. Use the campaign video only.";
      icon = "warning";
      break;
    case "LIKE_NOT_SUPPORTED":
      text = "Like verification is not supported in API-key mode. Ask admin to disable requireLike.";
      icon = "warning";
      break;
    case "YT_API_ERROR":
      text = "YouTube verification service error. Try again in a moment.";
      icon = "error";
      break;
    case "ALREADY_USED":
      text = "These comment/reply IDs were already used for this campaign.";
      icon = "warning";
      break;
    case "DUPLICATE_VERIFICATION":
      text = "Verification already exists (or comment/reply already used).";
      icon = "warning";
      break;

    default: {
      if (status === 413) {
        title = "Files too large";
        text = "One or more images exceed the size limit. Please compress and retry.";
        icon = "warning";
      } else if (status === 409) {
        title = "Duplicate submission";
        text = "A matching submission already exists.";
        icon = "warning";
      } else if (status === 422) {
        title = "Verification failed";
        text = "Verification failed. Please ensure your comments/replies are public and correct.";
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

  // ✅ YouTube proof inputs (ONLY comment/reply links; we derive IDs + videoId from these links)
  const [commentLinks, setCommentLinks] = useState<string[]>(["", ""]);
  const [replyLinks, setReplyLinks] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);

  // Email task screenshots modal + selection
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<EmailTaskItem | null>(null);
  const [emailShots, setEmailShots] = useState<File[]>([]);
  const [emailShotError, setEmailShotError] = useState<string>("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // Profile (read-only)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [entryName, setEntryName] = useState("");
  const [userUpi, setUserUpi] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [worksUnder, setWorksUnder] = useState<string>("");

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

  /* ===================== Data loaders ===================== */

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

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  useEffect(() => {
    fetchEmailTasks();
  }, [fetchEmailTasks]);

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
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Link copied",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
    } catch {
      Swal.fire({ toast: true, position: "top-end", icon: "error", title: "Copy failed", showConfirmButton: false, timer: 1500 });
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    Swal.fire({ toast: true, position: "top-end", icon: "info", title: "Logged out", showConfirmButton: false, timer: 1500, timerProgressBar: true });
    router.push("/user/login");
  };

  /* ===================== Link Entry (YouTube API verification via permalinks ONLY) ===================== */

  const resetYtState = () => {
    setCommentLinks(["", ""]);
    setReplyLinks(["", ""]);
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

    resetYtState();
    setModalOpen(true);
  };

  const handleEntrySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLink || !userProfile) return;

    const rules = getLinkRules(selectedLink);

    const cLinks = commentLinks.map((s) => (s || "").trim()).filter(Boolean);
    const rLinks = replyLinks.map((s) => (s || "").trim()).filter(Boolean);

    // basic counts
    if (cLinks.length < rules.minComments) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: "Missing comment links",
        text: `Need ${rules.minComments} comment link(s).`,
        showConfirmButton: false,
        timer: 2400,
        timerProgressBar: true,
      });
      return;
    }

    if (rLinks.length < rules.minReplies) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: "Missing reply links",
        text: `Need ${rules.minReplies} reply link(s).`,
        showConfirmButton: false,
        timer: 2400,
        timerProgressBar: true,
      });
      return;
    }

    // parse permalinks
    const parsedComments = cLinks.slice(0, rules.minComments).map(parseYtPermalink);
    const parsedReplies = rLinks.slice(0, rules.minReplies).map(parseYtPermalink);

    // validate permalink structure
    const bad = [...parsedComments, ...parsedReplies].find((p) => !p.videoId || !p.lc);
    if (bad) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: "Invalid permalink",
        text: "Use Share → Copy link from the YouTube comment / reply.",
        showConfirmButton: false,
        timer: 2600,
        timerProgressBar: true,
      });
      return;
    }

    // enforce kinds
    const badComment = parsedComments.find((p) => p.kind !== "comment");
    if (badComment) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: "Comment link must be a top-level comment",
        text: "Open the main comment (not a reply) → Share → Copy link.",
        showConfirmButton: false,
        timer: 2800,
        timerProgressBar: true,
      });
      return;
    }

    const badReply = parsedReplies.find((p) => p.kind !== "reply");
    if (badReply) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: "Reply link must be a reply permalink",
        text: "Open the reply itself → Share → Copy link (reply link usually contains lc=parent.replyKey).",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    // Determine campaign video ID (prefer campaign link; fallback to first permalink’s videoId)
    const campaignVideoId = deriveCampaignVideoId(selectedLink);
    const refVideoId = campaignVideoId || parsedComments[0].videoId || parsedReplies[0].videoId;

    // Ensure all permalinks are from same video
    const wrongVideo = [...parsedComments, ...parsedReplies].some((p) => p.videoId !== refVideoId);
    if (wrongVideo) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: "Wrong video",
        text: "One or more permalinks are from a different YouTube video. Use the campaign video only.",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    // Extract IDs from lc (needed for backend verification)
    const commentIds = parsedComments.map((p) => p.lc as string);
    const replyIds = parsedReplies.map((p) => p.lc as string);

    const payload = {
      userId: userProfile.userId,
      linkId: selectedLink._id,
      name: entryName,
      worksUnder,
      upiId: userUpi,

      ytVideoId: refVideoId,
      commentIds,
      replyIds,

      // optional for audits/debug
      commentLinks: cLinks.slice(0, rules.minComments),
      replyLinks: rLinks.slice(0, rules.minReplies),
    };

    // Swal render helpers
    const escapeAttr = (s: string) => escapeHtml(String(s)).replaceAll('"', "&quot;");
    const fmtDT = (iso?: string | null) =>
      iso
        ? new Date(iso).toLocaleString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
        : "—";

    const badge = (label: string, value: string) =>
      `<span style="display:inline-block;margin:2px 6px 2px 0;padding:3px 8px;border:1px solid #e5e7eb;border-radius:999px;font-size:12px;">
      ${escapeHtml(label)}: <b>${escapeHtml(value)}</b>
    </span>`;

    const renderActionsTable = (actions: ScreenshotAction[]) => {
      const rows = actions.length
        ? actions
          .map((a, i) => {
            const kind = a.kind || "—";
            const text = a.text || "—";
            const author = a.authorChannelId || "—";
            const published = fmtDT(a.publishedAt);
            const link = a.permalink
              ? `<a href="${escapeAttr(a.permalink)}" target="_blank" rel="noopener noreferrer">Open</a>`
              : "—";

            return `
              <tr>
                <td style="padding:6px 8px;border-bottom:1px solid #eee;">${i + 1}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eee;text-transform:capitalize;">${escapeHtml(kind)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(text)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eee;white-space:nowrap;">${link}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eee;white-space:nowrap;">${escapeHtml(published)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(author)}</td>
              </tr>
            `;
          })
          .join("")
        : `<tr><td colspan="6" style="padding:10px;color:#666;">No actions found.</td></tr>`;

      return `
      <div style="max-height:340px;overflow:auto;border:1px solid #eee;border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#fafafa">
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">#</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Type</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Text</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Link</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Published</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;">Author</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    };

    try {
      setSubmitting(true);

      const res = await api.post<SubmitEntryResponse>("/entry/user", payload, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      });

      const { verification: v, entry: en, screenshot: sc } = res.data;

      const actions = Array.isArray(sc?.actions) ? sc!.actions : [];
      const comments = actions.filter((a) => a.kind === "comment");
      const replies = actions.filter((a) => a.kind === "reply");

      const reasonsHtml =
        Array.isArray(v.reasons) && v.reasons.length
          ? `<div style="margin-top:8px;padding:8px;border:1px dashed #e5e7eb;border-radius:8px;">
            <b>Reasons:</b>
            <ul style="margin:6px 0 0 18px;">${v.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
          </div>`
          : "";

      const html = `
      <div style="text-align:left">
        <p><b>Verified:</b> ${v.verified ? "Yes ✅" : "No ❌"}</p>
        <div style="margin:6px 0 10px;">
          ${badge("Channel ID", v.channel_id || "—")}
          ${badge("Video ID", refVideoId || "—")}
          ${badge("Comments", String(comments.length))}
          ${badge("Replies", String(replies.length))}
        </div>

        ${actions.length ? renderActionsTable(actions) : `<p style="color:#666">No action details returned.</p>`}

        ${reasonsHtml}

        <div style="margin-top:10px;">
          <p><b>Amount will be paid:</b> ₹${escapeHtml(String(en.totalAmount))}</p>
          <p><b>Date:</b> ${escapeHtml(fmtDT(en.createdAt))}</p>
        </div>
      </div>
    `;

      setModalOpen(false);
      await Swal.fire({
        icon: v.verified ? "success" : "warning",
        title: v.verified ? "Verified" : "Verification Result",
        html,
        confirmButtonText: "OK",
        width: 900,
      });

      fetchLinks();
      fetchEmailTasks();
      setSelectedLink(null);
      resetYtState();
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

  /* ===================== Email task screenshots ===================== */

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
      if (validated.length >= max) break;
    }

    setEmailShots(validated);
  };

  const removeEmailFileAt = (idx: number) => {
    setEmailShots((prev) => prev.filter((_, i) => i !== idx));
  };

  const validateEmailShots = () => {
    if (!selectedTask) return { ok: false, err: "No task selected." };
    if (emailShots.length === 0) return { ok: false, err: "Please select at least one screenshot." };
    if (emailShots.length > selectedTask.maxEmails) return { ok: false, err: `You can upload at most ${selectedTask.maxEmails} screenshots for this task.` };
    if (emailShotError) return { ok: false, err: emailShotError };
    return { ok: true, err: "" };
  };

  const submitEmailTaskShots = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !userProfile) return;

    const { ok, err } = validateEmailShots();
    if (!ok) {
      Swal.fire({ toast: true, position: "top-end", icon: "warning", title: "Please fix the upload issues", text: err, showConfirmButton: false, timer: 2500, timerProgressBar: true });
      return;
    }

    const files = emailShots.slice(0, selectedTask.maxEmails);
    const compressedFiles = await Promise.all(files.map((f) => compressImageFile(f)));

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

      const rows = results
        .map((r, i) => {
          const email = pickEmail(r) ?? "";
          const handle = pickHandle(r) ?? "";
          const { text, reason } = classifyResult(r);
          return `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${i + 1}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${handle || "—"}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${email || "—"}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;text-transform:capitalize;">${text}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${reason ? String(reason).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "—"
            }</td>
            </tr>
          `;
        })
        .join("");

      const chip = (label: string, n: number) =>
        n > 0
          ? `<span style="display:inline-block;margin:2px 6px 2px 0;padding:3px 8px;border:1px solid #e5e7eb;border-radius:999px;font-size:12px;">${label}: <b>${n}</b></span>`
          : "";

      const html = `
        <div style="text-align:left">
          <p style="margin:8px 0;"><b>Processed:</b> ${data.accepted}/${data.maxImages}</p>
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

      await Swal.fire({ icon: "success", title: "Processed screenshots", html, confirmButtonText: "OK", width: 720 });

      resetEmailTaskState();
    } catch (err) {
      const { icon, title, text } = buildErrorToast(err);
      Swal.fire({ toast: true, position: "top-end", icon, title, text, showConfirmButton: false, timer: 3200, timerProgressBar: true });
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
      minFollowers: t.minFollowers,
      maxFollowers: t.maxFollowers,
      countries: t.countries,
      categories: t.categories,
    }));

    return [...linkItems, ...taskItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [links, emailTasks]);

  const anyLoading = loadingLinks || loadingTasks;
  const anyError = errorLinks || errorTasks;

  if (anyLoading) return <div className="flex justify-center items-center h-[60vh] text-sm">Loading...</div>;
  if (anyError) return <div className="text-center text-red-600 py-10 px-4">{anyError}</div>;

  /* ===================== Render ===================== */

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

      {/* Feed */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {mergedItems.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">Nothing available right now.</Card>
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
                        <CardTitle className="text-base sm:text-lg font-medium text-gray-800 flex-1 min-w-0 break-words">{item.title}</CardTitle>
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
                      {item.isCompleted === 0 && !expired && (
                        <div className="w-full flex flex-col sm:flex-row gap-2 sm:justify-end">
                          <Button variant="outline" className="w-full sm:w-auto" size="sm" onClick={() => handleCopy((item as any).title)}>
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
                                minComments: (item as any).minComments,
                                minReplies: (item as any).minReplies,
                                requireLike: (item as any).requireLike,
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
                  className={`group rounded-xl hover:shadow-lg transition-shadow bg-white border shadow-sm ${t.isLatest ? "border-blue-500" : "border-gray-200"}`}
                >
                  <CardHeader className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base sm:text-lg font-medium text-gray-800 break-words">{t.targetUser || "Email Task"}</CardTitle>

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

                    <div className="flex justify-between">
                      <span>Followers</span>
                      <span className="font-medium">{fmtFollowersRange(t.minFollowers, t.maxFollowers)}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="text-gray-700 shrink-0">Countries</span>

                      <div className="flex-1 min-w-0">
                        <CountriesBadges countries={t.countries} maxVisible={6} />
                      </div>
                    </div>

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
                            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex justify-between">
                      <span>Expires</span>
                      <span className={getTimeLeft(t.createdAt, t.expireIn).expired ? "text-gray-400" : "text-blue-600"}>{label}</span>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    {(() => {
                      const expiredTask = getTimeLeft(t.createdAt, t.expireIn).expired;
                      if (t.isCompleted === 1) return null;
                      if (!expiredTask) {
                        const hasProgress = t.isPartial === 1 || Number(t.doneCount ?? 0) > 0;
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
                                  minFollowers: t.minFollowers,
                                  maxFollowers: t.maxFollowers,
                                  countries: t.countries,
                                  categories: t.categories,
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

      {/* Add Entry Dialog (Links) — YouTube permalinks only */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetYtState();
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

              {/* YouTube proof inputs */}
              <div className="space-y-3">
                <div className="border rounded-xl p-3 bg-gray-50">
                  <p className="text-sm font-medium text-gray-900">YouTube Verification</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Paste only <b>comment links</b> and <b>reply links</b>. We auto-extract the YouTube IDs from these permalinks.
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Campaign video detected: <b>{deriveCampaignVideoId(selectedLink) || "—"}</b>
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">Comment Links (2)</p>
                  {[0, 1].map((idx) => (
                    <label key={`c-${idx}`} className="block">
                      <span className="text-xs text-gray-600">Comment {idx + 1} permalink</span>
                      <Input
                        value={commentLinks[idx] || ""}
                        onChange={(e) =>
                          setCommentLinks((prev) => {
                            const copy = [...prev];
                            copy[idx] = e.target.value;
                            return copy;
                          })
                        }
                        placeholder="https://www.youtube.com/watch?v=...&lc=COMMENT_ID"
                      />
                    </label>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">Reply Links (2)</p>
                  {[0, 1].map((idx) => (
                    <label key={`r-${idx}`} className="block">
                      <span className="text-xs text-gray-600">Reply {idx + 1} permalink</span>
                      <Input
                        value={replyLinks[idx] || ""}
                        onChange={(e) =>
                          setReplyLinks((prev) => {
                            const copy = [...prev];
                            copy[idx] = e.target.value;
                            return copy;
                          })
                        }
                        placeholder="https://www.youtube.com/watch?v=...&lc=PARENT_ID.REPLY_KEY"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  resetYtState();
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

      {/* Email Task Screenshots Dialog */}
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

                <div className="flex justify-between mt-1">
                  <span className="text-gray-700">Followers</span>
                  <span className="font-medium">
                    {fmtFollowersRange(selectedTask?.minFollowers, selectedTask?.maxFollowers)}
                  </span>
                </div>

                <div className="flex items-start gap-2 mt-1">
                  <span className="text-gray-700 shrink-0">Countries</span>
                  <div className="flex-1 min-w-0">
                    <CountriesBadges countries={selectedTask?.countries} maxVisible={6} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Screenshots</span>
                  <span className="text-xs text-gray-500">Accepted: JPG/PNG/WebP • Max 10MB each</span>
                </div>

                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleEmailFilesChange(e.target.files)}
                  className="file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:bg-white file:hover:bg-gray-50 file:text-sm"
                  aria-label="Upload screenshots"
                />

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
