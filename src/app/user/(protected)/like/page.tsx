"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Heart as HeartIcon, Upload as UploadIcon } from "lucide-react";
import Swal from "sweetalert2";

interface LikeTaskItem {
    _id: string;
    title: string;
    videoUrl?: string;
    createdBy?: string;
    target?: number;
    amount?: number;
    expireIn?: number;
    requireLike?: boolean;
    createdAt: string;
    updatedAt?: string;
}

interface LikeTaskStatus {
    taskId: string;
    userId: string;
    likeLinkId: string;
    completedCount: number;
    completedEmails: string[];
    activeEmail: string | null;
    activeAuthExpiresAt: string | null;
    authWindowSeconds: number;
    locked: boolean;
}

export default function LikePage() {
    const router = useRouter();
    const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const [tasks, setTasks] = useState<LikeTaskItem[]>([]);
    const [statusMap, setStatusMap] = useState<Record<string, LikeTaskStatus>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [now, setNow] = useState(Date.now());
    const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

    const userId =
        typeof window !== "undefined" ? localStorage.getItem("userId") || "" : "";

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const fetchLikeTasks = useCallback(async () => {
        try {
            setLoading(true);

            const res = await api.get("/admin/likelinks", { withCredentials: true });
            const payload = res.data;

            const list = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.tasks)
                    ? payload.tasks
                    : Array.isArray(payload?.data)
                        ? payload.data
                        : [];

            setTasks(list as LikeTaskItem[]);
            setError("");
        } catch (err: any) {
            setError(err?.response?.data?.error || err?.response?.data?.message || "Unable to load like tasks.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchStatuses = useCallback(async () => {
        if (!userId) return;

        try {
            const res = await api.get("/like-task/my-status", {
                params: { userId },
                withCredentials: true,
            });

            const rows = Array.isArray(res.data?.tasks) ? res.data.tasks : [];
            const map: Record<string, LikeTaskStatus> = {};

            rows.forEach((row: LikeTaskStatus) => {
                map[row.likeLinkId] = row;
            });

            setStatusMap(map);
        } catch {
            // keep silent
        }
    }, [userId]);

    useEffect(() => {
        fetchLikeTasks();
    }, [fetchLikeTasks]);

    useEffect(() => {
        fetchStatuses();
    }, [fetchStatuses]);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const data = event.data;

            if (!data || typeof data !== "object") return;

            if (data.type === "LIKE_TASK_AUTH_SUCCESS") {
                Swal.fire({
                    icon: "success",
                    title: "Google authenticated",
                    text: `Authenticated with ${data.email}. Complete the like + screenshot upload in 5 minutes.`,
                });
                fetchStatuses();
            }

            if (data.type === "LIKE_TASK_AUTH_ERROR") {
                Swal.fire({
                    icon: "error",
                    title: "Authentication failed",
                    text: data.message || "Google authentication failed",
                });
            }
        };

        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, [fetchStatuses]);

    const getOverallTimeLeft = (createdAt: string, expireIn: number = 0) => {
        const expiry = new Date(new Date(createdAt).getTime() + expireIn * 3600 * 1000);
        const diff = expiry.getTime() - now;

        if (diff <= 0) return { expired: true, label: "Expired" } as const;

        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);

        return { expired: false, label: `${hrs}h ${mins}m` } as const;
    };

    const getTaskTimer = (status?: LikeTaskStatus) => {
        if (!status?.activeAuthExpiresAt) {
            return { active: false, label: "00:00" };
        }

        const diff = new Date(status.activeAuthExpiresAt).getTime() - now;
        if (diff <= 0) {
            return { active: false, label: "00:00" };
        }

        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);

        return {
            active: true,
            label: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
        };
    };

    const getBackendBaseUrl = () => {
        const base = (api.defaults.baseURL as string) || "";
        return base.endsWith("/") ? base.slice(0, -1) : base;
    };

    const handleGoogleAuth = async (item: LikeTaskItem) => {
        if (!userId) {
            await Swal.fire({
                icon: "warning",
                title: "Login required",
                text: "User ID not found. Please log in again.",
            });
            return;
        }

        const status = statusMap[item._id];
        const timer = getTaskTimer(status);

        if (status?.locked) return;
        if (timer.active) {
            await Swal.fire({
                icon: "info",
                title: "Finish current attempt first",
                text: `Upload screenshot for ${status?.activeEmail} before starting another email.`,
            });
            return;
        }

        await Swal.fire({
            icon: "info",
            title: "5 minute timer",
            text: "You have to complete the full process in 5 minutes after Google authentication.",
            confirmButtonText: "Continue",
        });

        const baseUrl = getBackendBaseUrl();
        const popupUrl =
            `${baseUrl}/like-task/google/start?userId=${encodeURIComponent(userId)}&likeLinkId=${encodeURIComponent(item._id)}`;

        window.open(
            popupUrl,
            "likeTaskGoogleAuth",
            "width=560,height=720,menubar=no,toolbar=no,location=yes,status=no"
        );
    };

    const handleChooseScreenshot = (taskId: string) => {
        fileRefs.current[taskId]?.click();
    };

    const handleSubmitScreenshot = async (
        e: React.ChangeEvent<HTMLInputElement>,
        item: LikeTaskItem
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!userId) {
            await Swal.fire({
                icon: "warning",
                title: "Login required",
                text: "User ID not found. Please log in again.",
            });
            return;
        }

        const status = statusMap[item._id];
        const timer = getTaskTimer(status);

        if (!status?.taskId) {
            await Swal.fire({
                icon: "warning",
                title: "Authenticate first",
                text: "Please complete Google authentication first.",
            });
            e.target.value = "";
            return;
        }

        if (!timer.active) {
            await Swal.fire({
                icon: "warning",
                title: "Timer expired",
                text: "The 5 minute upload window is over. Authenticate again.",
            });
            e.target.value = "";
            return;
        }

        try {
            setBusyTaskId(item._id);

            const formData = new FormData();
            formData.append("taskId", status.taskId);
            formData.append("userId", userId);
            formData.append("likeLinkId", item._id);
            formData.append("screenshot", file);

            const res = await api.post("/like-task/submit", formData, {
                withCredentials: true,
                headers: { "Content-Type": "multipart/form-data" },
            });

            await Swal.fire({
                icon: "success",
                title: "Verified",
                text: res.data?.message || "Screenshot verified successfully",
            });

            await fetchStatuses();
            e.target.value = "";
        } catch (err: any) {
            await Swal.fire({
                icon: "error",
                title: "Verification failed",
                text:
                    err?.response?.data?.error ||
                    err?.response?.data?.verification?.reason ||
                    "Unable to verify screenshot",
            });
            e.target.value = "";
        } finally {
            setBusyTaskId(null);
        }
    };

    const renderedTasks = useMemo(() => tasks, [tasks]);

    if (loading) {
        return <div className="flex justify-center items-center h-[60vh] text-sm">Loading...</div>;
    }

    if (error) {
        return <div className="text-center text-red-600 py-10 px-4">{error}</div>;
    }

    return (
        <>
            <header className="bg-white sticky top-0 z-20 shadow-sm px-4 sm:px-6 py-3 flex justify-between items-center">
                <h1 className="text-xl sm:text-2xl font-semibold truncate pr-3">Like Tasks</h1>

                <div className="flex items-center gap-2 sm:gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/user/dashboard")}
                        className="gap-1 px-2 sm:px-3"
                    >
                        <span className="hidden sm:inline">Comment Task</span>
                    </Button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {renderedTasks.length === 0 ? (
                        <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">
                            Nothing available right now.
                        </Card>
                    ) : (
                        renderedTasks.map((item) => {
                            const status = statusMap[item._id];
                            const { expired, label } = getOverallTimeLeft(item.createdAt, item.expireIn ?? 0);
                            const timer = getTaskTimer(status);

                            const authDisabled =
                                expired ||
                                Boolean(status?.locked) ||
                                timer.active ||
                                busyTaskId === item._id;

                            const submitDisabled =
                                expired ||
                                !timer.active ||
                                !status?.taskId ||
                                Boolean(status?.locked) ||
                                busyTaskId === item._id;

                            return (
                                <Card
                                    key={item._id}
                                    className="rounded-xl hover:shadow-lg transition-shadow bg-white border shadow-sm border-gray-200 h-full flex flex-col"
                                >
                                    <CardHeader className="p-4 pb-3 space-y-3">
                                        <CardTitle className="text-sm sm:text-base font-medium text-gray-800 leading-7 whitespace-normal break-all [overflow-wrap:anywhere]">
                                            {item.title}
                                        </CardTitle>

                                        <div className="flex flex-wrap gap-2">
                                            <Badge
                                                variant="outline"
                                                className="border-pink-500 text-pink-600 bg-transparent"
                                            >
                                                Like Task
                                            </Badge>

                                            <Badge variant="outline">
                                                Done {status?.completedCount ?? 0}/5
                                            </Badge>

                                            {timer.active && (
                                                <Badge className="bg-green-600 hover:bg-green-600">
                                                    Timer {timer.label}
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-2 p-4 pt-0 text-sm text-gray-700">
                                        {typeof item.target === "number" && (
                                            <div className="flex justify-between gap-4">
                                                <span>Target</span>
                                                <span className="font-medium shrink-0">{item.target}</span>
                                            </div>
                                        )}

                                        {typeof item.amount === "number" && (
                                            <div className="flex justify-between gap-4">
                                                <span>Amount</span>
                                                <span className="font-semibold shrink-0">₹{item.amount}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between gap-4">
                                            <span>Expires</span>
                                            <span className={`shrink-0 ${expired ? "text-gray-400" : "text-green-600"}`}>
                                                {label}
                                            </span>
                                        </div>

                                        <div className="flex justify-between gap-4">
                                            <span>Like</span>
                                            <span className="font-medium shrink-0">
                                                {item.requireLike ? "Required" : "Optional"}
                                            </span>
                                        </div>

                                        <div className="flex justify-between gap-4">
                                            <span>Authenticated Email</span>
                                            <span className="font-medium text-right break-all">
                                                {status?.activeEmail || "-"}
                                            </span>
                                        </div>

                                        {status?.completedEmails?.length ? (
                                            <div className="pt-2 border-t space-y-1">
                                                <div className="text-xs text-muted-foreground">Completed emails</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {status.completedEmails.map((email) => (
                                                        <Badge key={email} variant="secondary" className="text-[11px]">
                                                            {email}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}

                                        {status?.locked && (
                                            <div className="rounded-lg border border-green-300 bg-green-50 text-green-700 px-3 py-2 text-xs">
                                                All 5 email slots are completed for this task.
                                            </div>
                                        )}

                                        {timer.active && (
                                            <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-700 px-3 py-2 text-xs">
                                                You must upload the screenshot within {timer.label}.
                                            </div>
                                        )}
                                    </CardContent>

                                    <CardFooter className="p-4 pt-0 mt-auto">
                                        <div className="w-full flex flex-col gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full h-14 rounded-2xl border border-gray-300 bg-white text-black font-semibold text-base shadow-sm hover:bg-gray-50 hover:text-black"
                                                onClick={() => handleGoogleAuth(item)}
                                                disabled={authDisabled}
                                            >
                                                <span className="flex items-center justify-center gap-3 w-full">
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 48 48"
                                                        className="h-5 w-5 shrink-0"
                                                    >
                                                        <path
                                                            fill="#FFC107"
                                                            d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.215 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.959 3.041l5.657-5.657C34.053 6.053 29.28 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                                                        />
                                                        <path
                                                            fill="#FF3D00"
                                                            d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.959 3.041l5.657-5.657C34.053 6.053 29.28 4 24 4c-7.682 0-14.347 4.337-17.694 10.691z"
                                                        />
                                                        <path
                                                            fill="#4CAF50"
                                                            d="M24 44c5.178 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.145 35.091 26.715 36 24 36c-5.194 0-9.624-3.329-11.283-7.946l-6.522 5.025C9.5 39.556 16.227 44 24 44z"
                                                        />
                                                        <path
                                                            fill="#1976D2"
                                                            d="M43.611 20.083H42V20H24v8h11.303c-.793 2.27-2.25 4.219-4.084 5.57l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                                                        />
                                                    </svg>

                                                    <span>Authenticate with Google</span>
                                                </span>
                                            </Button>

                                            <input
                                                ref={(el) => {
                                                    fileRefs.current[item._id] = el;
                                                }}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleSubmitScreenshot(e, item)}
                                            />

                                            <Button
                                                className="w-full"
                                                size="sm"
                                                onClick={() => handleChooseScreenshot(item._id)}
                                                disabled={submitDisabled}
                                            >
                                                <UploadIcon className="h-4 w-4 mr-2" />
                                                {busyTaskId === item._id ? "Submitting..." : "Submit Screenshot"}
                                            </Button>

                                            <Button className="w-full" size="sm" disabled>
                                                <HeartIcon className="h-4 w-4 mr-2" />
                                                Like Required
                                            </Button>
                                        </div>
                                    </CardFooter>
                                </Card>
                            );
                        })
                    )}
                </section>
            </main>
        </>
    );
}