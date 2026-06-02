'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ClipboardCopy as ClipboardCopyIcon,
  Eye as EyeIcon,
  LogOut as LogOutIcon,
  Users as UsersIcon,
  MailCheck as MailCheckIcon,
  ExternalLink as ExternalLinkIcon,
  Heart as HeartIcon,
  RefreshCcw as RefreshCcwIcon,
  CalendarDays as CalendarDaysIcon,
  IndianRupee as IndianRupeeIcon,
  Trophy as TrophyIcon,
  TrendingUp as TrendingUpIcon,
  Info as InfoIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  Loader2,
} from 'lucide-react';
import Swal from 'sweetalert2';

/* ===================== Types ===================== */

type CountryOption = { value: string; label?: string };

type BonusFilter = string;
type ItemFilter = 'all' | 'likeLink' | 'link' | 'task';

interface PerformanceResponse {
  employee?: {
    employeeId: string;
    employeeName: string;
    email?: string;
  };
  period?: {
    startDate: string;
    endDate: string;
  };
  totalVideos: number;
  totalApprovedActiveUsers: number;
  averageActiveUsers: number;
  applicableBonusSlab: string;
  bonusRate: number;
  totalBonus: number;
  videoBreakdown?: {
    likeLinkId: string;
    videoTitle: string;
    videoUrl?: string;
    thumbnail?: string;
    approvedActiveUsers: number;
  }[];
}

interface LinkItem {
  _id: string;
  title: string;
  isLatest?: boolean;
  target: number;
  amount: number;
  createdAt: string;
  expireIn: number;
  expiresAt?: string;
  status?: 'active' | 'expired';
}

interface LikeLinkItem {
  _id: string;
  title: string;
  videoUrl?: string;
  createdBy?: string;
  target: number;
  amount: number;
  createdAt: string;
  expireIn: number;
  expireAt?: string;
  status?: 'active' | 'expired';
  requireLike?: boolean;
  isLatest?: boolean;
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
  isLatest?: boolean;
  status?: 'active' | 'expired';
  expiresAt?: string;
  minFollowers?: number;
  maxFollowers?: number;
  countries?: CountryOption[];
  categories?: string[];
}

type MergedItem =
  | {
    kind: 'link';
    _id: string;
    createdAt: string;
    expireIn: number;
    expiresAt?: string;
    status?: 'active' | 'expired';
    isLatest?: boolean;
    title: string;
    target: number;
    amount: number;
  }
  | {
    kind: 'likeLink';
    _id: string;
    createdAt: string;
    expireIn: number;
    expireAt?: string;
    status?: 'active' | 'expired';
    isLatest?: boolean;
    title: string;
    target: number;
    amount: number;
    videoUrl?: string;
    requireLike?: boolean;
  }
  | {
    kind: 'task';
    _id: string;
    createdAt: string;
    expireIn: number;
    expiresAt?: string;
    status?: 'active' | 'expired';
    isLatest?: boolean;
    platform: string;
    targetUser?: string | number;
    targetPerEmployee: number;
    amountPerPerson: number;
    maxEmails: number;
    minFollowers?: number;
    maxFollowers?: number;
    countries?: CountryOption[];
    categories?: string[];
  };

/* ===================== Config ===================== */

/**
 * If your backend mounted this route under /admin, change this to:
 * const PERFORMANCE_ENDPOINT = '/admin/like-task/performance';
 */
const PERFORMANCE_ENDPOINT = '/like-task/performance';

/* ===================== Helpers ===================== */

function SkeletonCard() {
  return (
    <Card className="p-6 space-y-4">
      <div className="h-4 bg-gray-200/70 rounded w-2/3" />
      <div className="h-3 bg-gray-200/70 rounded w-1/2" />
      <div className="h-3 bg-gray-200/70 rounded w-1/3" />
      <div className="flex gap-2 pt-2">
        <div className="h-8 w-28 bg-gray-200/70 rounded" />
        <div className="h-8 w-28 bg-gray-200/70 rounded" />
      </div>
    </Card>
  );
}

const fmtNum = (n?: number) =>
  typeof n === 'number' && Number.isFinite(n)
    ? new Intl.NumberFormat('en-IN').format(n)
    : '—';

const fmtINR = (n?: number | null) =>
  `₹${Number(n || 0).toLocaleString('en-IN')}`;

const fmtFollowersRange = (min?: number, max?: number) => {
  const hasMin = typeof min === 'number' && Number.isFinite(min);
  const hasMax = typeof max === 'number' && Number.isFinite(max);

  if (!hasMin && !hasMax) return 'Any';
  if (hasMin && hasMax) return `${fmtNum(min)} - ${fmtNum(max)}`;
  if (hasMin) return `≥ ${fmtNum(min)}`;
  return `≤ ${fmtNum(max)}`;
};

const fmtCountriesShort = (arr?: CountryOption[]) => {
  if (!Array.isArray(arr) || arr.length === 0) return 'Any';

  const vals = arr.map((c) => String(c?.value || '').toUpperCase());
  if (vals.includes('ANY')) return 'Any';

  const labels = arr.map((c) => c?.label || c?.value).filter(Boolean) as string[];
  if (labels.length <= 2) return labels.join(', ');

  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`;
};

const fmtCategories = (arr?: string[]) => {
  if (!Array.isArray(arr) || arr.length === 0) return 'Any';

  const up = arr.map((x) => String(x).toUpperCase());

  if (up.includes('ANY')) return 'Any';
  if (arr.some((x) => String(x).toLowerCase() === 'any')) return 'Any';

  return arr.join(', ');
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getCurrentMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
};

const getMonthRange = (monthValue: string) => {
  const safeMonthValue = /^\d{4}-\d{2}$/.test(monthValue)
    ? monthValue
    : getCurrentMonthValue();

  const [yearText, monthText] = safeMonthValue.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  const start = new Date(year, monthIndex, 1);
  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() === monthIndex;

  const end = isCurrentMonth
    ? now
    : new Date(year, monthIndex + 1, 0);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
    label: start.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    }),
    isCurrentMonth,
  };
};

const getItemFilterLabel = (filter: ItemFilter) => {
  if (filter === 'likeLink') return 'Like Task';
  if (filter === 'link') return 'Shareable Task';
  if (filter === 'task') return 'Email Task';
  return 'All Items';
};

const getPerformanceLabel = (performance?: PerformanceResponse | null) => {
  if (!performance) return 'No performance data yet';

  const avg = Number(performance.averageActiveUsers || 0);

  if (avg < 90) {
    return 'Below target';
  }

  if (avg <= 120) {
    return 'Eligible for ₹20/user bonus';
  }

  return 'Eligible for ₹25/user bonus';
};

const getBonusRateLabel = (rate?: number | null) => {
  const safeRate = Number(rate || 0);

  if (safeRate <= 0) return '₹0/user';

  return `₹${safeRate}/user`;
};

const getSlabRangeLabel = (rate?: number | null) => {
  const safeRate = Number(rate || 0);

  if (safeRate >= 25) return 'Above 120 users';
  if (safeRate >= 20) return '90 - 120 users';

  return 'Below 90 users';
};

const getNextSlabInfo = (averageActiveUsers?: number | null) => {
  const avg = Number(averageActiveUsers || 0);

  if (avg < 90) {
    return {
      nextTarget: 90,
      usersNeeded: Math.max(90 - avg, 0),
      nextRate: 20,
      startLabel: '0 users',
      endLabel: '90 users',
      currentRate: 0,
      progress: Math.min(Math.max((avg / 90) * 100, 0), 100),
    };
  }

  if (avg < 120) {
    return {
      nextTarget: 120,
      usersNeeded: Math.max(120 - avg, 0),
      nextRate: 25,
      startLabel: '90 users',
      endLabel: '120 users',
      currentRate: 20,
      progress: Math.min(Math.max(((avg - 90) / 30) * 100, 0), 100),
    };
  }

  return {
    nextTarget: null,
    usersNeeded: 0,
    nextRate: 25,
    startLabel: '120 users',
    endLabel: 'Max slab',
    currentRate: 25,
    progress: 100,
  };
};

const InfoTooltip = ({ text }: { text: React.ReactNode }) => (
  <span className="group relative inline-flex">
    <InfoIcon className="h-4 w-4 cursor-help text-gray-400 transition hover:text-gray-600" />

    <span className="pointer-events-none absolute left-1/2 top-6 z-[9999] hidden w-72 -translate-x-1/2 rounded-xl border bg-white px-3 py-2 text-xs leading-relaxed text-gray-700 shadow-xl group-hover:block">
      {text}
    </span>
  </span>
)

/* ===================== Component ===================== */

export default function Dashboard() {
  const router = useRouter();

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [errorLinks, setErrorLinks] = useState('');

  const [likeLinks, setLikeLinks] = useState<LikeLinkItem[]>([]);
  const [loadingLikeLinks, setLoadingLikeLinks] = useState(true);
  const [errorLikeLinks, setErrorLikeLinks] = useState('');

  const [emailTasks, setEmailTasks] = useState<EmailTaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [errorTasks, setErrorTasks] = useState('');

  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all');

  const [bonusMonth, setBonusMonth] = useState<BonusFilter>(getCurrentMonthValue());
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState('');
  const [isVideoBreakdownOpen, setIsVideoBreakdownOpen] = useState(false);

  const [, setTick] = useState(0);

  const isLoading = loadingLinks || loadingLikeLinks || loadingTasks;
  const errorMessage = errorLinks || errorLikeLinks || errorTasks;

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const empId = localStorage.getItem('employeeId');
    if (!empId) return;

    api
      .get<{ balance: number }>(`/employee/balance?employeeId=${empId}`)
      .then((res) => setBalance(res.data.balance))
      .catch((err) => console.error('Failed to fetch balance', err));
  }, []);

  useEffect(() => {
    setLoadingLinks(true);

    api
      .get<LinkItem[]>('/employee/links', { withCredentials: true })
      .then((res) => setLinks(res.data || []))
      .catch((e) => setErrorLinks(e.response?.data?.error || 'Failed to load links.'))
      .finally(() => setLoadingLinks(false));
  }, []);

  useEffect(() => {
    setLoadingLikeLinks(true);

    api
      .get<LikeLinkItem[]>('/employee/likelinks', { withCredentials: true })
      .then((res) => setLikeLinks(Array.isArray(res.data) ? res.data : []))
      .catch((e) => setErrorLikeLinks(e.response?.data?.error || 'Failed to load like links.'))
      .finally(() => setLoadingLikeLinks(false));
  }, []);

  useEffect(() => {
    setLoadingTasks(true);

    api
      .get<EmailTaskItem[]>('/employee/emailtasks', { withCredentials: true })
      .then((res) => setEmailTasks(res.data || []))
      .catch((e) => setErrorTasks(e.response?.data?.error || 'Failed to load email tasks.'))
      .finally(() => setLoadingTasks(false));
  }, []);

  const loadPerformance = async (monthValue: BonusFilter = bonusMonth) => {
    const employeeId = localStorage.getItem('employeeId');

    if (!employeeId) {
      setPerformanceError('Employee ID not found. Please login again.');
      return;
    }

    const range = getMonthRange(monthValue);

    try {
      setPerformanceLoading(true);
      setPerformanceError('');

      const res = await api.post<PerformanceResponse>(
        PERFORMANCE_ENDPOINT,
        {
          employeeId,
          startDate: range.startDate,
          endDate: range.endDate,
        },
        { withCredentials: true }
      );

      setPerformance(res.data);
    } catch (err: any) {
      setPerformanceError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Failed to load bonus performance.'
      );
    } finally {
      setPerformanceLoading(false);
    }
  };

  const copy = (txt: string) =>
    navigator.clipboard.writeText(txt).then(() =>
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Copied',
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true,
      })
    );

  const handleLogout = async () => {
    localStorage.clear();

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: 'Logged out',
      showConfirmButton: false,
      timer: 1200,
    });

    router.push('/employee/login');
  };

  const goToLink = (id: string) => {
    setNavigatingId(id);
    router.push(`/employee/links?id=${id}`);
  };

  const goToLikeLink = (id: string) => {
    setNavigatingId(id);
    router.push(`/employee/view-link?id=${id}`);
  };

  const openEmailTask = (taskId: string) => {
    setNavigatingId(taskId);
    router.push(`/employee/email-collection?task=${taskId}`);
  };

  const handleItemFilterChange = (filter: ItemFilter) => {
    setItemFilter(filter);
    setQuery('');

    if (filter === 'likeLink') {
      if (!performance) {
        loadPerformance(bonusMonth);
      }
    } else {
      setPerformanceError('');
    }
  };

  const handleBonusMonthChange = (monthValue: string) => {
    const nextMonth = monthValue || getCurrentMonthValue();

    setBonusMonth(nextMonth);
    setIsVideoBreakdownOpen(false);
    loadPerformance(nextMonth);
  };

  const getTimeLeft = (
    createdAt: string,
    expireIn: number,
    expiresAt?: string,
    expireAt?: string
  ) => {
    const expiryDate = expireAt
      ? new Date(expireAt)
      : expiresAt
        ? new Date(expiresAt)
        : new Date(new Date(createdAt).getTime() + expireIn * 60 * 60 * 1000);

    const now = new Date();
    const diff = expiryDate.getTime() - now.getTime();

    if (diff <= 0) {
      return { expired: true, time: 'Expired', hoursLeft: 0, expiryDate } as const;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return {
      expired: false,
      time: `${hours}h ${minutes}m ${seconds}s`,
      hoursLeft: hours + minutes / 60,
      expiryDate,
    } as const;
  };

  const formatDateTime = (d: Date) =>
    d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const allItems = useMemo<MergedItem[]>(() => {
    const linkItems: MergedItem[] = links.map((l) => ({
      kind: 'link',
      _id: l._id,
      createdAt: l.createdAt,
      expireIn: l.expireIn,
      expiresAt: l.expiresAt,
      status: l.status,
      isLatest: l.isLatest,
      title: l.title,
      target: l.target,
      amount: l.amount,
    }));

    const likeLinkItems: MergedItem[] = likeLinks.map((l) => ({
      kind: 'likeLink',
      _id: l._id,
      createdAt: l.createdAt,
      expireIn: l.expireIn,
      expireAt: l.expireAt,
      status: l.status,
      isLatest: l.isLatest,
      title: l.title,
      target: l.target,
      amount: l.amount,
      videoUrl: l.videoUrl,
      requireLike: l.requireLike,
    }));

    const taskItems: MergedItem[] = emailTasks.map((t) => ({
      kind: 'task',
      _id: t._id,
      createdAt: t.createdAt,
      expireIn: t.expireIn,
      expiresAt: t.expiresAt,
      status: t.status,
      isLatest: t.isLatest,
      platform: t.platform,
      targetUser: t.targetUser,
      targetPerEmployee: t.targetPerEmployee,
      amountPerPerson: t.amountPerPerson,
      maxEmails: t.maxEmails,
      minFollowers: t.minFollowers,
      maxFollowers: t.maxFollowers,
      countries: t.countries,
      categories: t.categories,
    }));

    return [...linkItems, ...likeLinkItems, ...taskItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [links, likeLinks, emailTasks]);

  const itemCounts = useMemo(() => {
    return {
      all: allItems.length,
      likeLink: allItems.filter((item) => item.kind === 'likeLink').length,
      link: allItems.filter((item) => item.kind === 'link').length,
      task: allItems.filter((item) => item.kind === 'task').length,
    };
  }, [allItems]);

  const filteredByType = useMemo(() => {
    if (itemFilter === 'all') return allItems;
    return allItems.filter((item) => item.kind === itemFilter);
  }, [allItems, itemFilter]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return filteredByType;

    return filteredByType.filter((item) => {
      if (item.kind === 'link') {
        return [
          item.title,
          String(item.target),
          String(item.amount),
          'shareable task',
        ].some((v) => String(v).toLowerCase().includes(q));
      }

      if (item.kind === 'likeLink') {
        return [
          item.title,
          item.videoUrl || '',
          String(item.target),
          String(item.amount),
          'like task',
        ].some((v) => String(v).toLowerCase().includes(q));
      }

      return [
        item.platform,
        String(item.targetUser ?? ''),
        String(item.targetPerEmployee),
        String(item.amountPerPerson),
        String(item.maxEmails),
        String(item.minFollowers ?? ''),
        String(item.maxFollowers ?? ''),
        Array.isArray(item.countries)
          ? item.countries.map((c) => `${c?.value || ''} ${c?.label || ''}`).join(' ')
          : '',
        Array.isArray(item.categories) ? item.categories.join(' ') : '',
        'email task',
      ].some((v) => String(v).toLowerCase().includes(q));
    });
  }, [filteredByType, query]);

  const filterButton = (filter: ItemFilter) => (
    <Button
      key={filter}
      size="sm"
      variant={itemFilter === filter ? 'default' : 'outline'}
      onClick={() => handleItemFilterChange(filter)}
      className="flex items-center gap-2"
    >
      {getItemFilterLabel(filter)}
      <Badge
        variant={itemFilter === filter ? 'secondary' : 'outline'}
        className={itemFilter === filter ? 'bg-white/20 text-current' : 'bg-white'}
      >
        {itemCounts[filter]}
      </Badge>
    </Button>
  );

  const titleText = getItemFilterLabel(itemFilter);

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-950">
            Employee Dashboard
          </h1>
          <p className="text-base sm:text-lg text-gray-500">
            Track your performance and earnings
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {balance !== null && (
            <span className="text-sm sm:text-base font-semibold text-green-700 bg-green-50 px-5 py-3 rounded-2xl border border-green-200 shadow-sm">
              Balance Left: ₹{balance.toLocaleString()}
            </span>
          )}

          <Button
            size="lg"
            variant="outline"
            onClick={() => router.push('/employee/users')}
            className="flex items-center gap-2 rounded-2xl bg-white shadow-sm"
          >
            <UsersIcon className="h-5 w-5" />
            Users
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-2xl bg-white shadow-sm"
          >
            <LogOutIcon className="h-5 w-5" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Filters */}
      <Card className="p-4 bg-white border shadow-sm space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Task Filters</h2>
            <p className="text-sm text-muted-foreground">
              Select a task type to view related entries.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'likeLink', 'link', 'task'] as ItemFilter[]).map(filterButton)}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search in ${titleText.toLowerCase()}...`}
            className="max-w-md"
          />

          <Badge variant="outline" className="bg-white w-fit">
            {visibleItems.length} result{visibleItems.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </Card>

      {itemFilter === 'likeLink' && (
        <Card className="overflow-visible rounded-3xl border bg-white shadow-xl shadow-gray-200/70">
          <div className="p-5 sm:p-7 space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full border border-green-100 bg-green-50 text-green-600">
                  <IndianRupeeIcon className="h-6 w-6" />
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-950">
                    Monthly Bonus
                  </h2>
                  <p className="text-sm text-gray-500">
                    Like Task performance for {getMonthRange(bonusMonth).label}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-gray-700"
                    >
                      <CalendarDaysIcon className="h-3.5 w-3.5 text-gray-500" />
                      {performanceLoading ? '...' : performance?.totalVideos ?? 0} videos counted
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Month
                  </label>
                  <Input
                    type="month"
                    value={bonusMonth}
                    onChange={(e) => handleBonusMonthChange(e.target.value)}
                    className="w-full sm:w-[190px] rounded-xl bg-white"
                    disabled={performanceLoading}
                  />
                </div>
              </div>
            </div>

            {performanceError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {performanceError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 overflow-visible rounded-3xl border border-gray-100 bg-white lg:grid-cols-3">
              <div className="p-5 sm:p-7 text-center border-b lg:border-b-0 lg:border-r">
                <p className="text-5xl sm:text-6xl font-extrabold text-green-600 tracking-tight">
                  {performanceLoading ? '...' : performance?.averageActiveUsers ?? 0}
                </p>

                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <p className="text-sm sm:text-base font-semibold text-gray-600">
                    Average Approved Users
                  </p>
                  <InfoTooltip text="Averaged across all videos for the selected month" />
                </div>
              </div>

              <div className="p-5 sm:p-7 text-center border-b lg:border-b-0 lg:border-r">
                <p className="text-5xl sm:text-6xl font-extrabold text-purple-700 tracking-tight">
                  {performanceLoading ? '...' : getBonusRateLabel(performance?.bonusRate)}
                </p>

                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <p className="text-sm sm:text-base font-semibold text-gray-600">
                    Bonus Rate
                  </p>
                  <InfoTooltip
                    text={
                      <span className="block space-y-2">
                        <span className="block font-medium text-gray-800">
                          Higher average users = higher bonus rate.
                        </span>

                        <span className="block space-y-1 text-gray-600">
                          <span className="block">Below 90 → ₹0/user</span>
                          <span className="block">90–120 → ₹20/user</span>
                          <span className="block">120+ → ₹25/user</span>
                        </span>
                      </span>
                    }
                  />
                </div>

                <Badge className="mt-3 bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-100">
                  {performanceLoading
                    ? 'Calculating...'
                    : getSlabRangeLabel(performance?.bonusRate)}
                </Badge>
              </div>

              <div className="p-5 sm:p-7 text-center">
                <p className="text-5xl sm:text-6xl font-extrabold text-green-600 tracking-tight">
                  {performanceLoading ? '...' : fmtINR(performance?.totalBonus)}
                </p>

                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <p className="text-sm sm:text-base font-semibold text-gray-600">
                    Estimated Bonus
                  </p>
                  <InfoTooltip text="Bonus = Average Approved Users × Applicable Bonus Rate" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5 sm:p-6">
              {(() => {
                const avg = Number(performance?.averageActiveUsers || 0);
                const nextSlab = getNextSlabInfo(avg);

                return (
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_0.65fr] xl:items-center">
                    <div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-950">
                            Progress to Next Slab
                          </h3>

                        </div>

                        <p className="text-sm text-gray-500">
                          {nextSlab.nextTarget
                            ? `Next slab starts at ${nextSlab.nextTarget} average active users.`
                            : 'You are already on the highest bonus slab.'}
                        </p>
                      </div>

                      <div className="relative mt-10">
                        <div className="h-4 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-600 transition-all"
                            style={{ width: `${nextSlab.progress}%` }}
                          />
                        </div>

                        <div
                          className="absolute -top-9 -translate-x-1/2"
                          style={{ left: `${Math.min(Math.max(nextSlab.progress, 6), 94)}%` }}
                        >
                          <div className="relative rounded-full bg-green-600 px-3 py-2 text-sm font-bold text-white shadow-lg">
                            {performanceLoading ? '...' : avg}
                            <span className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-green-600" />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start justify-between mt-5 text-sm">
                        <div>
                          <p className="font-bold text-gray-950">
                            {nextSlab.startLabel}
                          </p>
                          <p className="text-gray-500">
                            ₹{nextSlab.currentRate} / user
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-bold text-gray-950">
                            {nextSlab.endLabel}
                          </p>
                          <p className="text-gray-500">
                            ₹{nextSlab.nextRate} / user
                          </p>
                        </div>
                      </div>
                    </div>

                    <Card className="border-green-100 bg-green-50 p-5 text-center">
                      <div className="flex items-center justify-center gap-4">
                        <TrendingUpIcon className="h-9 w-9 text-green-600" />

                        <div>
                          <p className="text-4xl sm:text-5xl font-extrabold text-green-600">
                            {performanceLoading ? '...' : nextSlab.usersNeeded}
                          </p>

                          <p className="text-base font-bold text-gray-950 mt-1">
                            {nextSlab.nextTarget
                              ? 'more average users'
                              : 'highest slab unlocked'}
                          </p>

                          <p className="text-base sm:text-md text-gray-700 mt-1">
                            to unlock ₹{nextSlab.nextRate} / user
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })()}
            </div>

            {performance?.videoBreakdown?.length ? (
              <Card className="border bg-white">
                <button
                  type="button"
                  onClick={() => setIsVideoBreakdownOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">Video-wise Performance</p>
                      <Badge variant="outline" className="bg-white">
                        {performance.videoBreakdown.length} video
                        {performance.videoBreakdown.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground mt-1">
                      Approved active users per Like Task video.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-gray-500">
                      {isVideoBreakdownOpen ? 'Collapse' : 'Expand'}
                    </span>

                    {isVideoBreakdownOpen ? (
                      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </button>

                {isVideoBreakdownOpen ? (
                  <div className="max-h-72 overflow-y-auto divide-y border-t bg-white">
                    {performance.videoBreakdown.map((video) => (
                      <div
                        key={video.likeLinkId}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {video.videoTitle}
                          </p>

                          {video.videoUrl ? (
                            <a
                              href={video.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 underline inline-flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open Video
                              <ExternalLinkIcon className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="bg-green-600 text-white">
                            {video.approvedActiveUsers} active
                          </Badge>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => goToLikeLink(video.likeLinkId)}
                          >
                            View Entries
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
            ) : null}
          </div>
        </Card>
      )}

      {/* Items */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{titleText}</h2>
          <Badge variant="secondary">{visibleItems.length}</Badge>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)
          ) : errorMessage ? (
            <Card className="p-6 text-center text-red-600 col-span-full">
              {errorMessage}
            </Card>
          ) : visibleItems.length === 0 ? (
            <Card className="p-10 text-center col-span-full">
              <p className="text-sm text-muted-foreground">
                No {titleText.toLowerCase()} found.
              </p>
            </Card>
          ) : (
            visibleItems.map((item) => {
              const { time, expired, hoursLeft, expiryDate } = getTimeLeft(
                item.createdAt,
                item.expireIn,
                'expiresAt' in item ? item.expiresAt : undefined,
                'expireAt' in item ? item.expireAt : undefined
              );

              const state = expired ? 'closed' : hoursLeft <= 6 ? 'urgent' : 'active';

              if (item.kind === 'link') {
                return (
                  <Card
                    key={`link-${item._id}`}
                    className={`relative p-6 space-y-4 transition ${state === 'active'
                      ? 'bg-white border border-green-200 hover:shadow-md'
                      : state === 'urgent'
                        ? 'bg-white border-amber-200 hover:shadow-md'
                        : 'bg-white border border-gray-200 hover:shadow-md'
                      }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {!expired ? (
                        <Badge className={state === 'urgent' ? 'bg-amber-500' : 'bg-green-600'}>
                          {state === 'urgent' ? 'Expiring soon' : 'Active'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Closed</Badge>
                      )}

                      <Badge variant="outline">Shareable Task</Badge>
                      <Badge variant="outline">Target: {item.target}</Badge>
                      <Badge variant="outline">₹{item.amount}/person</Badge>
                    </div>

                    <div>
                      <p className="text-lg font-semibold break-words">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Expires: {formatDateTime(expiryDate)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">⌛ Time left</span>
                      <span
                        className={`font-semibold ${expired
                          ? 'text-gray-500'
                          : state === 'urgent'
                            ? 'text-amber-700'
                            : 'text-green-700'
                          }`}
                      >
                        {!expired ? time : 'Expired'}
                      </span>
                    </div>

                    <div className="border-t pt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => goToLink(item._id)}
                        disabled={navigatingId === item._id}
                        className="flex items-center gap-1"
                      >
                        {navigatingId === item._id ? (
                          <span className="animate-spin h-4 w-4 border-t-2 border-gray-600 rounded-full" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                        View Entries
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copy(item.title)}
                        className="flex items-center gap-1 bg-white hover:bg-gray-50"
                      >
                        <ClipboardCopyIcon className="h-4 w-4" />
                        Copy Title
                      </Button>
                    </div>
                  </Card>
                );
              }

              if (item.kind === 'likeLink') {
                return (
                  <Card
                    key={`like-${item._id}`}
                    className={`relative p-6 space-y-4 transition ${state === 'active'
                      ? 'bg-white border border-pink-200 hover:shadow-md'
                      : state === 'urgent'
                        ? 'bg-white border-amber-200 hover:shadow-md'
                        : 'bg-white border border-gray-200 hover:shadow-md'
                      }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {!expired ? (
                        <Badge className={state === 'urgent' ? 'bg-amber-500' : 'bg-pink-600'}>
                          {state === 'urgent' ? 'Expiring soon' : 'Active'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Closed</Badge>
                      )}

                      <Badge variant="outline">Like Task</Badge>
                      <Badge variant="outline">Target: {item.target}</Badge>
                      <Badge variant="outline">₹{item.amount}/person</Badge>
                    </div>

                    <div>
                      <p className="text-lg font-semibold break-words">{item.title}</p>

                      {item.videoUrl ? (
                        <a
                          href={item.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 underline break-all inline-flex items-center gap-1 mt-1"
                        >
                          Open Video
                          <ExternalLinkIcon className="h-3 w-3" />
                        </a>
                      ) : null}

                      <p className="text-xs text-muted-foreground mt-1">
                        Expires: {formatDateTime(expiryDate)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">⌛ Time left</span>
                      <span
                        className={`font-semibold ${expired
                          ? 'text-gray-500'
                          : state === 'urgent'
                            ? 'text-amber-700'
                            : 'text-pink-700'
                          }`}
                      >
                        {!expired ? time : 'Expired'}
                      </span>
                    </div>

                    <div className="border-t pt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => goToLikeLink(item._id)}
                        disabled={navigatingId === item._id}
                        className="flex items-center gap-1"
                      >
                        {navigatingId === item._id ? (
                          <span className="animate-spin h-4 w-4 border-t-2 border-gray-600 rounded-full" />
                        ) : (
                          <HeartIcon className="h-4 w-4" />
                        )}
                        View Entries
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copy(item.title)}
                        className="flex items-center gap-1 bg-white hover:bg-gray-50"
                      >
                        <ClipboardCopyIcon className="h-4 w-4" />
                        Copy Title
                      </Button>
                    </div>
                  </Card>
                );
              }

              const t = item as Extract<MergedItem, { kind: 'task' }>;

              return (
                <Card
                  key={`task-${t._id}`}
                  className={`relative p-6 space-y-4 transition ${state === 'active'
                    ? 'bg-white border border-blue-200 hover:shadow-md'
                    : state === 'urgent'
                      ? 'bg-white border-amber-200 hover:shadow-md'
                      : 'bg-white border border-gray-200 hover:shadow-md'
                    }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {!expired ? (
                      <Badge className={state === 'urgent' ? 'bg-amber-500' : 'bg-blue-600'}>
                        {state === 'urgent' ? 'Expiring soon' : 'Active'}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Closed</Badge>
                    )}

                    <Badge variant="outline">Email Task</Badge>
                    <Badge variant="outline">Platform: {t.platform}</Badge>
                    <Badge variant="outline">₹{t.amountPerPerson}/person</Badge>
                    <Badge variant="outline">Max Emails: {t.maxEmails}</Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-lg font-semibold break-words">
                      {t.targetUser || 'Email Collection Task'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Target per employee: {t.targetPerEmployee}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires: {formatDateTime(expiryDate)}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-gray-50 p-3 text-sm space-y-2">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-600">Followers</span>
                      <span className="font-medium text-gray-900">
                        {fmtFollowersRange(t.minFollowers, t.maxFollowers)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-gray-600">Countries</span>
                      <span className="font-medium text-gray-900 text-right">
                        {fmtCountriesShort(t.countries)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-gray-600">Categories</span>
                      <span className="font-medium text-gray-900 text-right">
                        {fmtCategories(t.categories)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">⌛ Time left</span>
                    <span
                      className={`font-semibold ${expired
                        ? 'text-gray-500'
                        : state === 'urgent'
                          ? 'text-amber-700'
                          : 'text-blue-700'
                        }`}
                    >
                      {!expired ? time : 'Expired'}
                    </span>
                  </div>

                  <div className="border-t pt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => openEmailTask(t._id)}
                      className="flex items-center gap-1"
                    >
                      {navigatingId === t._id ? (
                        <span className="animate-spin h-4 w-4 border-t-2 border-gray-600 rounded-full" />
                      ) : (
                        <MailCheckIcon className="h-4 w-4" />
                      )}
                      View Entries
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}