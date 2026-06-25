import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchApplications, type Application } from "@/lib/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  ArrowUpDown,
  Calendar,
  Copy,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Mail,
  Phone as PhoneIcon,
  Printer,
  RefreshCw,
  Search,
  TrendingUp,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SALU Shahdadkot · Admissions Portal 2025-26" },
      {
        name: "description",
        content:
          "Live admissions dashboard for Shah Abdul Latif University, Shahdadkot Campus — search, filter and review applicant submissions in real time.",
      },
    ],
  }),
  component: Dashboard,
});

const POLL_MS = 8000;
const NEW_WINDOW_MS = 90_000;
const PAGE_SIZE = 25;

const SEARCH_FIELDS: (keyof Application)[] = [
  "FullName",
  "FatherName",
  "CNIC",
  "Phone",
  "Email",
  "Address",
  "ProgramSelected",
];

// Map program names → distinct color classes
function programStyle(p: string): string {
  const k = p.toLowerCase();
  if (k.includes("cs") || k.includes("computer"))
    return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300";
  if (k.includes("eng"))
    return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (k.includes("bba") || k.includes("bus"))
    return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300";
  if (k.includes("math"))
    return "bg-purple-100 text-purple-700 border-purple-200";
  if (k.includes("phy") || k.includes("chem") || k.includes("bio"))
    return "bg-pink-100 text-pink-700 border-pink-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function Dashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("all");
  const [gender, setGender] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Application | null>(null);

  async function load(manual = false) {
    try {
      if (manual) setRefreshing(true);
      const data = await fetchApplications();
      setError(null);

      if (firstLoad.current) {
        data.forEach((a) => seenIds.current.add(a._rowId));
        firstLoad.current = false;
      } else {
        const fresh = data.filter((a) => !seenIds.current.has(a._rowId));
        if (fresh.length) {
          fresh.forEach((a) => seenIds.current.add(a._rowId));
          setNewIds((prev) => {
            const next = new Set(prev);
            fresh.forEach((a) => next.add(a._rowId));
            return next;
          });
          toast.success(
            `${fresh.length} new application${fresh.length > 1 ? "s" : ""} received`,
          );
          fresh.forEach((a) => {
            setTimeout(() => {
              setNewIds((prev) => {
                const next = new Set(prev);
                next.delete(a._rowId);
                return next;
              });
            }, NEW_WINDOW_MS);
          });
        }
      }
      setApps(data);
      setLastFetched(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch sheet");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(() => load(), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const programs = useMemo(
    () =>
      Array.from(new Set(apps.map((a) => a.ProgramSelected).filter(Boolean))).sort(),
    [apps],
  );
  const genders = useMemo(
    () => Array.from(new Set(apps.map((a) => a.Gender).filter(Boolean))).sort(),
    [apps],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : 0;
    const to = toDate ? new Date(toDate).getTime() + 86_400_000 : Infinity;
    return apps
      .filter((a) => {
        if (program !== "all" && a.ProgramSelected !== program) return false;
        if (gender !== "all" && a.Gender !== gender) return false;
        if (a._ts && (a._ts < from || a._ts > to)) return false;
        if (!q) return true;
        return SEARCH_FIELDS.some((f) =>
          String(a[f] ?? "").toLowerCase().includes(q),
        );
      })
      .sort((a, b) => (sortDesc ? b._ts - a._ts : a._ts - b._ts));
  }, [apps, query, program, gender, fromDate, toDate, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = apps.filter((a) => a._ts >= todayStart.getTime()).length;
  const programCounts = useMemo(() => {
    const m = new Map<string, number>();
    apps.forEach((a) =>
      m.set(a.ProgramSelected || "—", (m.get(a.ProgramSelected || "—") ?? 0) + 1),
    );
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [apps]);

  function clearFilters() {
    setQuery("");
    setProgram("all");
    setGender("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  function exportCsv() {
    const headers = [
      "Timestamp", "SessionId", "FullName", "FatherName", "DateOfBirth",
      "Gender", "CNIC", "Phone", "Email", "MatricPercentage",
      "IntermediatePercentage", "Address", "ProgramSelected",
    ];
    const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const rows = [headers.join(",")];
    filtered.forEach((a) => {
      rows.push(headers.map((h) => escape(String((a as any)[h] ?? ""))).join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `salu-admissions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  const hasFilters =
    query || program !== "all" || gender !== "all" || fromDate || toDate;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      <Toaster richColors position="top-right" />

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                    Admissions Applications
                  </h1>
                  <span className="hidden items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:inline-flex">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    LIVE
                  </span>
                </div>
                <p className="truncate text-xs text-slate-500">
                  Shah Abdul Latif University · Shahdadkot Campus · 2025-26
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs text-slate-500 md:block">
                {lastFetched
                  ? `Updated ${new Date(lastFetched).toLocaleTimeString()}`
                  : "—"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={!filtered.length}
                className="hidden sm:inline-flex"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                size="sm"
                onClick={() => load(true)}
                disabled={refreshing}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 animate-fade-in">
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-sm">
              <p className="font-medium text-destructive">Couldn't load sheet</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total Applications"
            value={apps.length}
            icon={<TrendingUp className="h-5 w-5" />}
            gradient="from-indigo-500 to-purple-600"
            loading={loading}
          />
          <StatCard
            label="Today"
            value={todayCount}
            icon={<Calendar className="h-5 w-5" />}
            gradient="from-emerald-500 to-teal-600"
            loading={loading}
          />
          <Card className="overflow-hidden border-0 shadow-md transition-transform hover:-translate-y-0.5">
            <div className="h-1 bg-gradient-to-r from-orange-500 to-pink-500" />
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Programs</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 text-white shadow-md">
                  <GraduationCap className="h-4 w-4" />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {programCounts.length === 0 && (
                  <span className="text-sm text-slate-400">—</span>
                )}
                {programCounts.slice(0, 6).map(([p, n]) => (
                  <span
                    key={p}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${programStyle(p)}`}
                  >
                    {p} · {n}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="relative md:col-span-4">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search name, CNIC, phone, email, program…"
                  className="pl-9"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <Select
                  value={program}
                  onValueChange={(v) => {
                    setProgram(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All programs</SelectItem>
                    {programs.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Select
                  value={gender}
                  onValueChange={(v) => {
                    setGender(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All genders</SelectItem>
                    {genders.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                />
              </div>
              <div className="md:col-span-1">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={clearFilters}
                  disabled={!hasFilters}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table (desktop) */}
        <Card className="hidden border-0 shadow-md md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead>
                      <button
                        className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                        onClick={() => setSortDesc((s) => !s)}
                      >
                        Timestamp
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">Full Name</TableHead>
                    <TableHead className="font-semibold text-slate-700">Program</TableHead>
                    <TableHead className="font-semibold text-slate-700">Phone</TableHead>
                    <TableHead className="font-semibold text-slate-700">Email</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Matric %</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Inter %</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-sm text-slate-500">
                        <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-indigo-500" />
                        Loading applications…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && paged.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-16 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                          <FileText className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="mt-3 font-medium text-slate-700">
                          {hasFilters ? "No matches found" : "No applications yet"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {hasFilters ? "Try adjusting your filters." : "New submissions will appear here automatically."}
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  {paged.map((a, idx) => (
                    <TableRow
                      key={a._rowId}
                      onClick={() => setSelected(a)}
                      className={`cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-slate-50/30" : ""} hover:bg-indigo-50/50`}
                    >
                      <TableCell className="whitespace-nowrap text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          {a.Timestamp || "—"}
                          {newIds.has(a._rowId) && (
                            <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                              New
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{a.FullName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${programStyle(a.ProgramSelected)}`}>
                          {a.ProgramSelected || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{a.Phone}</TableCell>
                      <TableCell className="text-sm text-slate-600">{a.Email}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-slate-700">{a.MatricPercentage}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-slate-700">{a.IntermediatePercentage}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setSelected(a); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t bg-slate-50/50 px-4 py-3 text-sm">
              <span className="text-slate-500">
                Showing <span className="font-semibold text-slate-700">{paged.length}</span> of{" "}
                <span className="font-semibold text-slate-700">{filtered.length}</span>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <span className="text-slate-500">
                  Page {currentPage} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {loading && (
            <Card className="border-0 shadow-md">
              <CardContent className="py-10 text-center text-sm text-slate-500">
                <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-indigo-500" />
                Loading…
              </CardContent>
            </Card>
          )}
          {!loading && paged.length === 0 && (
            <Card className="border-0 shadow-md">
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                <p className="font-medium text-slate-700">
                  {hasFilters ? "No matches found" : "No applications yet"}
                </p>
              </CardContent>
            </Card>
          )}
          {paged.map((a) => (
            <Card
              key={a._rowId}
              onClick={() => setSelected(a)}
              className="cursor-pointer border-0 shadow-md transition active:scale-[0.99]"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{a.FullName || "—"}</p>
                    <p className="truncate text-xs text-slate-500">{a.Timestamp}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${programStyle(a.ProgramSelected)}`}>
                    {a.ProgramSelected || "—"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 truncate">
                    <PhoneIcon className="h-3 w-3 shrink-0" /> {a.Phone || "—"}
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3 w-3 shrink-0" /> {a.Email || "—"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between pt-1 text-sm">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-slate-500">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      </main>

      <DetailDialog app={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function StatCard({
  label, value, icon, gradient, loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  loading: boolean;
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-md transition-transform hover:-translate-y-0.5">
      <div className={`h-1 bg-gradient-to-r ${gradient}`} />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {loading ? "…" : value}
            </p>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailDialog({
  app, onClose,
}: {
  app: Application | null;
  onClose: () => void;
}) {
  if (!app) {
    return (
      <Dialog open={false} onOpenChange={(o) => !o && onClose()}>
        <DialogContent />
      </Dialog>
    );
  }

  const personal = [
    { label: "Full Name", value: app.FullName },
    { label: "Father's Name", value: app.FatherName },
    { label: "Date of Birth", value: app.DateOfBirth },
    { label: "Gender", value: app.Gender },
    { label: "CNIC", value: app.CNIC },
  ];
  const academic = [
    { label: "Program Selected", value: app.ProgramSelected },
    { label: "Matric %", value: app.MatricPercentage },
    { label: "Intermediate %", value: app.IntermediatePercentage },
  ];
  const contact = [
    { label: "Phone", value: app.Phone },
    { label: "Email", value: app.Email },
    { label: "Address", value: app.Address },
  ];

  const allRows = [
    { label: "Session ID", value: app.SessionId },
    { label: "Timestamp", value: app.Timestamp },
    ...personal, ...academic, ...contact,
  ];

  function copySummary() {
    const text = allRows.map((r) => `${r.label}: ${r.value || "—"}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Summary copied");
  }

  function printPdf() {
    const html = `<!doctype html><html><head><title>${app!.FullName} — Application</title>
<style>
body{font-family:Inter,system-ui,sans-serif;padding:40px;color:#111827;max-width:780px;margin:auto}
.brand{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:2px solid #6366f1}
.logo{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px}
h1{margin:0;font-size:18px}
.sub{color:#6b7280;font-size:12px}
h2{margin:24px 0 8px;font-size:12px;text-transform:uppercase;color:#6366f1;letter-spacing:.08em}
table{width:100%;border-collapse:collapse;font-size:14px}
td{padding:8px 0;border-bottom:1px solid #e5e7eb;vertical-align:top}
td:first-child{color:#6b7280;width:200px}
</style></head><body>
<div class="brand"><div class="logo">🎓</div><div><h1>Shah Abdul Latif University</h1><div class="sub">Shahdadkot Campus · Admissions 2025-26</div></div></div>
<h2>Applicant</h2>
<div style="font-size:20px;font-weight:600;margin-top:4px">${app!.FullName || "—"}</div>
<div class="sub">${app!.ProgramSelected || ""} · ${app!.SessionId || ""}</div>
${section("Personal Information", personal)}
${section("Academic Information", academic)}
${section("Contact Information", contact)}
<script>window.onload=()=>window.print();</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  function section(title: string, rows: { label: string; value: string }[]) {
    return `<h2>${title}</h2><table>${rows.map((r) => `<tr><td>${r.label}</td><td>${(r.value || "—").toString().replace(/</g, "&lt;")}</td></tr>`).join("")}</table>`;
  }

  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 px-6 py-5 text-white">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-xl text-white">{app.FullName || "Application"}</DialogTitle>
                <p className="mt-1 text-sm text-indigo-100">
                  {app.ProgramSelected || "—"} · {app.SessionId || "No session ID"}
                </p>
              </div>
              <Badge className="shrink-0 bg-amber-400 text-amber-950 hover:bg-amber-400">
                Pending Review
              </Badge>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-5">
          <Section title="Personal Information" rows={personal} />
          <Section title="Academic Information" rows={academic} />
          <Section title="Contact Information" rows={contact} />
          <p className="text-xs text-slate-400">
            Session ID: {app.SessionId || "—"} · Submitted {app.Timestamp || "—"}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t bg-slate-50 px-6 py-3">
          <Button variant="outline" size="sm" onClick={copySummary}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={printPdf}>
            <Printer className="mr-2 h-4 w-4" /> Print / PDF
          </Button>
          <Button
            size="sm"
            onClick={printPdf}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700"
          >
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title, rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
        {title}
      </h3>
      <div className="rounded-lg border border-slate-200 bg-white">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`grid grid-cols-3 gap-3 px-4 py-2.5 text-sm ${i < rows.length - 1 ? "border-b border-slate-100" : ""}`}
          >
            <div className="text-slate-500">{r.label}</div>
            <div className="col-span-2 break-words font-medium text-slate-900">
              {r.value || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
