import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { readTable, writeTable } from "./storage.js";

const FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');";

const COLORS = {
  bg: "#EEF2ED",
  paper: "#FFFFFF",
  ink: "#1E2A22",
  inkSoft: "#5C6B62",
  inkFaint: "#8A968E",
  line: "#DCE3DE",
  accent: "#2F6F63",
  accentSoft: "#DCEDE7",
  amber: "#C97B2E",
  amberSoft: "#F6E7D6",
  red: "#B3402E",
  redSoft: "#F6DCD6",
};

const FONT_DISPLAY = "'Zilla Slab', serif";
const FONT_UI = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

const PROJECT_COLORS = [
  "#8dd3c7",
  "#ffffb3",
  "#bebada",
  "#fb8072",
  "#80b1d3",
  "#fdb462",
  "#b3de69",
  "#fccde5",
  "#d9d9d9",
  "#bc80bd",
];
const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0];

const TABLES = {
  clients: "clients",
  projects: "projects",
  tasks: "tasks",
  entries: "time-entries",
  shownRows: "timesheet-shown-rows",
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function fmtISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function getCurrentMonthRange(refDate = new Date()) {
  const from = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const to = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
  return { from: fmtISO(from), to: fmtISO(to) };
}

export function getPreviousMonthRange(refDate = new Date()) {
  return getCurrentMonthRange(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1));
}

async function safeRead(key) {
  try {
    return await readTable(key);
  } catch (e) {
    return [];
  }
}

async function safeWrite(key, value) {
  try {
    await writeTable(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: COLORS.inkSoft, fontFamily: FONT_UI }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  fontFamily: FONT_UI,
  fontSize: 14,
  color: COLORS.ink,
  background: COLORS.paper,
  border: `1px solid ${COLORS.line}`,
  borderRadius: 6,
  padding: "8px 10px",
  outline: "none",
};

const disabledInputStyle = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const buttonStyle = {
  fontFamily: FONT_UI,
  fontSize: 14,
  fontWeight: 600,
  color: "#fff",
  background: COLORS.accent,
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  cursor: "pointer",
};

export function fmtUSD(n) {
  return `$${round2(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function downloadCSV(filename, header, rows) {
  const lines = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Turns a #rrggbb project color into a visible background tint. The palette
// colors are already pastel, so a higher alpha than a saturated color would
// need still stays soft rather than garish.
export function projectTint(color) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(color || "") ? color : DEFAULT_PROJECT_COLOR;
  return `${hex}66`; // ~40% alpha
}

function BudgetBar({ logged, budget }) {
  if (!budget || budget <= 0) {
    return <span style={{ fontSize: 12, color: COLORS.inkFaint, fontFamily: FONT_UI }}>No budget set</span>;
  }
  const pct = Math.min(100, (logged / budget) * 100);
  let color = COLORS.accent;
  if (logged / budget > 1) color = COLORS.red;
  else if (logged / budget >= 0.9) color = COLORS.amber;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
      <div style={{ height: 6, background: COLORS.line, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: COLORS.inkSoft }}>
        {fmtUSD(logged)} / {fmtUSD(budget)}
      </span>
    </div>
  );
}

function ColorSwatchPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          title={c}
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: c,
            cursor: "pointer",
            padding: 0,
            border: value === c ? `2px solid ${COLORS.ink}` : `1px solid ${COLORS.line}`,
            boxShadow: value === c ? `0 0 0 2px ${COLORS.paper}` : "none",
          }}
        />
      ))}
    </div>
  );
}

function Tabs({ tab, setTab }) {
  const tabs = [
    { id: "clients", label: "Clients" },
    { id: "projects", label: "Projects" },
    { id: "tasks", label: "Tasks" },
    { id: "reports", label: "Report" },
  ];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            fontFamily: FONT_UI,
            fontSize: 14,
            fontWeight: 600,
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            background: tab === t.id ? COLORS.accentSoft : "transparent",
            color: tab === t.id ? COLORS.accent : COLORS.inkSoft,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function HeaderLink({ active, onClick, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 26,
        color: active ? COLORS.accent : COLORS.ink,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textDecoration: !active && hovered ? "underline" : "none",
        textUnderlineOffset: 4,
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        color: COLORS.inkFaint,
        fontFamily: FONT_UI,
        fontSize: 14,
        border: `1px dashed ${COLORS.line}`,
        borderRadius: 10,
      }}
    >
      {text}
    </div>
  );
}

export default function TallyApp() {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [shownRows, setShownRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("timesheet");
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));

  useEffect(() => {
    (async () => {
      const [c, p, tRaw, eRaw, shownRaw] = await Promise.all([
        safeRead(TABLES.clients),
        safeRead(TABLES.projects),
        safeRead(TABLES.tasks),
        safeRead(TABLES.entries),
        safeRead(TABLES.shownRows),
      ]);

      // Migrate legacy data: tasks used to have a single `projectId`; entries had
      // no `projectId` at all (it was implied by the task). Convert both to the
      // new many-to-many shape.
      const rawTasks = tRaw || [];
      const legacyTaskProject = {};
      let tasksChanged = false;
      const migratedTasks = rawTasks.map((task) => {
        if (Array.isArray(task.projectIds)) return task;
        tasksChanged = true;
        legacyTaskProject[task.id] = task.projectId;
        const { projectId, ...rest } = task;
        return { ...rest, projectIds: projectId ? [projectId] : [] };
      });

      const rawEntries = eRaw || [];
      let entriesChanged = false;
      const migratedEntries = rawEntries
        .map((entry) => {
          if (entry.projectId) return entry;
          entriesChanged = true;
          return { ...entry, projectId: legacyTaskProject[entry.taskId] };
        })
        .filter((entry) => entry.projectId);

      setClients(c || []);
      setProjects(p || []);
      setTasks(migratedTasks);
      setEntries(migratedEntries);
      setShownRows(shownRaw || []);
      setLoaded(true);

      if (tasksChanged) safeWrite(TABLES.tasks, migratedTasks);
      if (entriesChanged) safeWrite(TABLES.entries, migratedEntries);
    })();
  }, []);

  const persist = useCallback(async (name, value) => {
    const ok = await safeWrite(name, value);
    if (!ok) setError("Could not save your changes. Please try again.");
  }, []);

  const addToTimesheet = (taskId, projectId, weekKey) => {
    if (shownRows.some((r) => r.weekKey === weekKey && r.taskId === taskId && r.projectId === projectId)) return;
    const next = [...shownRows, { id: uid(), weekKey, taskId, projectId }];
    setShownRows(next);
    persist(TABLES.shownRows, next);
  };

  const hideForWeek = (taskId, projectId, weekKey) => {
    const next = shownRows.filter(
      (r) => !(r.weekKey === weekKey && r.taskId === taskId && r.projectId === projectId)
    );
    setShownRows(next);
    persist(TABLES.shownRows, next);
  };

  const addMultipleToTimesheet = (pairs, weekKey) => {
    const existing = new Set(
      shownRows.filter((r) => r.weekKey === weekKey).map((r) => `${r.taskId}|${r.projectId}`)
    );
    const toAdd = pairs.filter((p) => !existing.has(`${p.taskId}|${p.projectId}`));
    if (toAdd.length === 0) return;
    const next = [...shownRows, ...toAdd.map((p) => ({ id: uid(), weekKey, taskId: p.taskId, projectId: p.projectId }))];
    setShownRows(next);
    persist(TABLES.shownRows, next);
  };

  const addClient = (name) => {
    const next = [...clients, { id: uid(), name }];
    setClients(next);
    persist(TABLES.clients, next);
  };

  const updateClient = (id, name) => {
    const next = clients.map((c) => (c.id === id ? { ...c, name } : c));
    setClients(next);
    persist(TABLES.clients, next);
  };

  const setClientArchived = (id, archived) => {
    const next = clients.map((c) => (c.id === id ? { ...c, archived } : c));
    setClients(next);
    persist(TABLES.clients, next);
  };

  const deleteClient = (id) => {
    const removedProjectIds = projects.filter((p) => p.clientId === id).map((p) => p.id);
    if (entries.some((e) => removedProjectIds.includes(e.projectId) && e.invoiced)) {
      setError("Can't delete this client — one of its projects has invoiced time entries. Unmark them as invoiced first if you need to remove it.");
      return;
    }
    const nextClients = clients.filter((c) => c.id !== id);
    const nextProjects = projects.filter((p) => p.clientId !== id);
    const nextTasks = tasks.map((t) => ({
      ...t,
      projectIds: (t.projectIds || []).filter((pid) => !removedProjectIds.includes(pid)),
    }));
    const nextEntries = entries.filter((e) => !removedProjectIds.includes(e.projectId));
    const nextShownRows = shownRows.filter((r) => !removedProjectIds.includes(r.projectId));
    setClients(nextClients);
    setProjects(nextProjects);
    setTasks(nextTasks);
    setEntries(nextEntries);
    setShownRows(nextShownRows);
    persist(TABLES.clients, nextClients);
    persist(TABLES.projects, nextProjects);
    persist(TABLES.tasks, nextTasks);
    persist(TABLES.entries, nextEntries);
    persist(TABLES.shownRows, nextShownRows);
  };

  const addProject = (name, clientId, budgetAmount, hourlyRate, color) => {
    const next = [...projects, { id: uid(), name, clientId, budgetAmount: budgetAmount || 0, hourlyRate: hourlyRate || 0, color: color || DEFAULT_PROJECT_COLOR }];
    setProjects(next);
    persist(TABLES.projects, next);
  };

  const updateProject = (id, { name, clientId, budgetAmount, hourlyRate, color }) => {
    const next = projects.map((p) =>
      p.id === id
        ? { ...p, name, clientId, budgetAmount: budgetAmount || 0, hourlyRate: hourlyRate || 0, color: color || DEFAULT_PROJECT_COLOR }
        : p
    );
    setProjects(next);
    persist(TABLES.projects, next);
  };

  const setProjectArchived = (id, archived) => {
    const next = projects.map((p) => (p.id === id ? { ...p, archived } : p));
    setProjects(next);
    persist(TABLES.projects, next);
  };

  const deleteProject = (id) => {
    if (entries.some((e) => e.projectId === id && e.invoiced)) {
      setError("Can't delete this project — it has invoiced time entries. Unmark them as invoiced first if you need to remove it.");
      return;
    }
    const nextProjects = projects.filter((p) => p.id !== id);
    const nextTasks = tasks.map((t) => ({ ...t, projectIds: (t.projectIds || []).filter((pid) => pid !== id) }));
    const nextEntries = entries.filter((e) => e.projectId !== id);
    const nextShownRows = shownRows.filter((r) => r.projectId !== id);
    setProjects(nextProjects);
    setTasks(nextTasks);
    setEntries(nextEntries);
    setShownRows(nextShownRows);
    persist(TABLES.projects, nextProjects);
    persist(TABLES.tasks, nextTasks);
    persist(TABLES.entries, nextEntries);
    persist(TABLES.shownRows, nextShownRows);
  };

  const addTask = (name, projectIds) => {
    const next = [...tasks, { id: uid(), name, projectIds }];
    setTasks(next);
    persist(TABLES.tasks, next);
  };

  const updateTask = (id, { name, projectIds }) => {
    const next = tasks.map((t) => (t.id === id ? { ...t, name, projectIds } : t));
    setTasks(next);
    persist(TABLES.tasks, next);
  };

  const setTaskArchived = (id, archived) => {
    const next = tasks.map((t) => (t.id === id ? { ...t, archived } : t));
    setTasks(next);
    persist(TABLES.tasks, next);
  };

  const deleteTask = (id) => {
    if (entries.some((e) => e.taskId === id && e.invoiced)) {
      setError("Can't delete this task — it has invoiced time entries. Unmark them as invoiced first if you need to remove it.");
      return;
    }
    const nextTasks = tasks.filter((t) => t.id !== id);
    const nextEntries = entries.filter((e) => e.taskId !== id);
    const nextShownRows = shownRows.filter((r) => r.taskId !== id);
    setTasks(nextTasks);
    setEntries(nextEntries);
    setShownRows(nextShownRows);
    persist(TABLES.tasks, nextTasks);
    persist(TABLES.entries, nextEntries);
    persist(TABLES.shownRows, nextShownRows);
  };

  const setHours = (taskId, projectId, date, rawValue) => {
    const idx = entries.findIndex((e) => e.taskId === taskId && e.projectId === projectId && e.date === date);
    if (idx >= 0 && entries[idx].invoiced) return; // locked, edit via the timesheet is blocked
    let next = [...entries];
    if (rawValue === "") {
      if (idx >= 0) next.splice(idx, 1);
    } else {
      const hours = Math.max(0, Number(rawValue));
      if (idx >= 0) next[idx] = { ...next[idx], hours };
      else next.push({ id: uid(), taskId, projectId, date, hours });
    }
    setEntries(next);
    persist(TABLES.entries, next);
  };

  const setEntriesInvoiced = (entryIds, invoiced) => {
    const idSet = new Set(entryIds);
    const next = entries.map((e) => (idSet.has(e.id) ? { ...e, invoiced } : e));
    setEntries(next);
    persist(TABLES.entries, next);
  };


  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const projectsByClient = useMemo(() => {
    const m = {};
    for (const p of projects) (m[p.clientId] = m[p.clientId] || []).push(p);
    return m;
  }, [projects]);
  const tasksByProject = useMemo(() => {
    const m = {};
    for (const t of tasks) {
      for (const pid of t.projectIds || []) (m[pid] = m[pid] || []).push(t);
    }
    return m;
  }, [tasks]);
  const hoursByProjectId = useMemo(() => {
    const m = {};
    for (const e of entries) m[e.projectId] = (m[e.projectId] || 0) + Number(e.hours || 0);
    return m;
  }, [entries]);
  const entryLookup = useMemo(() => {
    const m = {};
    for (const e of entries) m[`${e.taskId}|${e.projectId}|${e.date}`] = e.hours;
    return m;
  }, [entries]);
  const invoicedLookup = useMemo(() => {
    const m = {};
    for (const e of entries) if (e.invoiced) m[`${e.taskId}|${e.projectId}|${e.date}`] = true;
    return m;
  }, [entries]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekKey = fmtISO(weekDates[0]);
  const weekLabel = `${weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  )}`;

  const copyPreviousWeekTasks = () => {
    const prevWeekStart = addDays(weekStart, -7);
    const prevDates = new Set(Array.from({ length: 7 }, (_, i) => fmtISO(addDays(prevWeekStart, i))));
    const taskByIdMap = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const projectByIdMap = Object.fromEntries(projects.map((p) => [p.id, p]));
    const seen = new Set();
    const pairs = [];
    for (const e of entries) {
      if (!prevDates.has(e.date) || !(Number(e.hours) > 0)) continue;
      const key = `${e.taskId}|${e.projectId}`;
      if (seen.has(key)) continue;
      const task = taskByIdMap[e.taskId];
      const project = projectByIdMap[e.projectId];
      if (!task || task.archived || !project || project.archived) continue;
      seen.add(key);
      pairs.push({ taskId: e.taskId, projectId: e.projectId });
    }
    addMultipleToTimesheet(pairs, weekKey);
  };

  const shownThisWeek = useMemo(
    () => new Set(shownRows.filter((r) => r.weekKey === weekKey).map((r) => `${r.taskId}|${r.projectId}`)),
    [shownRows, weekKey]
  );

  const dayTotal = (date) =>
    round2(entries.filter((e) => e.date === date).reduce((sum, e) => sum + Number(e.hours || 0), 0));
  const taskProjectWeekTotal = (taskId, projectId) =>
    round2(weekDates.reduce((sum, d) => sum + (entryLookup[`${taskId}|${projectId}|${fmtISO(d)}`] || 0), 0));
  const grandTotal = round2(weekDates.reduce((sum, d) => sum + dayTotal(fmtISO(d)), 0));

  if (!loaded) {
    return (
      <div style={{ fontFamily: FONT_UI, color: COLORS.inkSoft, padding: 40, textAlign: "center" }}>
        Loading your workspace…
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", padding: 28, fontFamily: FONT_UI }}>
      <style>{FONTS_IMPORT}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <HeaderLink active={tab === "timesheet"} onClick={() => setTab("timesheet")}>
            Timesheet
          </HeaderLink>
        </div>
        <Tabs tab={tab} setTab={setTab} />
      </div>

      {error && (
        <div
          style={{
            background: COLORS.redSoft,
            color: COLORS.red,
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {tab === "timesheet" && (
        <TimesheetTab
          projects={projects}
          clients={clientById}
          tasksByProject={tasksByProject}
          shownThisWeek={shownThisWeek}
          onAddToTimesheet={(taskId, projectId) => addToTimesheet(taskId, projectId, weekKey)}
          onHideForWeek={(taskId, projectId) => hideForWeek(taskId, projectId, weekKey)}
          onCopyPreviousWeek={copyPreviousWeekTasks}
          weekDates={weekDates}
          weekLabel={weekLabel}
          entryLookup={entryLookup}
          invoicedLookup={invoicedLookup}
          setHours={setHours}
          dayTotal={dayTotal}
          taskProjectWeekTotal={taskProjectWeekTotal}
          grandTotal={grandTotal}
          onPrevWeek={() => setWeekStart(addDays(weekStart, -7))}
          onNextWeek={() => setWeekStart(addDays(weekStart, 7))}
          onThisWeek={() => setWeekStart(getMonday(new Date()))}
        />
      )}

      {tab === "reports" && (
        <ReportsTab
          entries={entries}
          tasks={tasks}
          projects={projects}
          clients={clients}
          clientById={clientById}
          onSetInvoiced={setEntriesInvoiced}
        />
      )}

      {tab === "clients" && (
        <ClientsTab
          clients={clients}
          projectsByClient={projectsByClient}
          onAdd={addClient}
          onUpdate={updateClient}
          onSetArchived={setClientArchived}
          onDelete={deleteClient}
        />
      )}

      {tab === "projects" && (
        <ProjectsTab
          projects={projects}
          clients={clients}
          clientById={clientById}
          tasksByProject={tasksByProject}
          hoursByProjectId={hoursByProjectId}
          onAdd={addProject}
          onUpdate={updateProject}
          onSetArchived={setProjectArchived}
          onDelete={deleteProject}
        />
      )}

      {tab === "tasks" && (
        <TasksTab
          tasks={tasks}
          projects={projects}
          onAdd={addTask}
          onUpdate={updateTask}
          onSetArchived={setTaskArchived}
          onDelete={deleteTask}
        />
      )}
    </div>
  );
}

function TimesheetTab({
  projects,
  clients,
  tasksByProject,
  shownThisWeek,
  onAddToTimesheet,
  onHideForWeek,
  onCopyPreviousWeek,
  weekDates,
  weekLabel,
  entryLookup,
  invoicedLookup,
  setHours,
  dayTotal,
  taskProjectWeekTotal,
  grandTotal,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
}) {
  const [showAddPanel, setShowAddPanel] = useState(false);

  const hasEntryThisWeek = (taskId, projectId) =>
    weekDates.some((d) => entryLookup[`${taskId}|${projectId}|${fmtISO(d)}`] !== undefined);

  const isVisibleThisWeek = (taskId, projectId) =>
    shownThisWeek.has(`${taskId}|${projectId}`) || hasEntryThisWeek(taskId, projectId);

  const allActivePairs = useMemo(() => {
    const pairs = [];
    for (const p of projects) {
      if (p.archived) continue;
      for (const t of tasksByProject[p.id] || []) {
        if (t.archived) continue;
        pairs.push({ task: t, project: p });
      }
    }
    return pairs;
  }, [projects, tasksByProject]);

  const availablePairs = allActivePairs.filter(
    ({ task, project }) => !isVisibleThisWeek(task.id, project.id)
  );

  const projectsWithTasks = projects
    .filter((p) => !p.archived)
    .map((p) => ({
      project: p,
      activeTasks: (tasksByProject[p.id] || []).filter((t) => !t.archived && isVisibleThisWeek(t.id, p.id)),
    }))
    .filter(({ activeTasks }) => activeTasks.length > 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onPrevWeek} style={{ ...buttonStyle, background: COLORS.paper, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}>
          ← Prev
        </button>
        <button onClick={onThisWeek} style={{ ...buttonStyle, background: COLORS.paper, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}>
          This week
        </button>
        <button onClick={onNextWeek} style={{ ...buttonStyle, background: COLORS.paper, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}>
          Next →
        </button>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: COLORS.ink, marginLeft: 8 }}>
          {weekLabel}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: FONT_MONO, fontSize: 14, color: COLORS.accent }}>
          {grandTotal}h this week
        </span>
      </div>

      {projectsWithTasks.length === 0 ? (
        <EmptyState text="Your timesheet is empty. Click “+ Add task” to start logging time." />
      ) : (
        <div style={{ background: COLORS.paper, borderRadius: 10, border: `1px solid ${COLORS.line}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                <th style={{ ...thStyle, textAlign: "left", minWidth: 220 }}>Task</th>
                {weekDates.map((d) => (
                  <th key={fmtISO(d)} style={{ ...thStyle, width: 72 }}>
                    <div>{WEEKDAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}</div>
                    <div style={{ fontFamily: FONT_MONO, fontWeight: 400, color: COLORS.inkFaint }}>
                      {d.getDate()}
                    </div>
                  </th>
                ))}
                <th style={{ ...thStyle, width: 88 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {projectsWithTasks.map(({ project: p, activeTasks }) => (
                <Fragment key={p.id}>
                  <tr style={{ background: projectTint(p.color) }}>
                    <td colSpan={9} style={{ padding: "8px 16px", fontFamily: FONT_UI, fontWeight: 600, fontSize: 13, color: COLORS.ink }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          background: p.color || DEFAULT_PROJECT_COLOR,
                          marginRight: 8,
                          verticalAlign: "middle",
                        }}
                      />
                      {p.name} <span style={{ color: COLORS.inkSoft, fontWeight: 400 }}>· {clients[p.clientId]?.name || "No client"}</span>
                    </td>
                  </tr>
                  {activeTasks.map((t) => (
                    <tr key={`${t.id}-${p.id}`} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                      <td style={{ padding: "8px 16px", fontSize: 14, color: COLORS.ink }}>{t.name}</td>
                      {weekDates.map((d) => {
                        const iso = fmtISO(d);
                        const val = entryLookup[`${t.id}|${p.id}|${iso}`];
                        const locked = !!invoicedLookup[`${t.id}|${p.id}|${iso}`];
                        return (
                          <td key={iso} style={{ padding: 4, textAlign: "center" }}>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={val === undefined ? "" : val}
                              onChange={(ev) => setHours(t.id, p.id, iso, ev.target.value)}
                              disabled={locked}
                              title={locked ? "Invoiced — locked" : undefined}
                              style={{
                                width: 52,
                                textAlign: "center",
                                fontFamily: FONT_MONO,
                                fontSize: 13,
                                border: `1px solid ${COLORS.line}`,
                                borderRadius: 4,
                                padding: "6px 2px",
                                color: locked ? COLORS.inkFaint : COLORS.ink,
                                background: locked ? COLORS.bg : COLORS.paper,
                                cursor: locked ? "not-allowed" : "text",
                              }}
                            />
                          </td>
                        );
                      })}
                      <td style={{ padding: "0 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: COLORS.inkSoft }}>
                            {taskProjectWeekTotal(t.id, p.id)}
                          </span>
                          {taskProjectWeekTotal(t.id, p.id) === 0 && (
                            <button
                              onClick={() => onHideForWeek(t.id, p.id)}
                              title="Remove from timesheet"
                              style={{ ...dangerLinkButtonStyle, fontSize: 14, lineHeight: 1 }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr>
                <td style={{ padding: "10px 16px", fontFamily: FONT_UI, fontWeight: 600, fontSize: 13, color: COLORS.ink }}>
                  Daily total
                </td>
                {weekDates.map((d) => (
                  <td key={fmtISO(d)} style={{ textAlign: "center", fontFamily: FONT_MONO, fontWeight: 600, fontSize: 13, color: COLORS.ink }}>
                    {dayTotal(fmtISO(d))}
                  </td>
                ))}
                <td style={{ textAlign: "center", fontFamily: FONT_MONO, fontWeight: 600, fontSize: 13, color: COLORS.accent }}>
                  {grandTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={() => setShowAddPanel((s) => !s)} style={buttonStyle}>
          {showAddPanel ? "Close" : "+ Add task"}
        </button>
        <button
          onClick={onCopyPreviousWeek}
          style={{ ...buttonStyle, background: COLORS.paper, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}
        >
          Copy from last week
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        {showAddPanel && (
          <div
            style={{
              marginTop: 12,
              background: COLORS.paper,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 10,
              padding: 16,
            }}
          >
            {allActivePairs.length === 0 ? (
              <span style={{ fontSize: 13, color: COLORS.inkFaint, fontFamily: FONT_UI }}>
                No tasks available. Add a client, project, and task from the tabs above first.
              </span>
            ) : availablePairs.length === 0 ? (
              <span style={{ fontSize: 13, color: COLORS.inkFaint, fontFamily: FONT_UI }}>
                All available tasks are already on your timesheet.
              </span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {availablePairs.map(({ task, project }) => (
                  <div
                    key={`${task.id}-${project.id}`}
                    onClick={() => onAddToTimesheet(task.id, project.id)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 4px",
                      borderBottom: `1px solid ${COLORS.line}`,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 13, fontFamily: FONT_UI, color: COLORS.ink }}>
                      {task.name} <span style={{ color: COLORS.inkFaint }}>· {project.name}</span>
                    </span>
                    <span style={{ ...linkButtonStyle, pointerEvents: "none" }}>Add</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: "10px 8px",
  fontFamily: FONT_UI,
  fontWeight: 600,
  fontSize: 12,
  color: COLORS.inkSoft,
  textAlign: "center",
};

function ReportsTab({ entries, tasks, projects, clients, clientById, onSetInvoiced }) {
  const [range, setRange] = useState(() => getPreviousMonthRange());
  const [filterClientId, setFilterClientId] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterTaskId, setFilterTaskId] = useState("");
  const [earliestDateMode, setEarliestDateMode] = useState(false);

  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const taskById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  const projectFilterOptions = filterClientId
    ? projects.filter((p) => p.clientId === filterClientId)
    : projects;

  const taskFilterOptions = tasks.filter((t) => {
    if (filterProjectId) return (t.projectIds || []).includes(filterProjectId);
    if (filterClientId) return (t.projectIds || []).some((pid) => projectById[pid]?.clientId === filterClientId);
    return true;
  });

  const handleClientFilterChange = (value) => {
    setFilterClientId(value);
    // Drop the project filter if it no longer belongs to the newly selected client.
    if (value && filterProjectId) {
      const project = projectById[filterProjectId];
      if (!project || project.clientId !== value) setFilterProjectId("");
    }
    // Drop the task filter if it no longer belongs to the newly selected client.
    if (value && filterTaskId) {
      const task = taskById[filterTaskId];
      const stillValid = task && (task.projectIds || []).some((pid) => projectById[pid]?.clientId === value);
      if (!stillValid) setFilterTaskId("");
    }
  };

  const handleProjectFilterChange = (value) => {
    setFilterProjectId(value);
    // Drop the task filter if it no longer belongs to the newly selected project.
    if (value && filterTaskId) {
      const task = taskById[filterTaskId];
      if (!task || !(task.projectIds || []).includes(value)) setFilterTaskId("");
    }
  };

  // Matches the client/project/task filters (but not the date range) - used to
  // find the oldest outstanding entry for the "Earliest date" toggle.
  const matchesClientProjectTask = (e) => {
    if (filterTaskId && e.taskId !== filterTaskId) return false;
    if (filterProjectId && e.projectId !== filterProjectId) return false;
    if (filterClientId) {
      const project = projectById[e.projectId];
      if (!project || project.clientId !== filterClientId) return false;
    }
    return true;
  };

  const earliestUninvoicedDate = useMemo(() => {
    let earliest = null;
    for (const e of entries) {
      if (e.invoiced) continue;
      if (!matchesClientProjectTask(e)) continue;
      if (earliest === null || e.date < earliest) earliest = e.date;
    }
    return earliest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, filterClientId, filterProjectId, filterTaskId, projectById]);

  const effectiveFrom = earliestDateMode ? earliestUninvoicedDate : range.from;

  const entriesInRange = useMemo(() => {
    return entries.filter((e) => {
      if (effectiveFrom === null || e.date < effectiveFrom || e.date > range.to) return false;
      return matchesClientProjectTask(e);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, effectiveFrom, range.to, filterClientId, filterProjectId, filterTaskId, projectById]);

  const byTaskProject = useMemo(() => {
    const m = {};
    for (const e of entriesInRange) {
      const key = `${e.taskId}|${e.projectId}`;
      if (!m[key]) m[key] = { hours: 0, invoicedHours: 0, entryIds: [] };
      m[key].hours += Number(e.hours || 0);
      if (e.invoiced) m[key].invoicedHours += Number(e.hours || 0);
      m[key].entryIds.push(e.id);
    }
    return m;
  }, [entriesInRange]);

  const rows = Object.entries(byTaskProject)
    .map(([key, data]) => {
      const [taskId, projectId] = key.split("|");
      const task = taskById[taskId];
      const project = projectById[projectId];
      const client = project ? clientById[project.clientId] : null;
      const roundedHours = round2(data.hours);
      const invoiceStatus =
        data.invoicedHours <= 0 ? "none" : data.invoicedHours >= data.hours ? "full" : "partial";
      return {
        key,
        entryIds: data.entryIds,
        clientName: client?.name || "No client",
        projectName: project?.name || "Unknown project",
        taskName: task?.name || "Unknown task",
        hours: roundedHours,
        amount: round2(roundedHours * (project?.hourlyRate || 0)),
        invoiceStatus,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const total = round2(rows.reduce((sum, r) => sum + r.hours, 0));
  const totalAmount = round2(rows.reduce((sum, r) => sum + r.amount, 0));

  const allEntryIds = entriesInRange.map((e) => e.id);
  const anyUninvoiced = entriesInRange.some((e) => !e.invoiced);
  const anyInvoiced = entriesInRange.some((e) => e.invoiced);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <Field label="From">
            <input
              type="date"
              style={{ ...inputStyle, ...(earliestDateMode ? disabledInputStyle : null) }}
              value={effectiveFrom || ""}
              disabled={earliestDateMode}
              title={
                earliestDateMode && !earliestUninvoicedDate
                  ? "No uninvoiced hours match the filters below"
                  : undefined
              }
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </Field>
          <label
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: FONT_UI,
              fontSize: 12,
              color: COLORS.inkFaint,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="Set the From date to the oldest uninvoiced entry matching the filters below"
          >
            <input
              type="checkbox"
              checked={earliestDateMode}
              onChange={(e) => setEarliestDateMode(e.target.checked)}
            />
            Earliest date
          </label>
        </div>
        <Field label="To">
          <input
            type="date"
            style={inputStyle}
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </Field>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <Field label="Client">
          <select style={inputStyle} value={filterClientId} onChange={(e) => handleClientFilterChange(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Project">
          <select style={inputStyle} value={filterProjectId} onChange={(e) => handleProjectFilterChange(e.target.value)}>
            <option value="">All projects</option>
            {projectFilterOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Task">
          <select style={inputStyle} value={filterTaskId} onChange={(e) => setFilterTaskId(e.target.value)}>
            <option value="">All tasks</option>
            {taskFilterOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
        {(filterClientId || filterProjectId || filterTaskId || earliestDateMode) && (
          <button
            onClick={() => {
              setFilterClientId("");
              setFilterProjectId("");
              setFilterTaskId("");
              setEarliestDateMode(false);
            }}
            style={linkButtonStyle}
          >
            Clear filters
          </button>
        )}
      </div>

      <div
        style={{
          background: COLORS.accentSoft,
          borderRadius: 10,
          padding: "20px 24px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, color: COLORS.accent }}>
            {total}h/{fmtUSD(totalAmount)}
          </span>
          <span style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.inkSoft }}>
            tracked from {effectiveFrom || "?"} to {range.to}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={() =>
                downloadCSV(
                  `tally-report-${effectiveFrom || "none"}-to-${range.to}.csv`,
                  ["folder", "task", "date", "duration_decimal", "hourly_rate"],
                  entriesInRange.map((e) => {
                    const task = taskById[e.taskId];
                    const project = projectById[e.projectId];
                    const client = project ? clientById[project.clientId] : null;
                    const projectName = project?.name || "Unknown project";
                    const taskName = task?.name || "Unknown task";
                    return [
                      client?.name || "No client",
                      `${projectName} - ${taskName}`,
                      e.date,
                      round2(e.hours),
                      project?.hourlyRate || "",
                    ];
                  })
                )
              }
              title="Exports the time entries matching the filters above"
              style={{ ...buttonStyle, background: COLORS.paper, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}
            >
              Export CSV
            </button>
            {anyUninvoiced && (
              <ConfirmButton
                label="Mark as Invoiced"
                title="Marks the time entries matching the filters above"
                onConfirm={() => onSetInvoiced(allEntryIds, true)}
                style={buttonStyle}
              />
            )}
            {anyInvoiced && (
              <ConfirmButton
                label="Unmark as Invoiced"
                title="Unmarks the time entries matching the filters above"
                onConfirm={() => onSetInvoiced(allEntryIds, false)}
                style={{ ...buttonStyle, background: COLORS.paper, color: COLORS.red, border: `1px solid ${COLORS.line}` }}
              />
            )}
          </div>
          <span style={{ fontFamily: FONT_UI, fontSize: 11, color: COLORS.inkFaint }}>
            Applies to the {entriesInRange.length} entries matching the filters above
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState text="No time entries match this filter." />
      ) : (
        <div style={{ background: COLORS.paper, borderRadius: 10, border: `1px solid ${COLORS.line}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                <th style={{ ...thStyle, textAlign: "left" }}>Client</th>
                <th style={{ ...thStyle, textAlign: "left" }}>Project</th>
                <th style={{ ...thStyle, textAlign: "left" }}>Task</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Hours</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Invoiced</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <td style={{ padding: "8px 16px", fontSize: 14, color: COLORS.inkSoft }}>{r.clientName}</td>
                  <td style={{ padding: "8px 16px", fontSize: 14, color: COLORS.ink }}>{r.projectName}</td>
                  <td style={{ padding: "8px 16px", fontSize: 14, color: COLORS.ink }}>{r.taskName}</td>
                  <td style={{ padding: "8px 16px", textAlign: "right", fontFamily: FONT_MONO, fontSize: 13, color: COLORS.ink }}>
                    {r.hours}
                  </td>
                  <td style={{ padding: "8px 16px", textAlign: "right", fontFamily: FONT_MONO, fontSize: 13, color: COLORS.inkSoft }}>
                    {fmtUSD(r.amount)}
                  </td>
                  <td style={{ padding: "8px 16px", textAlign: "center", fontSize: 12, fontFamily: FONT_UI }}>
                    {r.invoiceStatus === "full" && <span style={{ color: COLORS.accent, fontWeight: 600 }}>✓ Invoiced</span>}
                    {r.invoiceStatus === "partial" && <span style={{ color: COLORS.amber, fontWeight: 600 }}>Partial</span>}
                    {r.invoiceStatus === "none" && <span style={{ color: COLORS.inkFaint }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const linkButtonStyle = {
  background: "none",
  border: "none",
  color: COLORS.accent,
  fontSize: 12,
  fontFamily: FONT_UI,
  cursor: "pointer",
  padding: 0,
};

const dangerLinkButtonStyle = { ...linkButtonStyle, color: COLORS.red };

function ConfirmButton({ label, onConfirm, style, title }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: COLORS.inkFaint, fontFamily: FONT_UI }}>Sure?</span>
        <button
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          style={dangerLinkButtonStyle}
        >
          Yes
        </button>
        <button onClick={() => setConfirming(false)} style={{ ...linkButtonStyle, color: COLORS.inkFaint }}>
          No
        </button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} style={style || dangerLinkButtonStyle} title={title}>
      {label}
    </button>
  );
}

function ClientsTab({ clients, projectsByClient, onAdd, onUpdate, onSetArchived, onDelete }) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditName(c.name);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    onUpdate(editingId, editName.trim());
    setEditingId(null);
  };

  const archivedCount = clients.filter((c) => c.archived).length;
  const visibleClients = showArchived ? clients : clients.filter((c) => !c.archived);

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ flex: 1 }}>
        {archivedCount > 0 && (
          <button onClick={() => setShowArchived((s) => !s)} style={{ ...linkButtonStyle, marginBottom: 12, display: "block" }}>
            {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
          </button>
        )}
        {visibleClients.length === 0 ? (
          <EmptyState text="No clients yet. Add your first client to get started." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleClients.map((c) =>
              editingId === c.id ? (
                <div
                  key={c.id}
                  style={{
                    background: COLORS.paper,
                    border: `1px solid ${COLORS.accent}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    autoFocus
                  />
                  <button onClick={saveEdit} style={linkButtonStyle}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{ ...linkButtonStyle, color: COLORS.inkFaint }}>Cancel</button>
                </div>
              ) : (
                <div
                  key={c.id}
                  style={{
                    background: COLORS.paper,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: c.archived ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontFamily: FONT_UI, fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
                    {c.name}
                    {c.archived && <span style={{ fontWeight: 400, color: COLORS.inkFaint }}> · archived</span>}
                  </span>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: COLORS.inkFaint }}>
                      {(projectsByClient[c.id] || []).length} project(s)
                    </span>
                    <button onClick={() => startEdit(c)} style={linkButtonStyle}>Edit</button>
                    <button onClick={() => onSetArchived(c.id, !c.archived)} style={linkButtonStyle}>
                      {c.archived ? "Unarchive" : "Archive"}
                    </button>
                    <ConfirmButton label="Delete" onConfirm={() => onDelete(c.id)} />
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
      <div
        style={{ width: 240, display: "flex", flexDirection: "column", gap: 12, background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 16, height: "fit-content" }}
      >
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: COLORS.ink }}>New client</span>
        <Field label="Name">
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Corp"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onAdd(name.trim());
                setName("");
              }
            }}
          />
        </Field>
        <button
          onClick={() => {
            if (!name.trim()) return;
            onAdd(name.trim());
            setName("");
          }}
          style={buttonStyle}
        >
          Add client
        </button>
      </div>
    </div>
  );
}

function ProjectsTab({ projects, clients, clientById, tasksByProject, hoursByProjectId, onAdd, onUpdate, onSetArchived, onDelete }) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [budget, setBudget] = useState("");
  const [rate, setRate] = useState("");
  const [color, setColor] = useState(DEFAULT_PROJECT_COLOR);
  const [showArchived, setShowArchived] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_PROJECT_COLOR);

  const projectHours = (p) => hoursByProjectId[p.id] || 0;
  const projectBilled = (p) => projectHours(p) * (p.hourlyRate || 0);

  const activeClients = clients.filter((c) => !c.archived);
  const clientOptionsFor = (currentId) =>
    currentId && !activeClients.some((c) => c.id === currentId)
      ? [...activeClients, clients.find((c) => c.id === currentId)].filter(Boolean)
      : activeClients;

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditClientId(p.clientId);
    setEditBudget(p.budgetAmount ? String(p.budgetAmount) : "");
    setEditRate(p.hourlyRate ? String(p.hourlyRate) : "");
    setEditColor(p.color || DEFAULT_PROJECT_COLOR);
  };

  const saveEdit = () => {
    if (!editName.trim() || !editClientId) return;
    onUpdate(editingId, {
      name: editName.trim(),
      clientId: editClientId,
      budgetAmount: editBudget ? Number(editBudget) : 0,
      hourlyRate: editRate ? Number(editRate) : 0,
      color: editColor,
    });
    setEditingId(null);
  };

  const archivedCount = projects.filter((p) => p.archived).length;
  const visibleProjects = showArchived ? projects : projects.filter((p) => !p.archived);

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ flex: 1 }}>
        {archivedCount > 0 && (
          <button onClick={() => setShowArchived((s) => !s)} style={{ ...linkButtonStyle, marginBottom: 12, display: "block" }}>
            {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
          </button>
        )}
        {visibleProjects.length === 0 ? (
          <EmptyState text="No projects yet. Add a project once you have a client." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleProjects.map((p) =>
              editingId === p.id ? (
                <div
                  key={p.id}
                  style={{
                    background: COLORS.paper,
                    border: `1px solid ${COLORS.accent}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <input style={inputStyle} value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  <select style={inputStyle} value={editClientId} onChange={(e) => setEditClientId(e.target.value)}>
                    {clientOptionsFor(p.clientId).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.archived ? " (archived)" : ""}</option>
                    ))}
                  </select>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      type="number"
                      min="0"
                      placeholder="Hourly rate ($)"
                      value={editRate}
                      onChange={(e) => setEditRate(e.target.value)}
                    />
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      type="number"
                      min="0"
                      placeholder="Budget ($)"
                      value={editBudget}
                      onChange={(e) => setEditBudget(e.target.value)}
                    />
                  </div>
                  <ColorSwatchPicker value={editColor} onChange={setEditColor} />
                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={saveEdit} style={linkButtonStyle}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ ...linkButtonStyle, color: COLORS.inkFaint }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  key={p.id}
                  style={{
                    background: COLORS.paper,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: p.archived ? 0.6 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontFamily: FONT_UI, fontWeight: 600, fontSize: 14, color: COLORS.ink, display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: p.color || DEFAULT_PROJECT_COLOR,
                          flexShrink: 0,
                        }}
                      />
                      {p.name}
                      {p.archived && <span style={{ fontWeight: 400, color: COLORS.inkFaint }}> · archived</span>}
                    </div>
                    <div style={{ fontFamily: FONT_UI, fontSize: 12, color: COLORS.inkFaint }}>
                      {clientById[p.clientId]?.name || "No client"} · {(tasksByProject[p.id] || []).length} task(s)
                      {p.hourlyRate ? ` · ${fmtUSD(p.hourlyRate)}/hr` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <BudgetBar logged={projectBilled(p)} budget={p.budgetAmount} />
                    <button onClick={() => startEdit(p)} style={linkButtonStyle}>Edit</button>
                    <button onClick={() => onSetArchived(p.id, !p.archived)} style={linkButtonStyle}>
                      {p.archived ? "Unarchive" : "Archive"}
                    </button>
                    <ConfirmButton label="Delete" onConfirm={() => onDelete(p.id)} />
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
      <div
        style={{ width: 240, display: "flex", flexDirection: "column", gap: 12, background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 16, height: "fit-content" }}
      >
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: COLORS.ink }}>New project</span>
        {activeClients.length === 0 ? (
          <span style={{ fontSize: 12, color: COLORS.inkFaint }}>Add a client first.</span>
        ) : (
          <>
            <Field label="Name">
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Website redesign" />
            </Field>
            <Field label="Client">
              <select style={inputStyle} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select a client</option>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Hourly rate ($, optional)">
              <input style={inputStyle} type="number" min="0" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="150" />
            </Field>
            <Field label="Budget ($, optional)">
              <input style={inputStyle} type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="6000" />
            </Field>
            <Field label="Timesheet header color">
              <ColorSwatchPicker value={color} onChange={setColor} />
            </Field>
            <button
              onClick={() => {
                if (!name.trim() || !clientId) return;
                onAdd(name.trim(), clientId, budget ? Number(budget) : 0, rate ? Number(rate) : 0, color);
                setName("");
                setBudget("");
                setRate("");
                setColor(DEFAULT_PROJECT_COLOR);
              }}
              style={buttonStyle}
            >
              Add project
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ProjectCheckboxList({ projects, selected, onToggle }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        maxHeight: 160,
        overflowY: "auto",
        border: `1px solid ${COLORS.line}`,
        borderRadius: 6,
        padding: 8,
      }}
    >
      {projects.map((p) => (
        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: FONT_UI, color: COLORS.ink }}>
          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} />
          {p.name}
          {p.archived && <span style={{ color: COLORS.inkFaint }}> (archived)</span>}
        </label>
      ))}
    </div>
  );
}

function TasksTab({ tasks, projects, onAdd, onUpdate, onSetArchived, onDelete }) {
  const [name, setName] = useState("");
  const [projectIds, setProjectIds] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editProjectIds, setEditProjectIds] = useState([]);

  const activeProjects = projects.filter((p) => !p.archived);
  const projectOptionsFor = (selectedIds) => {
    const extra = selectedIds.map((id) => projectById[id]).filter((p) => p && p.archived);
    return [...activeProjects, ...extra];
  };

  const toggleProjectId = (id) => {
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleEditProjectId = (id) => {
    setEditProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditProjectIds(t.projectIds || []);
  };

  const saveEdit = () => {
    if (!editName.trim() || editProjectIds.length === 0) return;
    onUpdate(editingId, { name: editName.trim(), projectIds: editProjectIds });
    setEditingId(null);
  };

  const archivedCount = tasks.filter((t) => t.archived).length;
  const visibleTasks = showArchived ? tasks : tasks.filter((t) => !t.archived);

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ flex: 1 }}>
        {archivedCount > 0 && (
          <button onClick={() => setShowArchived((s) => !s)} style={{ ...linkButtonStyle, marginBottom: 12, display: "block" }}>
            {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
          </button>
        )}
        {visibleTasks.length === 0 ? (
          <EmptyState text="No tasks yet. Add a task once you have a project." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleTasks.map((t) => {
              const taskProjects = (t.projectIds || []).map((id) => projectById[id]).filter(Boolean);
              return editingId === t.id ? (
                <div
                  key={t.id}
                  style={{
                    background: COLORS.paper,
                    border: `1px solid ${COLORS.accent}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <input style={inputStyle} value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  <ProjectCheckboxList
                    projects={projectOptionsFor(editProjectIds)}
                    selected={editProjectIds}
                    onToggle={toggleEditProjectId}
                  />
                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={saveEdit} style={linkButtonStyle}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ ...linkButtonStyle, color: COLORS.inkFaint }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  key={t.id}
                  style={{
                    background: COLORS.paper,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: t.archived ? 0.6 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontFamily: FONT_UI, fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
                      {t.name}
                      {t.archived && <span style={{ fontWeight: 400, color: COLORS.inkFaint }}> · archived</span>}
                    </div>
                    <div style={{ fontFamily: FONT_UI, fontSize: 12, color: COLORS.inkFaint }}>
                      {taskProjects.length > 0
                        ? taskProjects.map((p) => p.name).join(", ")
                        : "No projects assigned"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <button onClick={() => startEdit(t)} style={linkButtonStyle}>Edit</button>
                    <button onClick={() => onSetArchived(t.id, !t.archived)} style={linkButtonStyle}>
                      {t.archived ? "Unarchive" : "Archive"}
                    </button>
                    <ConfirmButton label="Delete" onConfirm={() => onDelete(t.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div
        style={{ width: 260, display: "flex", flexDirection: "column", gap: 12, background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 16, height: "fit-content" }}
      >
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: COLORS.ink }}>New task</span>
        {activeProjects.length === 0 ? (
          <span style={{ fontSize: 12, color: COLORS.inkFaint }}>Add a project first.</span>
        ) : (
          <>
            <Field label="Name">
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Homepage layout" />
            </Field>
            <Field label="Projects (select one or more)">
              <ProjectCheckboxList projects={activeProjects} selected={projectIds} onToggle={toggleProjectId} />
            </Field>
            <button
              onClick={() => {
                if (!name.trim() || projectIds.length === 0) return;
                onAdd(name.trim(), projectIds);
                setName("");
                setProjectIds([]);
              }}
              style={buttonStyle}
            >
              Add task
            </button>
          </>
        )}
      </div>
    </div>
  );
}
