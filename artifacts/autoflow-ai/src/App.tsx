import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check,
  CheckCircle2, ChevronDown, CircleHelp, Clock3, Command,
  Gauge, Headphones, Layers3, Link2, LoaderCircle, Menu, Plus, RefreshCw,
  Search, Send, Settings2, ShieldAlert, Sparkles,
  UserRound, UsersRound, Wrench, X,
} from 'lucide-react';
import {
  getGetAnalyticsQueryKey, getGetRequestQueryKey, getListRequestsQueryKey,
  getListTasksQueryKey, useCreateRequest, useGetAnalytics, useGetRequest,
  useListRequests, useListTasks, useListUsers, useUpdateTaskStatus,
} from '@workspace/api-client-react';
import type { RequestSummary, Task, User } from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();
type RequestStatus = 'ALL' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
type TaskStatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ESCALATED';
const navItems = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/requests', label: 'Requests', icon: Layers3 },
  { href: '/tasks', label: 'Task inbox', icon: CheckCircle2 },
];

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AF';
}
function pretty(value?: string | null) {
  if (!value) return '—';
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function when(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}
function shortDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
function StatusPill({ status }: { status: string }) {
  const kind = status.toLowerCase().replaceAll('_', '-');
  return <span className={`status-pill status-${kind}`} data-testid={`status-${kind}`}>{pretty(status)}</span>;
}
function PriorityMark({ priority }: { priority: string }) {
  const kind = priority.toLowerCase();
  return <span className={`priority-mark priority-${kind}`}><i />{pretty(priority)}</span>;
}
function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: ReactNode; description: string; action?: ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="skeleton-stack" aria-label="Loading"><span className="skeleton wide" />{Array.from({ length: rows }, (_, i) => <span className="skeleton" key={i} />)}</div>;
}
function ErrorState({ retry, text = 'We couldn’t load this view.' }: { retry: () => void; text?: string }) {
  return <div className="empty-state"><div className="empty-icon"><AlertTriangle size={19} /></div><h3>Connection interrupted</h3><p>{text} Your work is safe. Try again in a moment.</p><button className="button button-secondary button-small" onClick={retry}><RefreshCw size={14} /> Retry</button></div>;
}
function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Layers3 size={20} /></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}
function RequestRow({ request }: { request: RequestSummary }) {
  return <Link href={`/requests/${request.id}`} className="request-row" data-testid={`link-request-${request.id}`}>
    <div className="request-mark"><span className={`request-dot dot-${request.priority.toLowerCase()}`} /></div>
    <div className="request-row-main"><div className="request-row-title">{request.rawText}</div><div className="request-row-meta"><span className="mono">AF-{request.id.slice(-5).toUpperCase()}</span><span>{pretty(request.category)}</span><span>{request.requesterName}</span></div></div>
    <div className="request-row-end"><StatusPill status={request.status} /><span className="request-date">{shortDate(request.createdAt)}</span></div>
    <ArrowRight className="row-arrow" size={15} />
  </Link>;
}

function AppShell({ children, user, users, onUserChange }: { children: ReactNode; user: User | null; users: User[]; onUserChange: (id: string) => void }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="app-shell min-h-[100dvh]">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <Link href="/" className="brand" onClick={() => setMobileOpen(false)}>
        <span className="brand-symbol"><span /><span /><span /></span><span className="brand-name">autoflow<span>ai</span></span>
      </Link>
      <div className="workspace-label">OPERATIONS</div>
      <nav className="side-nav" aria-label="Main navigation">{navItems.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? location === '/' : location.startsWith(href);
        return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-link ${active ? 'nav-active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === 'Task inbox' && <span className="nav-indicator" />}</Link>;
      })}</nav>
      <div className="sidebar-spacer" />
      <div className="side-status"><span className="live-dot" /><span>All systems operational</span><span className="status-light" /></div>
      <button className="sidebar-help" type="button" onClick={() => window.open('mailto:operations@autoflow.ai')}><CircleHelp size={16} /><span>Operations help</span><ArrowUpRight size={13} /></button>
      <div className="side-user">
        <div className="avatar avatar-side">{initials(user?.fullName)}</div>
        <div className="side-user-text"><strong>{user?.fullName ?? 'Choose a user'}</strong><span>{user ? `${pretty(user.role)} · ${user.department}` : 'Demo workspace'}</span></div>
        <Settings2 size={15} className="side-settings" />
      </div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
    <div className="main-column">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen((open) => !open)}><Menu size={19} /></button>
        <div className="crumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{location === '/' ? 'Overview' : location.startsWith('/tasks') ? 'Task inbox' : location.startsWith('/requests/new') ? 'New request' : location.startsWith('/requests/') && location !== '/requests' ? 'Request detail' : 'Requests'}</strong></div>
        <div className="topbar-right">
          <div className="live-clock"><span className="live-dot" /> Live operations</div>
          <div className="user-select-wrap"><UserRound size={14} /><select aria-label="Switch demo user" value={user?.id ?? ''} onChange={(event) => onUserChange(event.target.value)} data-testid="select-demo-user"><option value="" disabled>Select user</option>{users.map((person) => <option key={person.id} value={person.id}>{person.fullName} · {pretty(person.role)}</option>)}</select><ChevronDown size={13} /></div>
          <button className="icon-button notification-button" aria-label="Notifications" onClick={() => window.dispatchEvent(new CustomEvent('autoflow-notice', { detail: 'You’re all caught up.' }))}><Bell size={17} /><span /></button>
        </div>
      </header>
      <main className="main-content">{children}</main>
      <footer className="app-footer"><span>AutoFlow AI <span className="footer-dot">/</span> Internal operations</span><span className="mono">BUILD 2.4.08</span></footer>
    </div>
  </div>;
}

function Notice() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const listener = (event: Event) => { setMessage((event as CustomEvent<string>).detail); window.setTimeout(() => setMessage(''), 2600); };
    window.addEventListener('autoflow-notice', listener);
    return () => window.removeEventListener('autoflow-notice', listener);
  }, []);
  if (!message) return null;
  return <div className="notice-toast"><Check size={15} />{message}</div>;
}

function Dashboard({ user }: { user: User }) {
  const headers = useMemo(() => ({ 'x-user-id': user.id, 'x-user-role': user.role }), [user.id, user.role]);
  const analytics = useGetAnalytics({ request: { headers }, query: { queryKey: [...getGetAnalyticsQueryKey(), user.id] } });
  const requests = useListRequests(undefined, { request: { headers }, query: { queryKey: [...getListRequestsQueryKey(), user.id] } });
  const metrics = analytics.data;
  const recent = metrics?.recentActivity ?? [];
  const error = analytics.isError || requests.isError;
  const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date()).toUpperCase();
  return <div className="page-enter">
    <PageTitle eyebrow={`${dayLabel}, OPERATIONS DESK`} title={<>Good morning, {user.fullName.split(' ')[0]}<span className="title-period">.</span></>} description="Here’s what’s moving across your operation today." action={<Link href="/requests/new" className="button button-primary"><Plus size={16} /> Submit a request</Link>} />
    {analytics.isLoading ? <div className="metric-grid stagger">{[1, 2, 3, 4].map((x) => <div className="metric-card surface" key={x}><span className="skeleton" /><span className="skeleton wide" /></div>)}</div> : error ? <ErrorState retry={() => { analytics.refetch(); requests.refetch(); }} /> : <section className="metric-grid stagger" aria-label="Operational analytics">
      <MetricCard label="Open requests" value={metrics?.openRequests ?? 0} note="Across your visible queue" icon={<Layers3 size={16} />} accent="teal" />
      <MetricCard label="SLA breaches" value={metrics?.slaBreaches ?? 0} note="Needs attention now" icon={<ShieldAlert size={16} />} accent="coral" trend={metrics?.slaBreaches ? 'Review queue' : 'No active breaches'} />
      <MetricCard label="Avg. resolution" value={`${(metrics?.avgResolutionHours ?? 0).toFixed(1)}h`} note="Time to completion" icon={<Clock3 size={16} />} accent="gold" trend="Last 30 days" />
      <MetricCard label="Resolved this week" value={metrics?.resolvedThisWeek ?? 0} note={`${metrics?.totalRequests ?? 0} requests all time`} icon={<CheckCircle2 size={16} />} accent="blue" />
    </section>}
    <section className="dashboard-grid">
      <div className="surface panel queue-panel">
        <div className="panel-heading"><div><div className="section-kicker">THE QUEUE</div><h2>Recent requests</h2></div><Link href="/requests" className="text-link">All requests <ArrowRight size={14} /></Link></div>
        {requests.isLoading ? <Skeleton rows={5} /> : requests.isError ? <ErrorState retry={() => requests.refetch()} /> : requests.data?.length ? <div className="request-list">{requests.data.slice(0, 5).map((request) => <RequestRow key={request.id} request={request} />)}</div> : <EmptyState title="A clear runway" text="No requests have landed in your view yet. Submit the first one or switch demo users." action={<Link href="/requests/new" className="text-link">Create request <ArrowRight size={14} /></Link>} />}
      </div>
      <div className="right-rail">
        <div className="surface panel activity-panel">
          <div className="panel-heading"><div><div className="section-kicker">LIVE FEED</div><h2>Recent activity</h2></div><span className="live-pill"><i />Live</span></div>
          {analytics.isLoading ? <Skeleton rows={4} /> : recent.length ? <div className="timeline">{recent.slice(0, 5).map((item) => <div className="timeline-item" key={item.id}><span className="timeline-dot" /><div><p>{item.action}</p><span>{item.actorName || 'AutoFlow'} · {when(item.createdAt)}</span></div></div>)}</div> : <div className="quiet-empty">Updates will appear here as work moves.</div>}
          <Link href="/tasks" className="panel-bottom-link">Go to task inbox <ArrowRight size={14} /></Link>
        </div>
        <div className="load-panel">
          <div className="load-panel-head"><div><div className="section-kicker">CAPACITY</div><h2>Department load</h2></div><UsersRound size={17} /></div>
          {analytics.isLoading ? <Skeleton rows={3} /> : metrics?.departmentLoads?.length ? <div className="load-list">{metrics.departmentLoads.slice(0, 4).map((item) => {
            const max = Math.max(...metrics.departmentLoads.map((load) => load.openTasks), 1);
            return <div className="load-item" key={item.department}><div className="load-label"><span>{item.department}</span><b>{item.openTasks}</b></div><div className="load-track"><span style={{ width: `${Math.max((item.openTasks / max) * 100, 4)}%` }} /></div><div className="load-sub">{item.avgResolutionHours.toFixed(1)}h avg. resolution</div></div>;
          })}</div> : <div className="quiet-empty">Workload metrics appear when tasks are routed.</div>}
        </div>
      </div>
    </section>
    <div className="dashboard-bottom"><div className="bottom-note"><span className="note-symbol"><Sparkles size={16} /></span><div><strong>Requests in plain language. Work, already in motion.</strong><span>AutoFlow turns operational asks into routed, trackable work.</span></div><Link href="/requests/new" className="text-link">Try it <ArrowRight size={14} /></Link></div><div className="bottom-roles"><span>WORKING ACROSS</span><b><Headphones size={13} /> IT support</b><b><Wrench size={13} /> Facilities</b><b><Command size={13} /> Operations</b></div></div>
  </div>;
}
function MetricCard({ label, value, note, icon, accent, trend }: { label: string; value: string | number; note: string; icon: ReactNode; accent: string; trend?: string }) {
  return <div className={`metric-card surface metric-${accent}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><div className="metric-value">{value}</div><div className="metric-note">{trend ? <span className="metric-trend">{trend}</span> : note}</div></div>;
}

function RequestsPage({ user }: { user: User }) {
  const [status, setStatus] = useState<RequestStatus>('ALL');
  const [search, setSearch] = useState('');
  const params = useMemo(() => status === 'ALL' ? undefined : { status }, [status]);
  const headers = useMemo(() => ({ 'x-user-id': user.id, 'x-user-role': user.role }), [user.id, user.role]);
  const result = useListRequests(params, { request: { headers }, query: { queryKey: [...getListRequestsQueryKey(params), user.id] } });
  const filtered = (result.data ?? []).filter((request) => `${request.rawText} ${request.requesterName} ${request.category}`.toLowerCase().includes(search.toLowerCase()));
  const tabs: RequestStatus[] = ['ALL', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
  return <div className="page-enter">
    <PageTitle eyebrow="REQUEST CONTROL" title="Requests" description="Every operational ask, translated into work you can follow." action={<Link href="/requests/new" className="button button-primary"><Plus size={16} /> New request</Link>} />
    <div className="surface list-toolbar"><div className="filter-tabs">{tabs.map((item) => <button key={item} onClick={() => setStatus(item)} className={`filter-tab ${status === item ? 'filter-active' : ''}`} data-testid={`filter-request-${item.toLowerCase()}`}>{item === 'ALL' ? 'All requests' : pretty(item)}</button>)}</div><label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search visible requests" data-testid="input-search-requests" /><kbd>⌘ K</kbd></label></div>
    <div className="list-context"><span>{result.data ? `${filtered.length} ${filtered.length === 1 ? 'request' : 'requests'}` : 'Request register'}</span><span><span className="live-dot" /> Visible to {user.fullName.split(' ')[0]}</span></div>
    <div className="surface request-register">
      {result.isLoading ? <Skeleton rows={6} /> : result.isError ? <ErrorState retry={() => result.refetch()} /> : filtered.length ? filtered.map((request) => <RequestRow key={request.id} request={request} />) : <EmptyState title={search ? 'No matching requests' : 'Nothing in this view'} text={search ? 'Try a different phrase or clear the search.' : 'There are no requests in this status for the active demo user.'} action={search ? <button className="text-link" onClick={() => setSearch('')}>Clear search <X size={14} /></button> : <Link href="/requests/new" className="text-link">Submit a request <ArrowRight size={14} /></Link>} />}
    </div>
    <div className="register-foot"><span>Request visibility follows your active role.</span><button onClick={() => result.refetch()} className="subtle-button"><RefreshCw size={13} /> Refresh register</button></div>
  </div>;
}

function NewRequestPage({ user }: { user: User }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [urls, setUrls] = useState<string[]>(['']);
  const [notice, setNotice] = useState('');
  const [stage, setStage] = useState(0);
  const headers = useMemo(() => ({ 'x-user-id': user.id, 'x-user-role': user.role }), [user.id, user.role]);
  const create = useCreateRequest({ request: { headers } });
  const addUrl = () => setUrls((current) => [...current, '']);
  const updateUrl = (index: number, value: string) => setUrls((current) => current.map((url, i) => i === index ? value : url));
  const removeUrl = (index: number) => setUrls((current) => current.filter((_, i) => i !== index));
  useEffect(() => {
    if (!create.isPending) { setStage(0); return; }
    setStage(1);
    const first = window.setTimeout(() => setStage(2), 650);
    const second = window.setTimeout(() => setStage(3), 1450);
    return () => { window.clearTimeout(first); window.clearTimeout(second); };
  }, [create.isPending]);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice('');
    const attachmentUrls = urls.map((url) => url.trim()).filter(Boolean);
    create.mutate({ data: { rawText: description.trim(), ...(attachmentUrls.length ? { attachmentUrls } : {}) } }, {
      onSuccess: (request) => {
        queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() });
        navigate(`/requests/${request.id}`);
      },
      onError: () => setNotice('We couldn’t process this request. Check your connection and try again.'),
    });
  };
  const stages = ['Reading your request', 'Extracting details', 'Building a work plan'];
  return <div className="page-enter new-request-page">
    <PageTitle eyebrow="INTAKE / NATURAL LANGUAGE" title="What needs doing?" description="Describe the situation as you would to a colleague. AutoFlow will handle the routing." />
    <div className="form-layout">
      <form className="surface request-form" onSubmit={submit}>
        <div className="form-label-row"><label htmlFor="request-description">Tell us what’s going on</label><span className="required-label">REQUIRED</span></div>
        <p className="field-hint">Include the location, timing, and anything that might help us act quickly.</p>
        <div className="textarea-wrap"><textarea id="request-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="For example: The south conference room projector has been flickering since this morning. We have a client presentation at 2pm—could someone take a look before then?" maxLength={5000} minLength={10} required data-testid="input-request-description" /><div className="textarea-foot"><span><Sparkles size={13} /> Write naturally. We’ll structure the details.</span><span className="mono">{description.length}<span className="muted-count"> / 5000</span></span></div></div>
        <div className="attachment-heading"><div><label>Supporting links</label><span>Optional · add links to relevant files or context</span></div><button className="text-link" type="button" onClick={addUrl}><Plus size={14} /> Add a link</button></div>
        <div className="url-list">{urls.map((url, index) => <div className="url-input-row" key={index}><Link2 size={15} /><input type="url" value={url} onChange={(event) => updateUrl(index, event.target.value)} placeholder="https://drive.google.com/…" aria-label={`Attachment URL ${index + 1}`} data-testid={`input-attachment-${index}`} />{urls.length > 1 && <button type="button" onClick={() => removeUrl(index)} className="icon-button compact-icon" aria-label="Remove link"><X size={14} /></button>}</div>)}</div>
        {notice && <div className="inline-error" role="alert"><AlertTriangle size={15} />{notice}</div>}
        {create.isError && !notice && <div className="inline-error" role="alert"><AlertTriangle size={15} />Request submission failed. Please retry.</div>}
        <div className="form-actions"><span><ShieldAlert size={14} /> Submitted as <b>{user.fullName}</b> · {pretty(user.role)}</span><button className="button button-primary submit-button" type="submit" disabled={description.trim().length < 10 || create.isPending} data-testid="button-submit-request">{create.isPending ? <><LoaderCircle size={15} className="spin" /> Processing…</> : <>Send request <Send size={15} /></>}</button></div>
      </form>
      <aside className="processing-card">
        <div className="processing-top"><span className="processing-symbol"><Sparkles size={18} /></span><span className="processing-label">UNDER THE HOOD</span></div>
        <h2>From a sentence<br />to a plan.</h2>
        <p>We identify what’s needed, flag urgency, and route the right people into a shared workflow.</p>
        <div className="processing-steps">{stages.map((item, index) => <div key={item} className={`processing-step ${stage > index ? 'step-done' : stage === index + 1 ? 'step-current' : ''}`}><span className="step-number">{stage > index ? <Check size={12} /> : `0${index + 1}`}</span><span>{item}</span>{stage === index + 1 && <span className="step-pulse" />}</div>)}</div>
        <div className="processing-bottom"><span className="live-dot" /> Secure internal workflow</div>
      </aside>
    </div>
    <button className="back-link" type="button" onClick={() => navigate('/requests')}><ArrowDownRight size={14} /> Back to requests</button>
  </div>;
}

function RequestDetailPage({ user }: { user: User }) {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const headers = useMemo(() => ({ 'x-user-id': user.id, 'x-user-role': user.role }), [user.id, user.role]);
  const request = useGetRequest(id, { request: { headers }, query: { queryKey: [...getGetRequestQueryKey(id), user.id] } });
  const [, navigate] = useLocation();
  if (request.isLoading) return <div className="page-enter"><Skeleton rows={8} /></div>;
  if (request.isError || !request.data) return <div className="page-enter"><PageTitle eyebrow="REQUEST DETAIL" title="Request unavailable" description="This request may no longer be visible to the active user." /><ErrorState retry={() => request.refetch()} /></div>;
  const item = request.data;
  const entities = Object.entries(item.extractedEntities ?? {});
  return <div className="page-enter">
    <button className="back-link detail-back" onClick={() => navigate('/requests')}><ArrowDownRight size={14} /> Requests</button>
    <div className="detail-head"><div><div className="eyebrow">REQUEST / <span className="mono">AF-{item.id.slice(-5).toUpperCase()}</span></div><h1>{item.rawText}</h1><div className="detail-meta"><span>Submitted by {item.requesterName}</span><span className="meta-dot" />{when(item.createdAt)}<span className="meta-dot" /><span>{pretty(item.category)}</span></div></div><StatusPill status={item.status} /></div>
    <div className="detail-layout">
      <div className="detail-main">
        <section className="surface panel detail-section"><div className="panel-heading"><div><div className="section-kicker">ROUTING SUMMARY</div><h2>What AutoFlow understood</h2></div><Sparkles size={17} className="teal-icon" /></div><div className="summary-chips"><div><span>Category</span><b>{pretty(item.category)}</b></div><div><span>Priority</span><PriorityMark priority={item.priority} /></div><div><span>Risk level</span><span className={`risk-tag risk-${item.riskLevel.toLowerCase()}`}>{pretty(item.riskLevel)}</span></div></div>
          {entities.length > 0 && <div className="entity-list"><div className="section-kicker">EXTRACTED DETAILS</div><div className="entity-grid">{entities.map(([key, value]) => <div className="entity-cell" key={key}><span>{pretty(key)}</span><b>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</b></div>)}</div></div>}
          {item.attachmentUrls.length > 0 && <div className="attachments"><div className="section-kicker">ATTACHMENTS</div>{item.attachmentUrls.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}><Link2 size={14} />{url}<ArrowUpRight size={13} /></a>)}</div>}
        </section>
        <section className="surface panel detail-section"><div className="panel-heading"><div><div className="section-kicker">GENERATED WORKFLOW</div><h2>Tasks <span className="heading-count">{item.tasks.length}</span></h2></div><span className="completion-count">{item.completedTaskCount} / {item.taskCount} complete</span></div>
          {item.tasks.length ? <div className="task-flow">{item.tasks.slice().sort((a, b) => a.stepOrder - b.stepOrder).map((task, index) => <TaskCard key={task.id} task={task} index={index} user={user} detail />)}</div> : <EmptyState title="No tasks generated" text="The request has been recorded. There are no routed tasks to show." />}
        </section>
      </div>
      <aside className="detail-rail">
        <div className="surface panel activity-panel"><div className="panel-heading"><div><div className="section-kicker">AUDIT TRAIL</div><h2>Activity</h2></div><Activity size={16} /></div>
          {item.logs.length ? <div className="timeline">{item.logs.map((log) => <div className="timeline-item" key={log.id}><span className="timeline-dot" /><div><p>{log.action}</p><span>{log.actorName || 'AutoFlow'} · {when(log.createdAt)}</span></div></div>)}</div> : <div className="quiet-empty">No activity recorded yet.</div>}
        </div>
        <div className="surface panel request-facts"><div className="section-kicker">REQUEST RECORD</div><Fact label="Opened" value={when(item.createdAt)} /><Fact label="Resolved" value={item.resolvedAt ? when(item.resolvedAt) : 'Not resolved'} /><Fact label="Requester" value={item.requesterName} /><Fact label="Reference" value={`AF-${item.id.slice(-5).toUpperCase()}`} mono /></div>
      </aside>
    </div>
  </div>;
}
function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="fact-row"><span>{label}</span><b className={mono ? 'mono' : ''}>{value}</b></div>;
}

function TasksPage({ user }: { user: User }) {
  const [status, setStatus] = useState<TaskStatusFilter>('ALL');
  const params = useMemo(() => status === 'ALL' ? undefined : { status }, [status]);
  const headers = useMemo(() => ({ 'x-user-id': user.id, 'x-user-role': user.role }), [user.id, user.role]);
  const result = useListTasks(params, { request: { headers }, query: { queryKey: [...getListTasksQueryKey(params), user.id] } });
  const filters: TaskStatusFilter[] = ['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'ESCALATED'];
  const activeCount = result.data?.filter((task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS').length ?? 0;
  return <div className="page-enter">
    <PageTitle eyebrow="WORK ROUTING" title="Task inbox" description="The generated work behind every request. Move tasks forward as they happen." action={<button className="button button-secondary" onClick={() => result.refetch()}><RefreshCw size={14} /> Refresh inbox</button>} />
    <div className="task-inbox-banner"><div className="inbox-emblem"><CheckCircle2 size={19} /></div><div><span className="section-kicker">YOUR OPERATIONAL LANE</span><strong>{activeCount} active {activeCount === 1 ? 'task' : 'tasks'} visible</strong><span>Role routing is based on the selected demo user.</span></div><div className="inbox-user"><span className="avatar">{initials(user.fullName)}</span><span><b>{user.fullName}</b><small>{pretty(user.role)} · {user.department}</small></span></div></div>
    <div className="surface list-toolbar task-toolbar"><div className="filter-tabs task-filters">{filters.map((item) => <button key={item} onClick={() => setStatus(item)} className={`filter-tab ${status === item ? 'filter-active' : ''}`} data-testid={`filter-task-${item.toLowerCase()}`}>{item === 'ALL' ? 'All tasks' : pretty(item)}</button>)}</div><span className="queue-counter"><span className="live-dot" /> {result.data?.length ?? '—'} in view</span></div>
    <div className="task-board">{result.isLoading ? <div className="surface task-skeleton"><Skeleton rows={5} /></div> : result.isError ? <div className="surface task-skeleton"><ErrorState retry={() => result.refetch()} /></div> : result.data?.length ? result.data.map((task, index) => <TaskCard task={task} index={index} user={user} key={task.id} />) : <div className="surface"><EmptyState title="Inbox is clear" text="No tasks match this view for the selected user. When a request is submitted, AutoFlow will build and route the work here." action={<Link href="/requests/new" className="text-link">Submit a request <ArrowRight size={14} /></Link>} /></div>}</div>
    <div className="task-foot"><span><ShieldAlert size={13} /> Escalate when work is blocked or at risk.</span><span>Updates are visible in the request activity log.</span></div>
  </div>;
}
function TaskCard({ task, index, user, detail = false }: { task: Task; index: number; user: User; detail?: boolean }) {
  const queryClient = useQueryClient();
  const headers = useMemo(() => ({ 'x-user-id': user.id, 'x-user-role': user.role }), [user.id, user.role]);
  const mutation = useUpdateTaskStatus({ request: { headers } });
  const [error, setError] = useState('');
  const update = (status: 'IN_PROGRESS' | 'COMPLETED' | 'ESCALATED') => {
    setError('');
    mutation.mutate({ id: task.id, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(task.requestId) });
        queryClient.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() });
      },
      onError: () => setError('Could not update this task. Try again.'),
    });
  };
  const pending = task.status === 'PENDING';
  const inProgress = task.status === 'IN_PROGRESS';
  const done = task.status === 'COMPLETED';
  return <article className={`task-card surface ${detail ? 'task-card-detail' : ''}`} style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }} data-testid={`card-task-${task.id}`}>
    <div className="task-card-index"><span>{String(task.stepOrder).padStart(2, '0')}</span><i /></div>
    <div className="task-card-content"><div className="task-card-top"><div className="task-card-title">{task.title}</div><StatusPill status={task.status} /></div>
      {task.description && <p className="task-description">{task.description}</p>}
      <div className="task-card-meta"><span className="task-category">{pretty(task.category)}</span><PriorityMark priority={task.priority} /><span><UsersRound size={13} />{pretty(task.assignedRole)}</span><span><Layers3 size={13} />{task.assignedDepartment}</span><span className={new Date(task.slaDeadline).getTime() < Date.now() && !done ? 'sla-late' : ''}><Clock3 size={13} />Due {when(task.slaDeadline)}</span></div>
      {error && <div className="task-error" role="alert">{error}</div>}
    </div>
    <div className="task-card-actions">
      {pending && <button className="button button-primary button-small" disabled={mutation.isPending} onClick={() => update('IN_PROGRESS')} data-testid={`button-start-task-${task.id}`}>{mutation.isPending ? <LoaderCircle size={14} className="spin" /> : <ArrowRight size={14} />} Start task</button>}
      {inProgress && <><button className="button button-primary button-small" disabled={mutation.isPending} onClick={() => update('COMPLETED')} data-testid={`button-complete-task-${task.id}`}>{mutation.isPending ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Complete</button><button className="escalate-button" disabled={mutation.isPending} onClick={() => update('ESCALATED')} data-testid={`button-escalate-task-${task.id}`}>Escalate</button></>}
      {done && <span className="task-complete-mark"><CheckCircle2 size={15} /> Completed {task.completedAt ? shortDate(task.completedAt) : ''}</span>}
      {task.status === 'ESCALATED' && <span className="escalated-note"><AlertTriangle size={14} /> Escalated for review</span>}
      {!detail && <Link href={`/requests/${task.requestId}`} className="task-request-link">Request <ArrowUpRight size={13} /></Link>}
    </div>
  </article>;
}

function UserGate({ children }: { children: (user: User) => ReactNode }) {
  const usersQuery = useListUsers();
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem('autoflow-demo-user') ?? '');
  const [location] = useLocation();
  useEffect(() => {
    if (!usersQuery.data?.length) return;
    if (!usersQuery.data.some((user) => user.id === selectedId)) {
      const first = usersQuery.data[0];
      setSelectedId(first.id);
      localStorage.setItem('autoflow-demo-user', first.id);
    }
  }, [usersQuery.data, selectedId]);
  const selected = usersQuery.data?.find((user) => user.id === selectedId) ?? usersQuery.data?.[0] ?? null;
  const changeUser = (id: string) => {
    setSelectedId(id);
    localStorage.setItem('autoflow-demo-user', id);
    queryClient.invalidateQueries();
  };
  if (usersQuery.isLoading) return <div className="boot-screen"><div className="boot-mark"><span /><span /><span /></div><div className="boot-title">Opening operations desk</div><div className="boot-caption">Connecting to the internal workspace</div><div className="boot-loader"><i /></div></div>;
  if (usersQuery.isError || !selected) return <div className="boot-screen"><div className="empty-icon"><AlertTriangle size={20} /></div><div className="boot-title">Workspace unavailable</div><div className="boot-caption">We couldn’t load the demo user directory.</div><button className="button button-secondary" onClick={() => usersQuery.refetch()}><RefreshCw size={14} /> Retry connection</button></div>;
  return <AppShell user={selected} users={usersQuery.data ?? []} onUserChange={changeUser}>
    <ErrorBoundary resetKey={location}>{children(selected)}</ErrorBoundary>
  </AppShell>;
}
function RoutedPage({ page }: { page: 'dashboard' | 'requests' | 'new' | 'detail' | 'tasks' }) {
  return <UserGate>{(user) => {
    if (page === 'dashboard') return <Dashboard user={user} />;
    if (page === 'requests') return <RequestsPage user={user} />;
    if (page === 'new') return <NewRequestPage user={user} />;
    if (page === 'detail') return <RequestDetailPage user={user} />;
    return <TasksPage user={user} />;
  }}</UserGate>;
}
function NotFound() {
  return <UserGate>{() => <div className="page-enter not-found"><div className="eyebrow">404 / NOT IN THE WORKFLOW</div><h1>Nothing on this route.</h1><p>Head back to the operations overview to pick up where you left off.</p><Link href="/" className="button button-primary">Back to overview <ArrowRight size={15} /></Link></div>}</UserGate>;
}
function Router() {
  return <Switch>
    <Route path="/"><RoutedPage page="dashboard" /></Route>
    <Route path="/requests/new"><RoutedPage page="new" /></Route>
    <Route path="/requests"><RoutedPage page="requests" /></Route>
    <Route path="/requests/:id"><RoutedPage page="detail" /></Route>
    <Route path="/tasks"><RoutedPage page="tasks" /></Route>
    <Route component={NotFound} />
  </Switch>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /><Notice /></TooltipProvider></QueryClientProvider>;
}
export default App;
