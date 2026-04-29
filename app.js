const STORAGE_KEY = "discipline-os-v6";
const TAB_IDS = ["today", "history", "routines", "settings"];
const DEFAULT_LATE_WEIGHT = 0.5;
const DEFAULT_NOTIFICATION_WINDOW_MINUTES = 20;
const TASK_TYPES = [
  { value: "binary", label: "Done / Not Done" },
  { value: "numeric", label: "Numeric" },
  { value: "frequency", label: "Multiple times/day" },
  { value: "interval", label: "Interval" },
  { value: "nonscored", label: "Non-scored" },
];
const CATEGORIES = [
  "Skincare",
  "Fitness",
  "Study / Career",
  "Diet",
  "Medicines",
  "Mind",
  "Custom",
];
const DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};
const ROUTINE_SEEDS = [
  {
    id: "routine_skincare",
    title: "Skincare",
    summary: "Structured morning and night skincare order from your transformation documents.",
    body: `Morning:
1. Cleanser
2. Vitamin C serum
3. Moisturizer
4. Sunscreen

Night:
1. Cleanser
2. Niacinamide serum
3. Moisturizer

Weekly:
- Exfoliation 2 to 3 times per week`,
  },
  {
    id: "routine_haircare",
    title: "Haircare",
    summary: "Daily hair routine plus wash-day order from your hair care document.",
    body: `Daily:
- Hair tonic spray in the morning
- Hair tonic spray at night
- 1 biotin capsule after breakfast

Wash Days (3x/week):
1. Apply oil the night before
2. Shampoo the next day
3. Towel dry
4. Apply spray after drying

Rules:
- No hot water
- Do not wash hair daily
- Do not apply spray on oily scalp`,
  },
  {
    id: "routine_workout",
    title: "Workout",
    summary: "Day-wise gym structure combined from the transformation plans.",
    body: `Workout Plan:
- Day 1: Chest + Triceps
- Day 2: Back + Biceps
- Day 3: Legs
- Day 4: Shoulders + Abs
- Day 5: Full Body

Optional Add-On:
- 10 to 15 minutes incline walking daily
- Rest or active recovery on the final day`,
  },
  {
    id: "routine_diet",
    title: "Diet",
    summary: "Simple high-protein meal structure from your transformation plans.",
    body: `Meals:
- Breakfast: Eggs + oats
- Lunch: Chicken + rice
- Snack: Fruits + peanuts
- Dinner: Protein + salad

Rules:
- Drink 3 to 4L water
- Avoid junk food
- Reduce excess sugar and salt
- Keep protein high`,
  },
  {
    id: "routine_career",
    title: "Career",
    summary: "Daily job-prep routine from your transformation plans.",
    body: `Core Plan:
- 2 to 4 hours of DSA daily
- Apply for jobs consistently
- Practice projects

Suggested Order:
1. DSA first
2. Project work second
3. Applications after the main study block`,
  },
];
const TASK_TO_ROUTINE_MAP = {
  task_skincare_morning: "routine_skincare",
  task_skincare_night: "routine_skincare",
  task_workout: "routine_workout",
  task_study: "routine_career",
  task_diet: "routine_diet",
};

let state = loadState();
let activeTab = "today";
let editingTaskId = null;
let laterExpanded = false;
let selectedRoutineId = "routine_skincare";
let editingRoutineId = null;
let gestureState = null;

const els = {
  today: document.querySelector("#view-today"),
  history: document.querySelector("#view-history"),
  routines: document.querySelector("#view-routines"),
  settings: document.querySelector("#view-settings"),
  navItems: [...document.querySelectorAll(".nav-item")],
  liveClock: document.querySelector("#liveClock"),
  todayLabel: document.querySelector("#todayLabel"),
  taskDialog: document.querySelector("#taskDialog"),
  taskForm: document.querySelector("#taskForm"),
  taskDialogTitle: document.querySelector("#taskDialogTitle"),
  closeTaskDialog: document.querySelector("#closeTaskDialog"),
  cancelTaskDialog: document.querySelector("#cancelTaskDialog"),
  deleteTaskButton: document.querySelector("#deleteTaskButton"),
  taskId: document.querySelector("#taskId"),
  taskName: document.querySelector("#taskName"),
  taskCategory: document.querySelector("#taskCategory"),
  taskType: document.querySelector("#taskType"),
  taskTarget: document.querySelector("#taskTarget"),
  taskTimeLogic: document.querySelector("#taskTimeLogic"),
  taskStartTime: document.querySelector("#taskStartTime"),
  taskEndTime: document.querySelector("#taskEndTime"),
  taskReminderTimes: document.querySelector("#taskReminderTimes"),
  taskFrequency: document.querySelector("#taskFrequency"),
  taskDays: document.querySelector("#taskDays"),
  taskIntervalDays: document.querySelector("#taskIntervalDays"),
  taskPoints: document.querySelector("#taskPoints"),
  taskScored: document.querySelector("#taskScored"),
  taskNotes: document.querySelector("#taskNotes"),
};

bootstrap();

function bootstrap() {
  hydrateSelectors();
  attachEvents();
  renderAll();
  notifyDueItems();
  setInterval(() => {
    renderAll();
    notifyDueItems();
  }, 30_000);
}

function attachEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  els.taskType.addEventListener("change", syncTaskFormHints);
  els.taskFrequency.addEventListener("change", syncTaskFormHints);
  els.taskTimeLogic.addEventListener("change", syncTaskFormHints);

  els.closeTaskDialog.addEventListener("click", closeTaskDialog);
  els.cancelTaskDialog.addEventListener("click", closeTaskDialog);
  els.deleteTaskButton.addEventListener("click", () => {
    if (!editingTaskId) return;
    deleteTask(editingTaskId);
    closeTaskDialog();
  });

  els.taskDialog.addEventListener("close", resetTaskForm);
  els.taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveTaskFromForm();
  });

  document.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const { action } = actionEl.dataset;

    if (action === "new-task") {
      openTaskDialog();
    } else if (action === "edit-task") {
      openTaskDialog(actionEl.dataset.id);
    } else if (action === "open-linked-routine") {
      openLinkedRoutine(actionEl.dataset.routineId);
    } else if (action === "select-routine") {
      selectedRoutineId = actionEl.dataset.id;
      editingRoutineId = null;
      renderRoutines();
    } else if (action === "edit-routine") {
      editingRoutineId = actionEl.dataset.id;
      renderRoutines();
    } else if (action === "cancel-routine-edit") {
      editingRoutineId = null;
      renderRoutines();
    } else if (action === "save-routine") {
      saveRoutine(actionEl.dataset.id);
    } else if (action === "complete-occurrence") {
      completeOccurrence(actionEl.dataset.taskId, actionEl.dataset.occurrenceId, false);
    } else if (action === "late-occurrence") {
      completeOccurrence(actionEl.dataset.taskId, actionEl.dataset.occurrenceId, true);
    } else if (action === "increment-numeric") {
      incrementNumeric(actionEl.dataset.taskId, Number(actionEl.dataset.amount || "0"));
    } else if (action === "toggle-later") {
      laterExpanded = !laterExpanded;
      renderToday();
    } else if (action === "enable-notifications") {
      requestNotifications();
    } else if (action === "export-data") {
      exportData();
    } else if (action === "reset-data") {
      if (confirm("Reset the full discipline system and all logs?")) {
        state = createSeedState();
        syncState();
        renderAll();
      }
    }
  });

  document.addEventListener("pointerdown", handleCardPointerDown);
  document.addEventListener("pointermove", handleCardPointerMove);
  document.addEventListener("pointerup", handleCardPointerUp);
  document.addEventListener("pointercancel", resetGestureState);
}

function renderAll() {
  const now = new Date();
  els.liveClock.textContent = formatTime(now);
  els.todayLabel.textContent = formatLongDate(now);
  renderToday();
  renderHistory();
  renderRoutines();
  renderSettings();
}

function renderToday() {
  const now = new Date();
  const todayKey = dateToKey(now);
  const items = buildTodayItems(now);
  const doNow = items.filter((item) => item.state === "due");
  const upcoming = items.filter((item) => item.state === "upcoming");
  const completed = items.filter((item) => item.state === "completed");
  const lateCompleted = items.filter((item) => item.state === "late-completed");
  const missed = items.filter((item) => item.state === "missed");
  const progress = getTodayProgress(now);

  els.today.innerHTML = `
    <section class="hero-card">
      <p class="eyebrow">Today</p>
      <h2>Do what matters now.</h2>
      <p>${doNow.length ? `${doNow.length} item${doNow.length === 1 ? "" : "s"} ready right now.` : "Nothing urgent right now. Keep the slate clean."}</p>
    </section>

    <section class="card mini-progress">
      <div class="section-head">
        <div>
          <h2>Mini progress</h2>
          <p>${progress.done}/${progress.total} done</p>
        </div>
        <div class="task-meta">
          <span class="tag neutral">${completed.length} completed</span>
          <span class="tag warn">${lateCompleted.length} late</span>
          <span class="tag bad">${missed.length} missed</span>
        </div>
      </div>
      <strong>${progress.done}/${progress.total || 0}</strong>
      <div class="progress-bar"><span style="width:${progress.percent}%"></span></div>
    </section>

    <section class="card" style="padding:16px">
      <div class="section-head">
        <div>
          <h2>Do now</h2>
          <p>Current tasks and medicines only.</p>
        </div>
      </div>
      <div class="task-stack">
        ${doNow.length ? doNow.map(renderActionCard).join("") : emptyState("No current actions. Check back when the next window opens.")}
      </div>
    </section>

    <section class="card" style="padding:16px">
      <div class="collapse-head">
        <div>
          <h2>Later today</h2>
          <p class="muted">${upcoming.length} future item${upcoming.length === 1 ? "" : "s"}</p>
        </div>
        <button class="ghost-button" data-action="toggle-later">${laterExpanded ? "Hide" : "Show"}</button>
      </div>
      <div class="collapsed-body ${laterExpanded ? "open" : ""}">
        ${upcoming.length ? upcoming.map(renderActionCard).join("") : emptyState("Nothing else is scheduled later today.")}
      </div>
    </section>

    <section class="card" style="padding:16px">
      <div class="section-head">
        <div>
          <h2>Closed today</h2>
          <p>Completed, late-completed, and missed items stay honest here.</p>
        </div>
      </div>
      <div class="task-stack">
        ${[...lateCompleted, ...missed, ...completed].length ? [...lateCompleted, ...missed, ...completed].map(renderActionCard).join("") : emptyState("Nothing closed yet today.")}
      </div>
    </section>
  `;
}

function renderHistory() {
  const now = new Date();
  const dates = getRecentDates(now, 14);
  const weekly = getRangeStats(getRecentDates(now, 7));
  const monthly = getRangeStats(getRecentDates(now, 30));

  els.history.innerHTML = `
    <section class="card" style="padding:16px">
      <div class="section-head">
        <div>
          <h2>History</h2>
          <p>Recent calendar with completed, missed, and late-completed states.</p>
        </div>
      </div>
      <div class="stats-grid">
        <article class="mini-stat card">
          <span class="muted">Weekly completion</span>
          <strong>${weekly.completionRate}%</strong>
          <span class="muted">${weekly.streak}-day streak</span>
        </article>
        <article class="mini-stat card">
          <span class="muted">Monthly completion</span>
          <strong>${monthly.completionRate}%</strong>
          <span class="muted">${monthly.late} late completions</span>
        </article>
      </div>
    </section>

    <section class="card" style="padding:16px">
      <div class="section-head">
        <div>
          <h2>Calendar</h2>
          <p>Most recent 14 days.</p>
        </div>
      </div>
      <div class="history-grid">
        ${dates.map(renderHistoryDay).join("")}
      </div>
    </section>
  `;
}

function renderRoutines() {
  if (!state.routines?.length) return;
  if (!state.routines.some((routine) => routine.id === selectedRoutineId)) {
    selectedRoutineId = state.routines[0].id;
  }
  const routine = state.routines.find((item) => item.id === selectedRoutineId) || state.routines[0];
  const isEditing = editingRoutineId === routine.id;

  els.routines.innerHTML = `
    <section class="card" style="padding:16px">
      <div class="section-head">
        <div>
          <h2>Routines</h2>
          <p>Built-in instruction manual for how to do each part properly.</p>
        </div>
      </div>
      <div class="routines-layout">
        <div class="routine-list">
          ${state.routines
            .map(
              (item) => `
                <button class="routine-nav-card ${item.id === routine.id ? "active" : ""}" data-action="select-routine" data-id="${item.id}">
                  <strong>${escapeHtml(item.title)}</strong>
                  <p class="muted" style="margin-top:6px">${escapeHtml(item.summary)}</p>
                </button>
              `,
            )
            .join("")}
        </div>
        <article class="card routine-detail">
          ${isEditing ? renderRoutineEditor(routine) : renderRoutineDetail(routine)}
        </article>
      </div>
    </section>
  `;
}

function renderSettings() {
  const tasks = state.tasks.filter((task) => task.active !== false);
  els.settings.innerHTML = `
    <section class="card" style="padding:16px">
      <div class="section-head">
        <div>
          <h2>Settings</h2>
          <p>Manage tasks, notifications, and data without cluttering the action flow.</p>
        </div>
        <button class="primary-button" data-action="new-task">Add task</button>
      </div>
      <div class="settings-list">
        <article class="task-card">
          <header>
            <div>
              <div class="task-title">Browser reminders</div>
              <p class="task-subtitle">High-priority nudges for due medicines and time-bound actions.</p>
            </div>
            <button class="secondary-button" data-action="enable-notifications">Enable</button>
          </header>
        </article>
        <article class="task-card">
          <header>
            <div>
              <div class="task-title">Export data</div>
              <p class="task-subtitle">Download all tasks and logs as JSON.</p>
            </div>
            <button class="secondary-button" data-action="export-data">Export</button>
          </header>
        </article>
        <article class="task-card">
          <header>
            <div>
              <div class="task-title">Reset system</div>
              <p class="task-subtitle">Clear logs and restore the default execution stack.</p>
            </div>
            <button class="secondary-button danger-button" data-action="reset-data">Reset</button>
          </header>
        </article>
      </div>
    </section>

    <section class="card" style="padding:16px">
      <div class="section-head">
        <div>
          <h2>Task system</h2>
          <p>${tasks.length} active task${tasks.length === 1 ? "" : "s"} in the engine.</p>
        </div>
      </div>
      <div class="settings-list">
        ${tasks.map(renderSettingsTask).join("")}
      </div>
    </section>
  `;
}

function renderActionCard(item) {
  const classes = ["task-card", item.state];
  if (item.canPrimaryAction) classes.push("interactive");
  if (item.state === "missed") classes.push("disabled");
  const statusTag = getStatusTag(item);
  const subtitle = item.showSubtitle ? `<p class="task-subtitle">${escapeHtml(item.subtitle)}</p>` : "";
  const timeBlock = item.timeLabel ? `<span class="task-time">${escapeHtml(item.timeLabel)}</span>` : "";
  const routineButton = item.routineId
    ? `<button class="routine-button" data-action="open-linked-routine" data-routine-id="${item.routineId}">View routine</button>`
    : "";

  return `
    <article class="${classes.join(" ")}" ${buildCardActionAttributes(item)}>
      <div class="swipe-hint swipe-hint-left">Skip</div>
      <div class="swipe-hint swipe-hint-right">${escapeHtml(item.primaryActionLabel || "Done")}</div>
      <header>
        <div>
          <div class="task-title">${escapeHtml(item.title)}</div>
          ${subtitle}
        </div>
        ${statusTag}
      </header>
      <div class="task-footer">
        <div class="task-quick-meta">
          ${timeBlock}
          ${item.meta ? `<span class="task-compact-meta">${escapeHtml(item.meta)}</span>` : ""}
        </div>
        ${routineButton}
      </div>
      ${item.type === "numeric" ? renderNumericProgress(item) : ""}
      ${renderLateAction(item)}
    </article>
  `;
}

function renderNumericProgress(item) {
  const current = item.currentValue;
  const target = item.targetValue || 0;
  const pct = target ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return `
    <div class="task-progress-row">
      <div class="progress-bar compact"><span style="width:${pct}%"></span></div>
      <div class="task-quick-meta">
        <span class="task-compact-meta">${current}/${target}</span>
        <span class="task-compact-meta">${pct}%</span>
      </div>
    </div>
  `;
}

function renderLateAction(item) {
  if (item.state !== "missed") return "";
  return `
    <div class="secondary-row">
      <button class="secondary-button subtle-button" data-action="late-occurrence" data-task-id="${item.taskId}" data-occurrence-id="${item.occurrenceId}">Mark done late</button>
    </div>
  `;
}

function renderSettingsTask(task) {
  return `
    <article class="task-card">
      <header>
        <div>
          <div class="task-title">${escapeHtml(task.name)}</div>
          <p class="task-subtitle">${escapeHtml(task.category)} · ${escapeHtml(getTaskTypeLabel(task.type))}</p>
        </div>
        <button class="secondary-button" data-action="edit-task" data-id="${task.id}">Edit</button>
      </header>
    </article>
  `;
}

function renderRoutineDetail(routine) {
  return `
    <div class="routine-detail-head">
      <div>
        <h2>${escapeHtml(routine.title)}</h2>
        <p class="muted" style="margin-top:6px">${escapeHtml(routine.summary)}</p>
      </div>
      <button class="secondary-button" data-action="edit-routine" data-id="${routine.id}">Edit</button>
    </div>
    <div class="task-stack">
      ${parseRoutineBody(routine.body)
        .map(
          (section) => `
            <section class="routine-section">
              <h3>${escapeHtml(section.title)}</h3>
              ${section.ordered ? `<ol>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`}
            </section>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderRoutineEditor(routine) {
  return `
    <div class="routine-detail-head">
      <div>
        <h2>Edit routine</h2>
        <p class="muted" style="margin-top:6px">Update the built-in text and save it inside the app.</p>
      </div>
    </div>
    <div class="routine-editor">
      <label>
        Title
        <input id="routineTitleInput" type="text" value="${escapeAttribute(routine.title)}" />
      </label>
      <label>
        Summary
        <input id="routineSummaryInput" type="text" value="${escapeAttribute(routine.summary)}" />
      </label>
      <label>
        Routine text
        <textarea id="routineBodyInput">${escapeHtml(routine.body)}</textarea>
      </label>
      <div class="dialog-actions">
        <button class="secondary-button" data-action="cancel-routine-edit">Cancel</button>
        <button class="primary-button" data-action="save-routine" data-id="${routine.id}">Save changes</button>
      </div>
    </div>
  `;
}

function renderHistoryDay(date) {
  const summary = getDaySummary(date);
  const topItems = summary.items.slice(0, 4);
  return `
    <article class="day-card">
      <h3>${escapeHtml(formatShortDate(date))}</h3>
      <div class="day-stats">
        <span class="tag good">${summary.completed} completed</span>
        <span class="tag warn">${summary.late} late</span>
        <span class="tag bad">${summary.missed} missed</span>
      </div>
      <div class="tiny-list">
        ${topItems.length ? topItems.map((item) => `<div class="tiny-item"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.label)}</span></div>`).join("") : `<div class="empty-state">No scheduled items</div>`}
      </div>
    </article>
  `;
}

function buildTodayItems(now) {
  const tasks = state.tasks.filter((task) => task.active !== false);
  return tasks
    .flatMap((task) => buildTaskOccurrences(task, now))
    .filter(Boolean)
    .sort(sortItems);
}

function buildTaskOccurrences(task, now) {
  const dateKey = dateToKey(now);
  if (!isTaskScheduledForDate(task, now)) return [];

  if (task.type === "frequency") {
    return buildFrequencyOccurrences(task, now, dateKey);
  }

  if (task.type === "interval" && !isIntervalDue(task, now)) {
    return [];
  }

  return [buildSingleOccurrence(task, now, dateKey)];
}

function buildSingleOccurrence(task, now, dateKey) {
  const log = getTaskLog(dateKey, task.id);
  const occurrenceId = "main";
  const completion = log.occurrences?.[occurrenceId] || null;
  const numericValue = Number(log.numericValue || 0);
  const status = evaluateStatus({
    task,
    occurrenceId,
    now,
    completion,
    timeLabel: task.reminderTimes?.[0] || null,
    startTime: task.timeLogic === "window" ? task.startTime : null,
    endTime: task.timeLogic === "window" ? task.endTime : null,
    numericValue,
  });

  return {
    taskId: task.id,
    occurrenceId,
    title: task.name,
    subtitle: task.notes || buildSubtitle(task),
    timeLabel: buildOccurrenceTimeLabel(task),
    meta: buildMeta(task, status, numericValue),
    type: task.type,
    state: status.state,
    timeSort: status.timeSort,
    priority: getPriority(task),
    increment: task.quickIncrement || 1,
    incrementLabel: task.quickIncrementLabel || "+1",
    primaryActionLabel: task.type === "numeric" ? task.quickIncrementLabel || "+1" : getActionLabel({ type: task.type, title: task.name }),
    currentValue: numericValue,
    targetValue: Number(task.targetValue || 0),
    routineId: getRoutineIdForTask(task),
    canPrimaryAction: status.state === "due" || status.state === "upcoming",
    canSkip: status.state === "due" || status.state === "upcoming",
    showSubtitle: false,
  };
}

function buildFrequencyOccurrences(task, now, dateKey) {
  const log = getTaskLog(dateKey, task.id);
  const slots = task.slotWindows?.length ? task.slotWindows : buildGenericSlots(task);

  return slots.map((slot, index) => {
    const occurrenceId = slot.id || `slot-${index + 1}`;
    const completion = log.occurrences?.[occurrenceId] || null;
    const status = evaluateStatus({
      task,
      occurrenceId,
      now,
      completion,
      timeLabel: slot.time || null,
      startTime: slot.start || inferStartFromTime(slot.time),
      endTime: slot.end || inferEndFromTime(slot.time),
      numericValue: null,
    });

    return {
      taskId: task.id,
      occurrenceId,
      title: task.name,
      subtitle: slot.label || `Dose ${index + 1}`,
      timeLabel: slot.time || formatWindow(slot.start, slot.end),
      meta: "Medicine",
      type: "frequency",
      state: status.state,
      timeSort: status.timeSort,
      priority: 10,
      routineId: getRoutineIdForTask(task),
      canPrimaryAction: status.state === "due" || status.state === "upcoming",
      canSkip: status.state === "due" || status.state === "upcoming",
      primaryActionLabel: "Taken",
      showSubtitle: true,
    };
  });
}

function buildGenericSlots(task) {
  const times = task.reminderTimes?.length ? task.reminderTimes : [];
  if (times.length) {
    return times.map((time, index) => ({
      id: `slot-${index + 1}`,
      label: doseLabel(index, times.length),
      time,
    }));
  }
  const count = Math.max(1, Number(task.targetValue || 1));
  return Array.from({ length: count }, (_, index) => ({
    id: `slot-${index + 1}`,
    label: doseLabel(index, count),
  }));
}

function evaluateStatus({ task, occurrenceId, now, completion, timeLabel, startTime, endTime, numericValue }) {
  const nowMinutes = minutesSinceMidnight(now);
  const hasWindow = Boolean(startTime || endTime);
  const startMinutes = startTime ? timeToMinutes(startTime) : timeLabel ? timeToMinutes(timeLabel) : null;
  const endMinutes = endTime
    ? timeToMinutes(endTime)
    : startMinutes !== null && task.type === "frequency"
      ? Math.min(startMinutes + 120, 1439)
      : null;

  if (task.type === "numeric") {
    if (completion?.status === "skipped") return { state: "missed", timeSort: startMinutes ?? 0 };
    const target = Number(task.targetValue || 0);
    const done = target > 0 ? numericValue >= target : numericValue > 0;
    if (done) return { state: "completed", timeSort: startMinutes ?? 0 };
    const nextReminder = getNextReminder(task.reminderTimes || [], nowMinutes);
    if (nextReminder !== null && nextReminder > nowMinutes) return { state: "upcoming", timeSort: nextReminder };
    return { state: "due", timeSort: startMinutes ?? nowMinutes };
  }

  if (completion?.status === "skipped") return { state: "missed", timeSort: startMinutes ?? 0 };
  if (completion?.status === "completed") return { state: "completed", timeSort: startMinutes ?? 0 };
  if (completion?.status === "late") return { state: "late-completed", timeSort: startMinutes ?? 0 };

  if (!hasWindow && timeLabel) {
    const exactTime = timeToMinutes(timeLabel);
    if (exactTime > nowMinutes) return { state: "upcoming", timeSort: exactTime };
    return { state: "due", timeSort: exactTime };
  }

  if (hasWindow) {
    if (startMinutes !== null && nowMinutes < startMinutes) return { state: "upcoming", timeSort: startMinutes };
    if (endMinutes !== null && nowMinutes > endMinutes) return { state: "missed", timeSort: endMinutes };
    return { state: "due", timeSort: startMinutes ?? nowMinutes };
  }

  if (task.timeLogic === "flexible") return { state: "due", timeSort: 0 };
  return { state: "upcoming", timeSort: startMinutes ?? 0 };
}

function getTodayProgress(now) {
  const items = buildTodayItems(now);
  const total = items.length;
  const done = items.filter((item) => item.state === "completed" || item.state === "late-completed").length;
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

function getDaySummary(date) {
  const items = buildDayItems(date);
  const completed = items.filter((item) => item.state === "completed").length;
  const late = items.filter((item) => item.state === "late-completed").length;
  const missed = items.filter((item) => item.state === "missed").length;
  return { completed, late, missed, items };
}

function buildDayItems(date) {
  const now = endOfDay(date);
  return state.tasks
    .filter((task) => task.active !== false)
    .flatMap((task) => buildTaskOccurrencesForDate(task, date, now))
    .sort(sortItems);
}

function buildTaskOccurrencesForDate(task, date, now) {
  if (!isTaskScheduledForDate(task, date)) return [];
  const dateKey = dateToKey(date);
  const isPast = startOfDay(date).getTime() < startOfDay(new Date()).getTime();

  if (task.type === "frequency") {
    const log = getTaskLog(dateKey, task.id);
    const slots = task.slotWindows?.length ? task.slotWindows : buildGenericSlots(task);
    return slots.map((slot, index) => {
      const occurrenceId = slot.id || `slot-${index + 1}`;
      const completion = log.occurrences?.[occurrenceId] || null;
      const status = evaluateStatus({
        task,
        occurrenceId,
        now,
        completion,
        timeLabel: slot.time || null,
        startTime: slot.start || inferStartFromTime(slot.time),
        endTime: slot.end || inferEndFromTime(slot.time),
        numericValue: null,
      });
      const normalizedState = normalizeHistoricalState(status.state, isPast);
      return {
        title: `${task.name}${slot.label ? ` · ${slot.label}` : ""}`,
        label: historyLabel(normalizedState),
        state: normalizedState,
        timeSort: status.timeSort,
      };
    });
  }

  if (task.type === "interval" && !isIntervalDue(task, date)) return [];

  const log = getTaskLog(dateKey, task.id);
  const completion = log.occurrences?.main || null;
  const numericValue = Number(log.numericValue || 0);
  const status = evaluateStatus({
    task,
    occurrenceId: "main",
    now,
    completion,
    timeLabel: task.reminderTimes?.[0] || null,
    startTime: task.timeLogic === "window" ? task.startTime : null,
    endTime: task.timeLogic === "window" ? task.endTime : null,
    numericValue,
  });
  const normalizedState = normalizeHistoricalState(status.state, isPast);
  return [{ title: task.name, label: historyLabel(normalizedState), state: normalizedState, timeSort: status.timeSort }];
}

function getRangeStats(dates) {
  let total = 0;
  let done = 0;
  let late = 0;

  dates.forEach((date) => {
    const items = buildDayItems(date);
    total += items.length;
    done += items.filter((item) => item.state === "completed").length;
    late += items.filter((item) => item.state === "late-completed").length;
  });

  return {
    completionRate: total ? Math.round(((done + late * DEFAULT_LATE_WEIGHT) / total) * 100) : 0,
    streak: getCurrentStreak(dates[dates.length - 1]),
    late,
  };
}

function getCurrentStreak(referenceDate) {
  let streak = 0;
  let cursor = startOfDay(referenceDate);
  while (streak < 365) {
    const summary = getDaySummary(cursor);
    const total = summary.completed + summary.late + summary.missed;
    const effective = summary.completed + summary.late * DEFAULT_LATE_WEIGHT;
    if (total && effective / total >= 0.7) {
      streak += 1;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

function completeOccurrence(taskId, occurrenceId, isLate) {
  const now = new Date();
  const dateKey = dateToKey(now);
  const log = ensureTaskLog(dateKey, taskId);
  if (!log.occurrences) log.occurrences = {};
  log.occurrences[occurrenceId] = {
    status: isLate ? "late" : "completed",
    completedAt: now.toISOString(),
  };
  syncState();
  renderAll();
}

function skipOccurrence(taskId, occurrenceId) {
  const now = new Date();
  const dateKey = dateToKey(now);
  const log = ensureTaskLog(dateKey, taskId);
  if (!log.occurrences) log.occurrences = {};
  log.occurrences[occurrenceId] = {
    status: "skipped",
    completedAt: now.toISOString(),
  };
  syncState();
  renderAll();
}

function incrementNumeric(taskId, amount) {
  const now = new Date();
  const dateKey = dateToKey(now);
  const log = ensureTaskLog(dateKey, taskId);
  log.numericValue = Math.max(0, Number(log.numericValue || 0) + amount);
  syncState();
  renderAll();
}

function skipNumeric(taskId) {
  const now = new Date();
  const dateKey = dateToKey(now);
  const log = ensureTaskLog(dateKey, taskId);
  if (!log.occurrences) log.occurrences = {};
  log.occurrences.main = {
    status: "skipped",
    completedAt: now.toISOString(),
  };
  syncState();
  renderAll();
}

function openTaskDialog(taskId = null) {
  editingTaskId = taskId;
  const task = taskId ? state.tasks.find((item) => item.id === taskId) : null;
  els.taskDialogTitle.textContent = task ? "Edit Task" : "Add Task";
  els.deleteTaskButton.style.visibility = task ? "visible" : "hidden";
  els.taskId.value = task?.id || "";
  els.taskName.value = task?.name || "";
  els.taskCategory.value = task?.category || "Custom";
  els.taskType.value = task?.type || "binary";
  els.taskTarget.value = task?.targetValue ?? "";
  els.taskTimeLogic.value = task?.timeLogic || "flexible";
  els.taskStartTime.value = task?.startTime || "";
  els.taskEndTime.value = task?.endTime || "";
  els.taskReminderTimes.value = (task?.reminderTimes || []).join(", ");
  els.taskFrequency.value = task?.frequency || "daily";
  els.taskDays.value = (task?.daysOfWeek || []).map((code) => DAY_LABELS[code]).join(", ");
  els.taskIntervalDays.value = task?.intervalDays ?? "";
  els.taskPoints.value = task?.points ?? "";
  els.taskScored.checked = task?.scored !== false;
  els.taskNotes.value = task?.notes || "";
  syncTaskFormHints();
  els.taskDialog.showModal();
}

function closeTaskDialog() {
  if (els.taskDialog.open) els.taskDialog.close();
}

function resetTaskForm() {
  editingTaskId = null;
  els.taskForm.reset();
  els.taskId.value = "";
  els.deleteTaskButton.style.visibility = "hidden";
  els.taskDialogTitle.textContent = "Add Task";
  syncTaskFormHints();
}

function syncTaskFormHints() {
  const type = els.taskType.value;
  const frequency = els.taskFrequency.value;
  const timeLogic = els.taskTimeLogic.value;

  els.taskTarget.disabled = !(type === "numeric" || type === "frequency");
  els.taskStartTime.disabled = timeLogic !== "window";
  els.taskEndTime.disabled = timeLogic !== "window";
  els.taskDays.disabled = frequency !== "specific-days";
  els.taskIntervalDays.disabled = frequency !== "interval";

  if (type === "nonscored") els.taskScored.checked = false;
}

function saveTaskFromForm() {
  const existing = editingTaskId ? state.tasks.find((task) => task.id === editingTaskId) : null;
  const type = els.taskType.value;
  const task = {
    id: existing?.id || `task_${crypto.randomUUID()}`,
    name: els.taskName.value.trim(),
    category: els.taskCategory.value,
    type,
    targetValue: els.taskTarget.value === "" ? null : Number(els.taskTarget.value),
    timeLogic: els.taskTimeLogic.value,
    startTime: els.taskTimeLogic.value === "window" ? els.taskStartTime.value || null : null,
    endTime: els.taskTimeLogic.value === "window" ? els.taskEndTime.value || null : null,
    reminderTimes: parseTimes(els.taskReminderTimes.value),
    frequency: els.taskFrequency.value,
    daysOfWeek: parseDays(els.taskDays.value),
    intervalDays: els.taskFrequency.value === "interval" ? Math.max(1, Number(els.taskIntervalDays.value || 1)) : null,
    points: els.taskPoints.value === "" ? null : Number(els.taskPoints.value),
    scored: type === "nonscored" ? false : els.taskScored.checked,
    notes: els.taskNotes.value.trim(),
    active: true,
    anchorDate: existing?.anchorDate || dateToKey(new Date()),
    quickIncrement: existing?.quickIncrement || inferIncrement(type, els.taskName.value),
    quickIncrementLabel: existing?.quickIncrementLabel || inferIncrementLabel(type, els.taskName.value),
    slotWindows: existing?.slotWindows || null,
  };

  if (!task.name) return;
  if (type !== "numeric" && type !== "frequency") task.targetValue = null;
  if (task.frequency !== "specific-days") task.daysOfWeek = [];
  if (task.frequency !== "interval") task.intervalDays = null;
  if (!task.points && task.scored !== false) task.points = inferPoints(task);

  const index = state.tasks.findIndex((item) => item.id === task.id);
  if (index >= 0) state.tasks[index] = { ...state.tasks[index], ...task };
  else state.tasks.unshift(task);

  syncState();
  closeTaskDialog();
  renderAll();
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  Object.keys(state.logs).forEach((dateKey) => {
    if (state.logs[dateKey]?.[taskId]) delete state.logs[dateKey][taskId];
  });
  syncState();
  renderAll();
}

function saveRoutine(routineId) {
  const titleInput = document.querySelector("#routineTitleInput");
  const summaryInput = document.querySelector("#routineSummaryInput");
  const bodyInput = document.querySelector("#routineBodyInput");
  if (!titleInput || !summaryInput || !bodyInput) return;

  const routine = state.routines.find((item) => item.id === routineId);
  if (!routine) return;

  routine.title = titleInput.value.trim() || routine.title;
  routine.summary = summaryInput.value.trim();
  routine.body = bodyInput.value.trim();
  editingRoutineId = null;
  syncState();
  renderRoutines();
}

function openLinkedRoutine(routineId) {
  if (!routineId) return;
  selectedRoutineId = routineId;
  editingRoutineId = null;
  renderRoutines();
  setActiveTab("routines");
}

function handleCardPointerDown(event) {
  if (event.target.closest("button, input, textarea, select, a")) return;
  const card = event.target.closest(".task-card.interactive");
  if (!card) return;
  gestureState = {
    card,
    taskId: card.dataset.taskId,
    occurrenceId: card.dataset.occurrenceId,
    type: card.dataset.taskType,
    amount: Number(card.dataset.amount || "0"),
    startX: event.clientX,
    currentX: event.clientX,
    moved: false,
    pointerId: event.pointerId,
  };
}

function handleCardPointerMove(event) {
  if (!gestureState || event.pointerId !== gestureState.pointerId) return;
  const deltaX = event.clientX - gestureState.startX;
  if (Math.abs(deltaX) < 4) return;
  gestureState.moved = true;
  gestureState.currentX = event.clientX;
  const limited = Math.max(-90, Math.min(90, deltaX));
  gestureState.card.style.transform = `translateX(${limited}px)`;
  if (limited > 0) {
    gestureState.card.dataset.swipe = "right";
  } else if (limited < 0) {
    gestureState.card.dataset.swipe = "left";
  } else {
    gestureState.card.dataset.swipe = "";
  }
}

function handleCardPointerUp(event) {
  if (!gestureState || event.pointerId !== gestureState.pointerId) return;
  const deltaX = event.clientX - gestureState.startX;
  const card = gestureState.card;
  const wasSwipe = Math.abs(deltaX) > 72;

  if (wasSwipe) {
    if (deltaX > 0) {
      triggerPrimaryCardAction(gestureState);
    } else {
      triggerSkipCardAction(gestureState);
    }
  } else if (!gestureState.moved || Math.abs(deltaX) < 10) {
    triggerPrimaryCardAction(gestureState);
  }

  card.style.transform = "";
  delete card.dataset.swipe;
  gestureState = null;
}

function resetGestureState() {
  if (gestureState?.card) {
    gestureState.card.style.transform = "";
    delete gestureState.card.dataset.swipe;
  }
  gestureState = null;
}

function triggerPrimaryCardAction(action) {
  if (action.type === "numeric") {
    incrementNumeric(action.taskId, action.amount);
    return;
  }
  completeOccurrence(action.taskId, action.occurrenceId, false);
}

function triggerSkipCardAction(action) {
  if (action.type === "numeric") {
    skipNumeric(action.taskId);
    return;
  }
  skipOccurrence(action.taskId, action.occurrenceId);
}

function notifyDueItems() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const now = new Date();
  const todayKey = dateToKey(now);
  const due = buildTodayItems(now).filter((item) => item.state === "due");
  due.forEach((item) => {
    const reminderKey = `${todayKey}:${item.taskId}:${item.occurrenceId}`;
    const alreadySent = state.reminderAlerts[reminderKey];
    const refMinutes = item.timeLabel ? timeToMinutes(extractTimeFromLabel(item.timeLabel)) : minutesSinceMidnight(now);
    const shouldNotify = refMinutes === null || Math.abs(minutesSinceMidnight(now) - refMinutes) <= DEFAULT_NOTIFICATION_WINDOW_MINUTES;
    if (!alreadySent && shouldNotify) {
      new Notification("Discipline OS", { body: `${item.title}${item.timeLabel ? ` · ${item.timeLabel}` : ""}` });
      state.reminderAlerts[reminderKey] = now.toISOString();
    }
  });
  syncState();
}

function requestNotifications() {
  if (typeof Notification === "undefined") {
    alert("Notifications are not supported in this browser.");
    return;
  }
  Notification.requestPermission().then((permission) => {
    if (permission === "granted") notifyDueItems();
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `discipline-os-${dateToKey(new Date())}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setActiveTab(tab) {
  activeTab = TAB_IDS.includes(tab) ? tab : "today";
  TAB_IDS.forEach((id) => {
    els[id].classList.toggle("active", id === activeTab);
  });
  els.navItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === activeTab);
  });
}

function buildCardActionAttributes(item) {
  if (!item.canPrimaryAction) return "";
  const parts = [
    `data-task-id="${item.taskId}"`,
    `data-occurrence-id="${item.occurrenceId}"`,
    `data-task-type="${item.type}"`,
  ];
  if (item.type === "numeric") parts.push(`data-amount="${item.increment}"`);
  return parts.join(" ");
}

function hydrateSelectors() {
  els.taskCategory.innerHTML = CATEGORIES.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  els.taskType.innerHTML = TASK_TYPES.map((type) => `<option value="${type.value}">${escapeHtml(type.label)}</option>`).join("");
  syncTaskFormHints();
}

function createSeedState() {
  return {
    routines: ROUTINE_SEEDS.map((routine) => ({ ...routine })),
    tasks: [
      {
        id: "task_water",
        name: "Water intake",
        category: "Custom",
        type: "numeric",
        targetValue: 4,
        timeLogic: "flexible",
        startTime: null,
        endTime: null,
        reminderTimes: ["09:00", "13:00", "18:00"],
        frequency: "daily",
        daysOfWeek: [],
        intervalDays: null,
        points: 10,
        scored: true,
        notes: "Target 4L. One tap logs half a liter.",
        active: true,
        anchorDate: dateToKey(new Date()),
        quickIncrement: 0.5,
        quickIncrementLabel: "+0.5L",
      },
      {
        id: "task_skincare_morning",
        name: "Morning skincare",
        category: "Skincare",
        type: "binary",
        targetValue: null,
        timeLogic: "window",
        startTime: "06:00",
        endTime: "12:00",
        reminderTimes: ["08:00"],
        frequency: "daily",
        daysOfWeek: [],
        intervalDays: null,
        points: 8,
        scored: true,
        notes: "AM cleanse and protection.",
        active: true,
        anchorDate: dateToKey(new Date()),
      },
      {
        id: "task_skincare_night",
        name: "Night skincare",
        category: "Skincare",
        type: "binary",
        targetValue: null,
        timeLogic: "window",
        startTime: "18:00",
        endTime: "23:00",
        reminderTimes: ["21:00"],
        frequency: "daily",
        daysOfWeek: [],
        intervalDays: null,
        points: 8,
        scored: true,
        notes: "PM repair routine.",
        active: true,
        anchorDate: dateToKey(new Date()),
      },
      {
        id: "task_workout",
        name: "Workout / Gym",
        category: "Fitness",
        type: "binary",
        targetValue: null,
        timeLogic: "window",
        startTime: "17:00",
        endTime: "21:00",
        reminderTimes: ["18:00"],
        frequency: "specific-days",
        daysOfWeek: ["mon", "tue", "wed", "thu", "fri", "sat"],
        intervalDays: null,
        points: 12,
        scored: true,
        notes: "Show up and train.",
        active: true,
        anchorDate: dateToKey(new Date()),
      },
      {
        id: "task_steps",
        name: "Steps / Walking",
        category: "Fitness",
        type: "numeric",
        targetValue: 10000,
        timeLogic: "flexible",
        startTime: null,
        endTime: null,
        reminderTimes: ["19:00"],
        frequency: "daily",
        daysOfWeek: [],
        intervalDays: null,
        points: 10,
        scored: true,
        notes: "One tap logs 1000 steps.",
        active: true,
        anchorDate: dateToKey(new Date()),
        quickIncrement: 1000,
        quickIncrementLabel: "+1000",
      },
      {
        id: "task_study",
        name: "Study / DSA block",
        category: "Study / Career",
        type: "binary",
        targetValue: null,
        timeLogic: "window",
        startTime: "10:00",
        endTime: "13:00",
        reminderTimes: ["10:00"],
        frequency: "daily",
        daysOfWeek: [],
        intervalDays: null,
        points: 12,
        scored: true,
        notes: "Placement prep or coding block.",
        active: true,
        anchorDate: dateToKey(new Date()),
      },
      {
        id: "task_diet",
        name: "Clean diet",
        category: "Diet",
        type: "binary",
        targetValue: null,
        timeLogic: "window",
        startTime: "06:00",
        endTime: "23:00",
        reminderTimes: ["14:00"],
        frequency: "daily",
        daysOfWeek: [],
        intervalDays: null,
        points: 10,
        scored: true,
        notes: "Follow planned meals. No junk.",
        active: true,
        anchorDate: dateToKey(new Date()),
      },
      {
        id: "task_chronic_med",
        name: "Chronic medicine",
        category: "Medicines",
        type: "frequency",
        targetValue: 1,
        timeLogic: "window",
        startTime: null,
        endTime: null,
        reminderTimes: ["08:30"],
        frequency: "daily",
        daysOfWeek: [],
        intervalDays: null,
        points: 14,
        scored: true,
        notes: "High priority.",
        active: true,
        anchorDate: dateToKey(new Date()),
        slotWindows: [{ id: "morning", label: "Daily dose", time: "08:30", start: "08:30", end: "11:00" }],
      },
      {
        id: "task_extra_med",
        name: "Extra medicine",
        category: "Medicines",
        type: "frequency",
        targetValue: 2,
        timeLogic: "window",
        startTime: null,
        endTime: null,
        reminderTimes: ["09:00", "21:00"],
        frequency: "daily",
        daysOfWeek: [],
        intervalDays: null,
        points: 10,
        scored: true,
        notes: "Morning and evening dose.",
        active: true,
        anchorDate: dateToKey(new Date()),
        slotWindows: [
          { id: "morning", label: "Morning dose", time: "09:00", start: "09:00", end: "12:00" },
          { id: "evening", label: "Evening dose", time: "21:00", start: "21:00", end: "23:30" },
        ],
      },
      {
        id: "task_vitamin_d",
        name: "Vitamin D",
        category: "Medicines",
        type: "interval",
        targetValue: null,
        timeLogic: "window",
        startTime: "09:00",
        endTime: "22:00",
        reminderTimes: ["09:00"],
        frequency: "interval",
        daysOfWeek: [],
        intervalDays: 3,
        points: 8,
        scored: true,
        notes: "Appears only on due day.",
        active: true,
        anchorDate: dateToKey(new Date()),
      },
      {
        id: "task_meditation",
        name: "Meditation",
        category: "Mind",
        type: "nonscored",
        targetValue: null,
        timeLogic: "flexible",
        startTime: null,
        endTime: null,
        reminderTimes: ["22:00"],
        frequency: "daily",
        daysOfWeek: [],
        intervalDays: null,
        points: 0,
        scored: false,
        notes: "Optional reset. No score.",
        active: true,
        anchorDate: dateToKey(new Date()),
      },
      {
        id: "task_journaling",
        name: "Journaling",
        category: "Mind",
        type: "nonscored",
        targetValue: null,
        timeLogic: "flexible",
        startTime: null,
        endTime: null,
        reminderTimes: ["22:15"],
        frequency: "daily",
        daysOfWeek: [],
        intervalDays: null,
        points: 0,
        scored: false,
        notes: "Optional reset. No score.",
        active: true,
        anchorDate: dateToKey(new Date()),
      },
    ],
    logs: {},
    reminderAlerts: {},
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return createSeedState();
  try {
    const parsed = JSON.parse(saved);
    const seed = createSeedState();
    return {
      ...seed,
      ...parsed,
      tasks: (parsed.tasks || seed.tasks).map((task) => ({
        active: true,
        scored: true,
        reminderTimes: [],
        daysOfWeek: [],
        notes: "",
        ...task,
      })),
      routines: parsed.routines || seed.routines,
      logs: parsed.logs || {},
      reminderAlerts: parsed.reminderAlerts || {},
    };
  } catch {
    return createSeedState();
  }
}

function syncState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getTaskLog(dateKey, taskId) {
  return state.logs[dateKey]?.[taskId] || { occurrences: {}, numericValue: 0 };
}

function ensureTaskLog(dateKey, taskId) {
  if (!state.logs[dateKey]) state.logs[dateKey] = {};
  if (!state.logs[dateKey][taskId]) state.logs[dateKey][taskId] = { occurrences: {}, numericValue: 0 };
  return state.logs[dateKey][taskId];
}

function isTaskScheduledForDate(task, date) {
  const anchor = parseDateKey(task.anchorDate || dateToKey(date));
  if (startOfDay(date).getTime() < startOfDay(anchor).getTime()) return false;
  if (task.frequency === "specific-days") {
    return task.daysOfWeek.includes(DAY_CODES[date.getDay()]);
  }
  if (task.frequency === "interval") {
    return isIntervalDue(task, date);
  }
  return true;
}

function isIntervalDue(task, date) {
  const anchor = parseDateKey(task.anchorDate || dateToKey(date));
  const diff = diffDays(anchor, startOfDay(date));
  return diff >= 0 && diff % Math.max(1, Number(task.intervalDays || 1)) === 0;
}

function parseTimes(value) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseDays(value) {
  return value
    .split(",")
    .map((part) => part.trim().slice(0, 3).toLowerCase())
    .filter((part) => DAY_CODES.includes(part));
}

function inferPoints(task) {
  if (task.scored === false || task.type === "nonscored") return 0;
  if (task.category === "Medicines") return 12;
  if (task.type === "numeric") return 10;
  return 8;
}

function inferIncrement(type, name) {
  const lower = name.toLowerCase();
  if (type !== "numeric") return 1;
  if (lower.includes("water")) return 0.5;
  if (lower.includes("step")) return 1000;
  return 1;
}

function inferIncrementLabel(type, name) {
  const lower = name.toLowerCase();
  if (type !== "numeric") return "+1";
  if (lower.includes("water")) return "+0.5L";
  if (lower.includes("step")) return "+1000";
  return "+1";
}

function buildSubtitle(task) {
  if (task.category === "Medicines") return "Due dose";
  if (task.type === "numeric") return "Progress-based action";
  return "One tap to complete";
}

function buildOccurrenceTimeLabel(task) {
  if (task.timeLogic === "window" && task.startTime && task.endTime) return `${task.startTime} - ${task.endTime}`;
  if (task.reminderTimes?.length) return task.reminderTimes.join(", ");
  return "Any time";
}

function buildMeta(task, status, numericValue) {
  if (task.type === "numeric") return `${numericValue}/${task.targetValue}`;
  if (task.type === "interval") return isIntervalDue(task, new Date()) ? "Due today" : "Not due";
  if (status.state === "late-completed") return "Completed late";
  return null;
}

function getTaskTypeLabel(type) {
  return TASK_TYPES.find((item) => item.value === type)?.label || "Task";
}

function getRoutineIdForTask(task) {
  if (TASK_TO_ROUTINE_MAP[task.id]) return TASK_TO_ROUTINE_MAP[task.id];

  const name = String(task.name || "").toLowerCase();
  const category = String(task.category || "").toLowerCase();

  if (name.includes("skincare")) return "routine_skincare";
  if (name.includes("workout") || name.includes("gym")) return "routine_workout";
  if (name.includes("haircare") || name.includes("hair care")) return "routine_haircare";
  if (name.includes("study") || name.includes("dsa") || category.includes("study")) return "routine_career";
  if (name.includes("diet") || category.includes("diet")) return "routine_diet";
  return null;
}

function getStatusTag(item) {
  const map = {
    due: ["", ""],
    upcoming: ["", ""],
    completed: ["Done", "good"],
    "late-completed": ["Late", "warn"],
    missed: ["Missed", "bad"],
  };
  const [label, tone] = map[item.state] || ["Task", "neutral"];
  if (!label) return "";
  return `<span class="tag ${tone}">${label}</span>`;
}

function getActionLabel(item) {
  if (item.type === "frequency" || item.title.toLowerCase().includes("medicine")) return "Taken";
  return "Done";
}

function historyLabel(stateName) {
  if (stateName === "completed") return "Completed";
  if (stateName === "late-completed") return "Late";
  if (stateName === "missed") return "Missed";
  if (stateName === "upcoming") return "Upcoming";
  return "Due";
}

function getPriority(task) {
  if (task.category === "Medicines") return 10;
  if (task.category === "Skincare") return 7;
  if (task.category === "Study / Career") return 6;
  return 4;
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function sortItems(a, b) {
  if (a.state === "due" && b.state !== "due") return -1;
  if (a.state !== "due" && b.state === "due") return 1;
  if (a.state === "missed" && b.state !== "missed") return -1;
  if (a.state !== "missed" && b.state === "missed") return 1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  return (a.timeSort || 0) - (b.timeSort || 0);
}

function normalizeHistoricalState(stateName, isPast) {
  if (!isPast) return stateName;
  if (stateName === "due" || stateName === "upcoming") return "missed";
  return stateName;
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function timeToMinutes(value) {
  if (!value || !value.includes(":")) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function inferStartFromTime(time) {
  return time || null;
}

function inferEndFromTime(time) {
  const minutes = timeToMinutes(time);
  if (minutes === null) return null;
  const endMinutes = Math.min(minutes + 120, 23 * 60 + 59);
  return minutesToTime(endMinutes);
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getNextReminder(times, nowMinutes) {
  const future = times.map(timeToMinutes).filter((value) => value !== null && value > nowMinutes).sort((a, b) => a - b);
  return future.length ? future[0] : null;
}

function formatWindow(start, end) {
  if (start && end) return `${start} - ${end}`;
  return start || end || "";
}

function doseLabel(index, total) {
  if (total === 1) return "Daily dose";
  if (index === 0) return "Morning dose";
  if (index === 1) return "Evening dose";
  return `Dose ${index + 1}`;
}

function extractTimeFromLabel(label) {
  return label.includes(",") ? label.split(",")[0].trim() : label.split(" - ")[0].trim();
}

function getRecentDates(fromDate, count) {
  return Array.from({ length: count }, (_, index) => addDays(startOfDay(fromDate), -(count - index - 1)));
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 0, 0);
  return copy;
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function diffDays(a, b) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

function dateToKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function parseRoutineBody(body) {
  const lines = String(body || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length);

  const sections = [];
  let current = null;

  for (const line of lines) {
    if (/:$/.test(line) && !/^(\d+\.|-|\*)\s/.test(line)) {
      current = { title: line.replace(/:$/, ""), ordered: false, items: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { title: "Routine", ordered: false, items: [] };
      sections.push(current);
    }

    if (/^\d+\.\s+/.test(line)) {
      if (!current.items.length) current.ordered = true;
      current.items.push(line.replace(/^\d+\.\s+/, ""));
      continue;
    }

    current.items.push(line.replace(/^[-*]\s+/, ""));
  }

  return sections.length ? sections : [{ title: "Routine", ordered: false, items: ["No routine text yet."] }];
}
