import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

// ---------------------------------------------------------------------------
// Types — duplicated from src/lib/types.ts so the SPA tsconfig doesn't need
// to reach into worker sources. Keep in sync with the Worker's JSON shape.
// ---------------------------------------------------------------------------

type AgentAction =
	| "llms_txt_concise"
	| "llms_txt_full"
	| "product_detail"
	| "catalog_browse"
	| "checkout_attempt"
	| "homepage"
	| "unknown";

interface AgentProfile {
	agentId: string;
	agentName: string | null;
	network: string | null;
	verified: boolean;
	totalRequests: number;
	productsViewed: number;
	checkoutAttempts: number;
	successfulCheckouts: number;
	estimatedRevenue: number;
	lastSeen: string;
}

interface ProductAnalytics {
	slug: string;
	name: string;
	price: number;
	detailViews: number;
	uniqueAgentViews: number;
	checkoutAttempts: number;
	successfulCheckouts: number;
	conversionRate: number;
	estimatedRevenue: number;
	viewedNotPurchased: string[];
}

interface FunnelMetrics {
	discoveryReads: number;
	fullDetailReads: number;
	productDetailReads: number;
	checkoutAttempts: number;
	successfulCheckouts: number;
	blockedCheckouts: number;
	discoveryToFullRate: number;
	discoveryToProductRate: number;
	productToCheckoutRate: number;
	checkoutSuccessRate: number;
}

interface RevenueMetrics {
	estimatedTotal: number;
	verifiedRevenue: number;
	unverifiedRevenue: number;
	verifiedCheckoutAttempts: number;
	unverifiedCheckoutAttempts: number;
	averageOrderValue: number;
	byNetwork: Record<
		string,
		{
			agents: number;
			checkoutAttempts: number;
			successfulCheckouts: number;
			estimatedRevenue: number;
			conversionRate: number;
		}
	>;
}

interface SecurityMetrics {
	verifiedAgents: number;
	unverifiedAgents: number;
	verifiedRate: number;
	blockedCheckouts: number;
	totalCheckoutAttempts: number;
	checkoutBlockRate: number;
}

interface JourneyStep {
	action: AgentAction;
	description: string;
	minutesAgo: number;
	statusCode: number;
}

interface AgentJourney {
	agentId: string;
	agentName: string | null;
	network: string | null;
	verified: boolean;
	steps: JourneyStep[];
	journeySummary: string;
	sessionDurationMinutes: number;
	isReturnVisitor: boolean;
	itemsPurchased: number;
	estimatedSpend: number;
}

interface Insight {
	icon: string;
	label: string;
	text: string;
	priority: number;
}

interface Summary {
	period: string;
	merchantName: string;
	totalEvents: number;
	uniqueAgents: number;
	agentBreakdown: AgentProfile[];
	topProducts: ProductAnalytics[];
	funnel: FunnelMetrics;
	revenue: RevenueMetrics;
	security: SecurityMetrics;
	agentJourneys: AgentJourney[];
	insights: Insight[];
}

interface MobileProductItem {
	id: string;
	name: string;
	price: number;
	qty: number;
	updatedAt: number;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
	const [pathname, setPathname] = useState<string>(() => window.location.pathname);

	useEffect(() => {
		const onPopState = () => setPathname(window.location.pathname);
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	const isMobileAppRoute =
		pathname === "/mobile_app" || pathname.endsWith("/mobile_app");

	if (isMobileAppRoute) {
		return <MobileAppView />;
	}

	return <AnalyticsDashboardApp />;
}

// ---------------------------------------------------------------------------
// Mobile App (/mobile_app)
// ---------------------------------------------------------------------------

const MOBILE_STORAGE_KEY = "hamaai_mobile_app_products_v1";
const MOBILE_CHANNEL_KEY = "hamaai_mobile_app_channel_v1";
const MOBILE_SYNC_ENDPOINT = ""; // لێرە لینکی Worker دابنێ ئەگەر ویستت لەسەر IP جیاواز داتاکان بگۆڕدرێنەوە

function resolveChannelId(): string {
	const params = new URLSearchParams(window.location.search);
	const fromUrl = params.get("channel");
	if (fromUrl && fromUrl.trim().length > 0) {
		try {
			localStorage.setItem(MOBILE_CHANNEL_KEY, fromUrl.trim());
		} catch {
			// ignore storage error
		}
		return fromUrl.trim();
	}
	try {
		const saved = localStorage.getItem(MOBILE_CHANNEL_KEY);
		if (saved) return saved;
		const generated = `ch_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
		localStorage.setItem(MOBILE_CHANNEL_KEY, generated);
		return generated;
	} catch {
		return "ch_default";
	}
}

function loadMobileProducts(): MobileProductItem[] {
	try {
		const raw = localStorage.getItem(MOBILE_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function MobileAppView() {
	const [products, setProducts] = useState<MobileProductItem[]>(() =>
		loadMobileProducts(),
	);
	const [name, setName] = useState("");
	const [price, setPrice] = useState("");
	const [qty, setQty] = useState("1");
	const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
	const [statusText, setStatusText] = useState<string>(
		"خۆکارانە قبوڵ کرا و ئامادەیە",
	);
	const [copied, setCopied] = useState(false);

	const channelId = useMemo(() => resolveChannelId(), []);

	const shareLink = useMemo(() => {
		const base = `${window.location.origin}/mobile_app`;
		return `${base}?channel=${encodeURIComponent(channelId)}&auto=1`;
	}, [channelId]);

	useEffect(() => {
		try {
			localStorage.setItem(MOBILE_STORAGE_KEY, JSON.stringify(products));
		} catch {
			setStatusText("کێشە لە خەزنکردنی ناوخۆیی");
		}
	}, [products]);

	useEffect(() => {
		const handleOnline = () => {
			setIsOnline(true);
			setStatusText("ئۆنڵاین بوو — هاوکاتکردنی نهێنی چالاکە");
		};
		const handleOffline = () => {
			setIsOnline(false);
			setStatusText("ئینتەرنێت نییە (ئۆفڵاین) — لە هەمان شوێن ماوە");
		};
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	useEffect(() => {
		const onStorage = (e: StorageEvent) => {
			if (e.key === MOBILE_STORAGE_KEY && e.newValue) {
				try {
					const incoming = JSON.parse(e.newValue) as MobileProductItem[];
					if (Array.isArray(incoming)) {
						setProducts(incoming);
						setStatusText("داتاکان بە نهێنی هاوکات کران");
					}
				} catch {
					// ignore invalid JSON
				}
			}
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, []);

	useEffect(() => {
		if (!isOnline || !MOBILE_SYNC_ENDPOINT) return;
		let cancelled = false;

		const syncLoop = async () => {
			try {
				await fetch(`${MOBILE_SYNC_ENDPOINT}/sync`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						channelId,
						products,
						updatedAt: Date.now(),
					}),
				});

				const res = await fetch(
					`${MOBILE_SYNC_ENDPOINT}/sync?channelId=${encodeURIComponent(channelId)}`,
				);
				if (!res.ok) return;
				const data = (await res.json()) as {
					products?: MobileProductItem[];
					updatedAt?: number;
				};
				if (!cancelled && Array.isArray(data.products) && data.updatedAt) {
					const localLatest = products.reduce(
						(acc, p) => Math.max(acc, p.updatedAt || 0),
						0,
					);
					if (data.updatedAt > localLatest) {
						setProducts(data.products);
						setStatusText("داتای دەرەوە بە نهێنی وەرگیرا");
					}
				}
			} catch {
				if (!cancelled) {
					setStatusText("دۆخی ئۆفڵاین / چاوەڕوانی پەیوەندی");
				}
			}
		};

		syncLoop();
		const timer = window.setInterval(syncLoop, 5000);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [isOnline, channelId, products]);

	const addProduct = (e: React.FormEvent) => {
		e.preventDefault();
		const cleanName = name.trim();
		const numericPrice = Number(price);
		const numericQty = Math.max(1, Number(qty) || 1);
		if (!cleanName || Number.isNaN(numericPrice) || numericPrice < 0) return;

		const item: MobileProductItem = {
			id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
			name: cleanName,
			price: numericPrice,
			qty: numericQty,
			updatedAt: Date.now(),
		};
		setProducts((prev) => [item, ...prev]);
		setName("");
		setPrice("");
		setQty("1");
		setStatusText(
			isOnline
				? "کاڵا زیاد کرا و خەزن بوو"
				: "لە دۆخی ئۆفڵاین خەزن کرا و دەمێنێتەوە",
		);
	};

	const removeProduct = (id: string) => {
		setProducts((prev) => prev.filter((item) => item.id !== id));
	};

	const copyShareLink = async () => {
		try {
			await navigator.clipboard.writeText(shareLink);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	};

	const total = useMemo(
		() => products.reduce((sum, item) => sum + item.price * item.qty, 0),
		[products],
	);

	return (
		<div
			dir="rtl"
			className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col justify-between"
		>
			<div className="max-w-2xl w-full mx-auto space-y-5">
				<div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2">
					<div className="flex items-center justify-between gap-2">
						<h1 className="text-lg font-bold text-white">mobile_app</h1>
						<span
							className={`px-3 py-1 rounded-full text-xs ${
								isOnline
									? "bg-emerald-500/20 text-emerald-300"
									: "bg-amber-500/20 text-amber-300"
							}`}
						>
							{isOnline ? "ئۆنڵاین" : "ئۆفڵاین"}
						</span>
					</div>
					<p className="text-xs text-slate-400">کەناڵ: {channelId}</p>
					<p className="text-xs text-slate-200">{statusText}</p>
				</div>

				<div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2">
					<label className="block text-xs font-medium text-slate-300">
						لینکی کردنەوە لە مۆبایل
					</label>
					<div className="flex flex-col sm:flex-row gap-2">
						<input
							type="text"
							readOnly
							value={shareLink}
							className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200"
						/>
						<button
							type="button"
							onClick={copyShareLink}
							className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white"
						>
							{copied ? "کۆپی کرا ✓" : "کۆپیکردنی لینک"}
						</button>
					</div>
				</div>

				<form
					onSubmit={addProduct}
					className="rounded-2xl border border-slate-800 bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-4 gap-2"
				>
					<input
						type="text"
						placeholder="ناوی کاڵا"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="sm:col-span-2 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
					/>
					<input
						type="number"
						placeholder="نرخ"
						value={price}
						onChange={(e) => setPrice(e.target.value)}
						className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
					/>
					<div className="flex gap-2">
						<input
							type="number"
							min="1"
							value={qty}
							onChange={(e) => setQty(e.target.value)}
							className="w-16 rounded-xl bg-slate-950 border border-slate-700 px-2 py-2 text-sm text-white"
						/>
						<button
							type="submit"
							className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-semibold text-white"
						>
							زیادکردن
						</button>
					</div>
				</form>

				<div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-semibold text-white">
							کاڵاکان ({products.length})
						</h2>
						<span className="text-sm font-bold text-emerald-400">
							کۆ: {total.toLocaleString()}
						</span>
					</div>
					{products.length === 0 ? (
						<p className="text-xs text-slate-400">هیچ کاڵایەک نییە.</p>
					) : (
						<ul className="divide-y divide-slate-800">
							{products.map((p) => (
								<li
									key={p.id}
									className="py-2.5 flex items-center justify-between gap-2"
								>
									<div>
										<p className="text-sm font-medium text-white">{p.name}</p>
										<p className="text-xs text-slate-400">
											{p.qty} × {p.price.toLocaleString()}
										</p>
									</div>
									<button
										type="button"
										onClick={() => removeProduct(p.id)}
										className="text-xs text-rose-400 hover:text-rose-300"
									>
										سڕینەوە
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			<footer className="max-w-2xl w-full mx-auto pt-6 pb-2 text-center text-xs text-slate-400">
				©hama rekan
			</footer>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Existing Analytics Dashboard
// ---------------------------------------------------------------------------

function AnalyticsDashboardApp() {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			setError(null);
			try {
				const res = await fetch("/api/dashboard");
				if (!res.ok) {
					throw new Error(`API error: ${res.status}`);
				}
				const json = (await res.json()) as Summary;
				if (!cancelled) setSummary(json);
			} catch (err) {
				if (!cancelled)
					setError(err instanceof Error ? err.message : "Unknown error");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="page">
			<header className="topbar">
				<div className="brand">
					<span className="brand-title">Agent Commerce Analytics</span>
					<span className="merchant-name">
						{summary?.merchantName ?? "Loading…"}
					</span>
				</div>
				<div className="badges">
					<span className="badge workers">Workers</span>
					<span className="badge kv">KV</span>
				</div>
			</header>

			<main className="main">
				{loading && (
					<div className="state">
						<h2>Loading dashboard…</h2>
						<p>Reading agent events from KV.</p>
					</div>
				)}

				{error && (
					<div className="state">
						<h2 className="error">Could not load dashboard</h2>
						<p>{error}</p>
					</div>
				)}

				{summary && !loading && !error && <Dashboard summary={summary} />}
			</main>

			<footer className="footer">
				Data persisted in <code>EVENT_STORE</code> (KV). Post events to{" "}
				<code>/api/events/from-headers</code> from your Managed Ruleset or
				origin Worker to feed this dashboard with real traffic.
			</footer>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function Dashboard({ summary }: { summary: Summary }) {
	const purchasingAgents = summary.agentBreakdown.filter(
		(a) => a.successfulCheckouts > 0,
	).length;

	return (
		<div>
			{/* Headline cards */}
			<div className="headline-grid">
				<HeadlineCard
					label="Agent revenue"
					value={formatCurrency(summary.revenue.estimatedTotal)}
					hint={`${purchasingAgents} purchasing agent${purchasingAgents === 1 ? "" : "s"}`}
					revenue
				/>
				<HeadlineCard
					label="Unique agents"
					value={String(summary.uniqueAgents)}
					hint={`${summary.totalEvents} total requests`}
				/>
				<HeadlineCard
					label="Verified agents"
					value={`${summary.security.verifiedAgents} / ${summary.security.verifiedAgents + summary.security.unverifiedAgents}`}
					hint={`${formatPercent(summary.security.verifiedRate)} verified`}
				/>
				<HeadlineCard
					label="Blocked at checkout"
					value={String(summary.security.blockedCheckouts)}
					hint={
						summary.security.totalCheckoutAttempts > 0
							? `${formatPercent(summary.security.checkoutBlockRate)} block rate`
							: "No checkout attempts yet"
					}
				/>
			</div>

			{/* Insights */}
			{summary.insights.length > 0 && (
				<section className="section">
					<div className="section-header">
						<h2>Insights</h2>
						<span className="sub">
							Auto-generated headlines computed from events
						</span>
					</div>
					<div className="insight-list">
						{summary.insights.map((ins, i) => (
							<div key={i} className={`insight ${ins.icon}`}>
								<div className="label">{ins.label}</div>
								<div className="text">{ins.text}</div>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Funnel */}
			<section className="section">
				<div className="section-header">
					<h2>Discovery funnel</h2>
					<span className="sub">
						llms.txt reads → product views → checkout outcomes
					</span>
				</div>
				<Funnel funnel={summary.funnel} />
			</section>

			{/* Agents */}
			<section className="section">
				<div className="section-header">
					<h2>Agents</h2>
					<span className="sub">Per-agent activity with estimated spend</span>
				</div>
				<AgentTable agents={summary.agentBreakdown} />
			</section>

			{/* Journeys */}
			{summary.agentJourneys.length > 0 && (
				<section className="section">
					<div className="section-header">
						<h2>Agent journeys</h2>
						<span className="sub">
							Session-reconstructed timelines with return-visit detection
						</span>
					</div>
					{summary.agentJourneys.map((j) => (
						<JourneyCard key={j.agentId} journey={j} />
					))}
				</section>
			)}

			{/* Products */}
			{summary.topProducts.length > 0 && (
				<section className="section">
					<div className="section-header">
						<h2>Product performance</h2>
						<span className="sub">
							Views, conversions, and revenue per product
						</span>
					</div>
					<ProductTable products={summary.topProducts} />
				</section>
			)}

			{/* Before / after comparison */}
			<section className="section">
				<div className="section-header">
					<h2>What this unlocks</h2>
					<span className="sub">
						Generic zone analytics vs. commerce-aware analytics
					</span>
				</div>
				<BeforeAfter summary={summary} purchasingAgents={purchasingAgents} />
			</section>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function HeadlineCard({
	label,
	value,
	hint,
	revenue,
}: {
	label: string;
	value: string;
	hint?: string;
	revenue?: boolean;
}) {
	return (
		<div className={`headline-card ${revenue ? "revenue" : ""}`}>
			<div className="label">{label}</div>
			<div className="value">{value}</div>
			{hint && <div className="hint">{hint}</div>}
		</div>
	);
}

function Funnel({ funnel }: { funnel: FunnelMetrics }) {
	const max = Math.max(
		funnel.discoveryReads,
		funnel.productDetailReads,
		funnel.checkoutAttempts,
		1,
	);

	const rows: Array<{
		label: string;
		value: number;
		rate?: string;
		variant?: "blocked" | "success";
	}> = [
		{ label: "Discovery (/llms.txt)", value: funnel.discoveryReads },
		{
			label: "Needed full detail",
			value: funnel.fullDetailReads,
			rate: `${formatPercent(funnel.discoveryToFullRate)} of discovery`,
		},
		{
			label: "Product views",
			value: funnel.productDetailReads,
			rate: `${formatPercent(funnel.discoveryToProductRate)} of discovery`,
		},
		{
			label: "Checkout attempts",
			value: funnel.checkoutAttempts,
			rate: `${formatPercent(funnel.productToCheckoutRate)} of views`,
		},
		{
			label: "Successful checkouts",
			value: funnel.successfulCheckouts,
			rate: `${formatPercent(funnel.checkoutSuccessRate)} success`,
			variant: "success",
		},
	];
	if (funnel.blockedCheckouts > 0) {
		rows.push({
			label: "Blocked (unverified)",
			value: funnel.blockedCheckouts,
			variant: "blocked",
		});
	}

	return (
		<div>
			{rows.map((r) => {
				const pct = (r.value / max) * 100;
				return (
					<div className="funnel-row" key={r.label}>
						<div className="funnel-label">{r.label}</div>
						<div className="funnel-bar-container">
							<div
								className={`funnel-bar ${r.variant ?? ""}`}
								style={{ width: `${Math.max(pct, r.value > 0 ? 4 : 0)}%` }}
							/>
						</div>
						<div className="funnel-value">
							{r.value}
							{r.rate && <span className="rate">({r.rate})</span>}
						</div>
					</div>
				);
			})}
		</div>
	);
}

function AgentTable({ agents }: { agents: AgentProfile[] }) {
	if (agents.length === 0) {
		return <div className="state">No agent traffic yet.</div>;
	}
	return (
		<div className="table-scroll">
			<table className="agent-table">
				<thead>
					<tr>
						<th>Agent</th>
						<th>Network</th>
						<th>Status</th>
						<th className="numeric">Requests</th>
						<th className="numeric">Products viewed</th>
						<th className="numeric">Checkouts</th>
						<th className="numeric">Est. revenue</th>
					</tr>
				</thead>
				<tbody>
					{agents.map((a) => (
						<tr key={a.agentId}>
							<td>{a.agentName ?? a.agentId}</td>
							<td>{a.network ?? "—"}</td>
							<td>
								<span
									className={`status-pill ${a.verified ? "verified" : "unverified"}`}
								>
									{a.verified ? "Verified" : "Unverified"}
								</span>
							</td>
							<td className="numeric">{a.totalRequests}</td>
							<td className="numeric">{a.productsViewed}</td>
							<td className="numeric">
								{a.successfulCheckouts}
								{a.checkoutAttempts > a.successfulCheckouts && (
									<span style={{ color: "#dc2626" }}>
										{" "}
										(+{a.checkoutAttempts - a.successfulCheckouts} blocked)
									</span>
								)}
							</td>
							<td className="numeric">
								{a.estimatedRevenue > 0 ? (
									<span className="revenue-value">
										{formatCurrency(a.estimatedRevenue)}
									</span>
								) : (
									"—"
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function JourneyCard({ journey }: { journey: AgentJourney }) {
	return (
		<div className="journey-card">
			<div className="journey-header">
				<div>
					<div className="journey-name">
						{journey.agentName ?? journey.agentId}
					</div>
					<div className="journey-summary">{journey.journeySummary}</div>
				</div>
				<div className="journey-meta">
					<span
						className={`status-pill ${journey.verified ? "verified" : "unverified"}`}
					>
						{journey.verified ? (journey.network ?? "verified") : "unverified"}
					</span>
					{journey.estimatedSpend > 0 && (
						<span className="spend">
							{formatCurrency(journey.estimatedSpend)}
						</span>
					)}
					{journey.isReturnVisitor && <span>Return visitor</span>}
				</div>
			</div>
			<div className="journey-steps">
				{journey.steps.map((step, i) => {
					const kind = stepKind(step);
					return (
						<div key={i} className="journey-step">
							<span className="time">{formatMinutesAgo(step.minutesAgo)}</span>
							<span className={`icon ${kind}`}>{stepGlyph(kind)}</span>
							<span className="desc">{step.description}</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function ProductTable({ products }: { products: ProductAnalytics[] }) {
	return (
		<div className="table-scroll">
			<table className="product-table">
				<thead>
					<tr>
						<th>Product</th>
						<th className="numeric">Price</th>
						<th className="numeric">Views</th>
						<th className="numeric">Unique agents</th>
						<th className="numeric">Checkouts</th>
						<th className="numeric">Conversion</th>
						<th className="numeric">Est. revenue</th>
					</tr>
				</thead>
				<tbody>
					{products.map((p) => (
						<tr key={p.slug}>
							<td>{p.name}</td>
							<td className="numeric">{formatCurrency(p.price)}</td>
							<td className="numeric">{p.detailViews}</td>
							<td className="numeric">{p.uniqueAgentViews}</td>
							<td className="numeric">{p.successfulCheckouts}</td>
							<td className="numeric">{formatPercent(p.conversionRate)}</td>
							<td className="numeric">
								{p.estimatedRevenue > 0 ? (
									<span className="revenue-value">
										{formatCurrency(p.estimatedRevenue)}
									</span>
								) : (
									"—"
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function BeforeAfter({
	summary,
	purchasingAgents,
}: {
	summary: Summary;
	purchasingAgents: number;
}) {
	const topAgent = summary.agentBreakdown.find((a) => a.estimatedRevenue > 0);
	const topProduct = summary.topProducts[0];

	const beforeLines: string[] = [
		`${summary.totalEvents} requests flagged as likely-bot`,
		`${summary.funnel.discoveryReads} hits on /llms.txt`,
	];
	if (topProduct) {
		beforeLines.push(
			`/api/products/${topProduct.slug} hit ${topProduct.detailViews}×`,
		);
	}
	if (summary.security.blockedCheckouts > 0) {
		beforeLines.push(
			`${summary.security.blockedCheckouts} × 403 on /api/checkout`,
		);
	}

	const afterLines: string[] = [
		`${summary.uniqueAgents} distinct agents, ${purchasingAgents} purchased ${formatCurrency(summary.revenue.estimatedTotal)}`,
	];
	if (topAgent) {
		afterLines.push(
			`${topAgent.agentName ?? topAgent.agentId} (${topAgent.network ?? "unverified"}) bought ${topAgent.successfulCheckouts} item${topAgent.successfulCheckouts === 1 ? "" : "s"}`,
		);
	}
	if (topProduct) {
		afterLines.push(
			`${formatPercent(topProduct.conversionRate)} agent conversion on ${topProduct.name}`,
		);
	}
	if (summary.security.blockedCheckouts > 0) {
		afterLines.push("Unverified agents blocked before payment — no leak");
	}

	return (
		<div className="compare-grid">
			<div className="compare-col before">
				<h3>Cloudflare analytics today</h3>
				<div className="value">
					{beforeLines.map((l, i) => (
						<div key={i}>"{l}"</div>
					))}
				</div>
			</div>
			<div className="compare-col">
				<h3>This dashboard</h3>
				<div className="value">
					{afterLines.map((l, i) => (
						<div key={i}>"{l}"</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	} catch {
		return `$${amount.toFixed(2)}`;
	}
}

function formatPercent(rate: number): string {
	return `${(rate * 100).toFixed(1)}%`;
}

function formatMinutesAgo(m: number): string {
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	const rem = m % 60;
	return rem === 0 ? `${h}h ago` : `${h}h${String(rem).padStart(2, "0")}m`;
}

function stepKind(
	step: JourneyStep,
): "discover" | "view" | "buy" | "blocked" | "" {
	if (step.statusCode === 403) return "blocked";
	if (step.action === "llms_txt_concise" || step.action === "llms_txt_full")
		return "discover";
	if (step.action === "product_detail") return "view";
	if (step.action === "checkout_attempt") return "buy";
	return "";
}

function stepGlyph(kind: string): string {
	switch (kind) {
		case "discover":
			return "\u2315";
		case "view":
			return "\u25CE";
		case "buy":
			return "\u2713";
		case "blocked":
			return "\u2715";
		default:
			return "\u2022";
	}
}

export default App;
