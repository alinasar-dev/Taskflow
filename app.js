// ===========================
// Taskflow — Minimal Todo App
// ===========================
(function () {
  'use strict';

  const STORAGE_KEY = 'taskflow_v2';

  // Default categories
  const DEFAULTS = [
    { id: uid(), name: 'Work', emoji: '💼', color: '#e8615a', tasks: [] },
    { id: uid(), name: 'Personal', emoji: '🏠', color: '#3478f6', tasks: [] },
    { id: uid(), name: 'Health', emoji: '💪', color: '#34c759', tasks: [] },
    { id: uid(), name: 'Shopping', emoji: '🛒', color: '#ff9500', tasks: [] },
  ];

  const EMOJIS = ['💼','🏠','💪','🛒','📚','🎨','🎮','✈️','🎵','🧹','💰','🍳','📷','🌱','🐾','💡','🎯','⭐'];
  const COLORS = ['#e8615a','#3478f6','#34c759','#ff9500','#af52de','#ff2d55','#5ac8fa','#ffcc00','#8e8e93','#30b0c7'];

  const INDICATOR_COLORS = ['red', 'blue', 'green', 'orange'];

  let categories = [];
  let searchQuery = '';
  let selectedEmoji = EMOJIS[0];
  let selectedColor = COLORS[0];

  // DOM shortcuts
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const el = {
    sidebar: $('#sidebar'),
    mobileToggle: $('#mobileToggle'),
    greeting: $('#greeting'),
    todayDate: $('#todayDate'),
    dayName: $('#dayName'),
    dayDate: $('#dayDate'),
    searchInput: $('#searchInput'),
    todoPanelWrap: $('#todoPanelWrap'),
    allTaskCount: $('#allTaskCount'),
    navCategories: $('#navCategories'),
    navAddCategory: $('#navAddCategory'),
    navClearCompleted: $('#navClearCompleted'),
    ringCompleted: $('#ringCompleted'),
    ringProgress: $('#ringProgress'),
    ringNotStarted: $('#ringNotStarted'),
    pctCompleted: $('#pctCompleted'),
    pctProgress: $('#pctProgress'),
    pctNotStarted: $('#pctNotStarted'),
    completedList: $('#completedList'),
    modalOverlay: $('#modalOverlay'),
    modalCloseBtn: $('#modalCloseBtn'),
    catNameInput: $('#catNameInput'),
    emojiGrid: $('#emojiGrid'),
    colorGrid: $('#colorGrid'),
    modalSubmitBtn: $('#modalSubmitBtn'),
    toastWrap: $('#toastWrap'),
    confirmOverlay: $('#confirmOverlay'),
    confirmMsg: $('#confirmMsg'),
    confirmCancelBtn: $('#confirmCancelBtn'),
    confirmOkBtn: $('#confirmOkBtn'),
  };

  // ---- Helpers ----
  function uid() {
    return '_' + Math.random().toString(36).substr(2, 9);
  }

  function escapeHTML(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { categories = JSON.parse(raw); } catch { categories = structuredClone(DEFAULTS); }
    } else {
      categories = structuredClone(DEFAULTS);
    }
  }

  // ---- Date / Greeting ----
  function setDateUI() {
    const now = new Date();
    const h = now.getHours();
    let greet = 'Good Morning ☀️';
    if (h >= 12 && h < 17) greet = 'Good Afternoon 🌤️';
    else if (h >= 17 && h < 21) greet = 'Good Evening 🌆';
    else if (h >= 21) greet = 'Good Night 🌙';
    el.greeting.textContent = greet;

    el.todayDate.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    el.dayName.textContent = now.toLocaleDateString('en-US', { weekday: 'long' });
    el.dayDate.textContent = now.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ---- Stats ----
  function getStats() {
    let total = 0, completed = 0;
    categories.forEach((c) => {
      total += c.tasks.length;
      completed += c.tasks.filter((t) => t.completed).length;
    });
    const pending = total - completed;
    // "Not Started" = tasks with status 'todo', "In Progress" = 'progress', "Completed" = completed
    // We map: completed tasks -> completed, tasks explicitly marked in-progress -> in-progress, rest -> not started
    let inProg = 0, notStarted = 0;
    categories.forEach((c) => {
      c.tasks.forEach((t) => {
        if (t.completed) return;
        if (t.status === 'progress') inProg++;
        else notStarted++;
      });
    });
    return { total, completed, inProg, notStarted };
  }

  // ---- Render Status Rings ----
  function renderRings() {
    const s = getStats();
    const circ = 2 * Math.PI * 34; // ~213.63
    const total = s.total || 1;

    const pComp = Math.round((s.completed / total) * 100);
    const pProg = Math.round((s.inProg / total) * 100);
    const pNot = Math.round((s.notStarted / total) * 100);

    animateRing(el.ringCompleted, circ, pComp);
    animateRing(el.ringProgress, circ, pProg);
    animateRing(el.ringNotStarted, circ, pNot);

    el.pctCompleted.textContent = pComp + '%';
    el.pctProgress.textContent = pProg + '%';
    el.pctNotStarted.textContent = pNot + '%';

    el.allTaskCount.textContent = s.total;
  }

  function animateRing(circle, circ, pct) {
    const offset = circ - (pct / 100) * circ;
    circle.style.strokeDashoffset = offset;
  }

  // ---- Render Completed List ----
  function renderCompleted() {
    const done = [];
    categories.forEach((c) => {
      c.tasks.filter((t) => t.completed).forEach((t) => {
        done.push({ ...t, catName: c.name, catColor: c.color, catId: c.id });
      });
    });
    // Sort newest first
    done.sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

    if (!done.length) {
      el.completedList.innerHTML = `<div class="empty-msg"><span class="empty-icon">🎉</span>No completed tasks yet</div>`;
      return;
    }

    el.completedList.innerHTML = done.map((t) => `
      <div class="completed-item">
        <div class="completed-dot" style="background:${t.catColor}"></div>
        <div class="completed-info">
          <h4>${escapeHTML(t.title)}</h4>
          ${t.description ? `<p>${escapeHTML(t.description)}</p>` : ''}
          <div class="comp-meta">
            <span><span class="label">Status:</span> <span class="value">Completed</span></span>
            <span><span class="label">Completed</span> ${relativeTime(t.completedAt || t.createdAt)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // ---- Render Sidebar Nav ----
  function renderNav() {
    el.navCategories.innerHTML = categories.map((c) => `
      <div class="nav-link" data-cat-nav="${c.id}">
        <span class="nav-dot" style="background:${c.color}"></span>
        ${escapeHTML(c.name)}
        ${c.tasks.filter((t) => !t.completed).length > 0
          ? `<span class="count">${c.tasks.filter((t) => !t.completed).length}</span>`
          : ''}
      </div>
    `).join('');
  }

  // ---- Render To-Do Panels ----
  function renderPanels() {
    el.todoPanelWrap.innerHTML = '';

    categories.forEach((cat, idx) => {
      const indicatorColor = INDICATOR_COLORS[idx % INDICATOR_COLORS.length];
      const activeTasks = cat.tasks.filter((t) => !t.completed);
      let filtered = activeTasks;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
        );
      }

      const totalTasks = cat.tasks.length;
      const doneTasks = cat.tasks.filter((t) => t.completed).length;

      const panel = document.createElement('div');
      panel.className = 'panel-card';
      panel.dataset.catId = cat.id;
      panel.innerHTML = `
        <div class="panel-header">
          <div class="panel-title">
            <span class="dot" style="background:${cat.color}"></span>
            ${cat.emoji} ${escapeHTML(cat.name)}
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:var(--text-light);">${doneTasks}/${totalTasks}</span>
            <button class="add-task-trigger" data-toggle-form="${cat.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add task
            </button>
            <button class="task-action-btn" data-delete-cat="${cat.id}" title="Delete category">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="panel-subtitle">${new Date().toLocaleDateString('en-US',{day:'numeric',month:'long'})} · Today</div>

        <!-- Add Task Form -->
        <form class="add-form" id="form-${cat.id}" data-cat-form="${cat.id}">
          <div class="form-row">
            <input class="form-input" type="text" placeholder="Task title..." maxlength="100" required data-field="title" />
          </div>
          <div class="form-row">
            <input class="form-input" type="text" placeholder="Description (optional)" maxlength="200" data-field="desc" />
          </div>
          <div class="form-row">
            <select class="form-select" data-field="priority">
              <option value="Medium">Priority: Medium</option>
              <option value="High">Priority: High</option>
              <option value="Low">Priority: Low</option>
            </select>
            <select class="form-select" data-field="status">
              <option value="todo">Not Started</option>
              <option value="progress">In Progress</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-ghost" data-cancel-form="${cat.id}">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Task</button>
          </div>
        </form>

        <!-- Task List -->
        <div class="task-list" id="tasks-${cat.id}">
          ${filtered.length === 0
            ? `<div class="empty-msg"><span class="empty-icon">${searchQuery ? '🔍' : '📝'}</span>${searchQuery ? 'No matching tasks' : 'No active tasks. Tap "+ Add task" to create one.'}</div>`
            : filtered.map((t) => taskCardHTML(t, cat, indicatorColor)).join('')
          }
        </div>
      `;

      el.todoPanelWrap.appendChild(panel);
    });
  }

  function taskCardHTML(t, cat, indicatorColor) {
    const priorityClass = `priority-${t.priority.toLowerCase()}`;
    const statusClass = t.status === 'progress' ? 'status-progress' : 'status-todo';
    const statusLabel = t.status === 'progress' ? 'In Progress' : 'Not Started';

    return `
      <div class="task-card" data-task-id="${t.id}">
        <div class="task-indicator ${indicatorColor}"></div>
        <label class="task-check">
          <input type="checkbox" data-check="${t.id}" data-cat="${cat.id}" />
          <div class="check-box"></div>
        </label>
        <div class="task-body">
          <div class="task-name">${escapeHTML(t.title)}</div>
          ${t.description ? `<div class="task-desc">${escapeHTML(t.description)}</div>` : ''}
          <div class="task-meta-row">
            <span class="task-tag"><span class="label">Priority:</span> <span class="value ${priorityClass}">${t.priority}</span></span>
            <span class="task-tag"><span class="label">Status:</span> <span class="value ${statusClass}">${statusLabel}</span></span>
            <span class="task-tag"><span class="label">Created:</span> <span class="value">${relativeTime(t.createdAt)}</span></span>
          </div>
        </div>
        <div class="task-actions">
          <button class="task-action-btn" data-delete-task="${t.id}" data-del-cat="${cat.id}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  // ---- Full Render ----
  function render() {
    renderNav();
    renderPanels();
    renderRings();
    renderCompleted();
  }

  // ---- CRUD ----
  function addTask(catId, title, description, priority, status) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    cat.tasks.unshift({
      id: uid(),
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    save();
    render();
    toast('success', `Task added to ${cat.name}`);
  }

  function completeTask(catId, taskId) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const task = cat.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.completed = true;
    task.completedAt = new Date().toISOString();
    save();
    render();
  }

  function deleteTask(catId, taskId) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    cat.tasks = cat.tasks.filter((t) => t.id !== taskId);
    save();
    render();
    toast('info', 'Task deleted');
  }

  function addCategory(name, emoji, color) {
    categories.push({ id: uid(), name: name.trim(), emoji, color, tasks: [] });
    save();
    render();
    toast('success', `"${name}" category created`);
  }

  let categoryToDelete = null;

  function deleteCategory(catId) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    categoryToDelete = catId;
    el.confirmMsg.textContent = `Are you sure you want to delete "${cat.name}" and all its tasks?`;
    el.confirmOverlay.classList.add('active');
  }

  function confirmDeleteCategory() {
    if (!categoryToDelete) return;
    const cat = categories.find((c) => c.id === categoryToDelete);
    categories = categories.filter((c) => c.id !== categoryToDelete);
    save();
    render();
    if (cat) toast('info', `"${cat.name}" deleted`);
    closeConfirmModal();
  }

  function closeConfirmModal() {
    el.confirmOverlay.classList.remove('active');
    categoryToDelete = null;
  }

  function clearCompleted() {
    let count = 0;
    categories.forEach((c) => {
      const before = c.tasks.length;
      c.tasks = c.tasks.filter((t) => !t.completed);
      count += before - c.tasks.length;
    });
    if (count === 0) { toast('info', 'No completed tasks to clear'); return; }
    save();
    render();
    toast('success', `Cleared ${count} completed task${count > 1 ? 's' : ''}`);
  }

  // ---- Modal ----
  function openModal() {
    el.modalOverlay.classList.add('active');
    el.catNameInput.value = '';
    el.catNameInput.focus();
    selectedEmoji = EMOJIS[0];
    selectedColor = COLORS[0];
    renderEmojis();
    renderColors();
  }

  function closeModal() {
    el.modalOverlay.classList.remove('active');
  }

  function renderEmojis() {
    el.emojiGrid.innerHTML = EMOJIS.map((e) =>
      `<button type="button" class="emoji-btn ${e === selectedEmoji ? 'selected' : ''}" data-emoji="${e}">${e}</button>`
    ).join('');
  }

  function renderColors() {
    el.colorGrid.innerHTML = COLORS.map((c) =>
      `<button type="button" class="color-btn ${c === selectedColor ? 'selected' : ''}" data-color="${c}" style="background:${c}"></button>`
    ).join('');
  }

  // ---- Toast ----
  function toast(type, msg) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
    el.toastWrap.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(30px)';
      t.style.transition = 'all 0.3s';
      setTimeout(() => t.remove(), 300);
    }, 2500);
  }

  // ---- Events ----
  function setupEvents() {
    // Mobile sidebar
    el.mobileToggle.addEventListener('click', () => el.sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (innerWidth <= 768 && el.sidebar.classList.contains('open') &&
          !el.sidebar.contains(e.target) && e.target !== el.mobileToggle) {
        el.sidebar.classList.remove('open');
      }
    });

    // Search
    el.searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderPanels();
    });

    // Nav category click → scroll
    el.navCategories.addEventListener('click', (e) => {
      const link = e.target.closest('[data-cat-nav]');
      if (!link) return;
      const panel = document.querySelector(`.panel-card[data-cat-id="${link.dataset.catNav}"]`);
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        panel.style.boxShadow = '0 0 0 2px var(--accent), var(--shadow-card)';
        setTimeout(() => panel.style.boxShadow = '', 1200);
      }
      el.sidebar.classList.remove('open');
    });

    // Add category nav
    el.navAddCategory.addEventListener('click', openModal);

    // Clear completed
    el.navClearCompleted.addEventListener('click', clearCompleted);

    // Modal
    el.modalCloseBtn.addEventListener('click', closeModal);
    el.modalOverlay.addEventListener('click', (e) => { if (e.target === el.modalOverlay) closeModal(); });
    
    // Confirm Modal
    el.confirmCancelBtn.addEventListener('click', closeConfirmModal);
    el.confirmOkBtn.addEventListener('click', confirmDeleteCategory);
    el.confirmOverlay.addEventListener('click', (e) => { if (e.target === el.confirmOverlay) closeConfirmModal(); });

    document.addEventListener('keydown', (e) => { 
      if (e.key === 'Escape') {
        closeModal();
        closeConfirmModal();
      }
    });

    el.emojiGrid.addEventListener('click', (e) => {
      const b = e.target.closest('.emoji-btn');
      if (!b) return;
      selectedEmoji = b.dataset.emoji;
      renderEmojis();
    });

    el.colorGrid.addEventListener('click', (e) => {
      const b = e.target.closest('.color-btn');
      if (!b) return;
      selectedColor = b.dataset.color;
      renderColors();
    });

    el.modalSubmitBtn.addEventListener('click', () => {
      const name = el.catNameInput.value.trim();
      if (!name) { toast('error', 'Enter a category name'); el.catNameInput.focus(); return; }
      addCategory(name, selectedEmoji, selectedColor);
      closeModal();
    });

    el.catNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.modalSubmitBtn.click(); }
    });

    // Delegated events on document
    document.addEventListener('click', (e) => {
      // Toggle add-task form
      const toggleBtn = e.target.closest('[data-toggle-form]');
      if (toggleBtn) {
        const form = document.getElementById('form-' + toggleBtn.dataset.toggleForm);
        if (form) {
          form.classList.toggle('visible');
          if (form.classList.contains('visible')) {
            form.querySelector('[data-field="title"]').focus();
          }
        }
        return;
      }

      // Cancel form
      const cancelBtn = e.target.closest('[data-cancel-form]');
      if (cancelBtn) {
        const form = document.getElementById('form-' + cancelBtn.dataset.cancelForm);
        if (form) form.classList.remove('visible');
        return;
      }

      // Delete task
      const delTask = e.target.closest('[data-delete-task]');
      if (delTask) {
        deleteTask(delTask.dataset.delCat, delTask.dataset.deleteTask);
        return;
      }

      // Delete category
      const delCat = e.target.closest('[data-delete-cat]');
      if (delCat) {
        deleteCategory(delCat.dataset.deleteCat);
        return;
      }
    });

    // Checkbox change (complete task)
    document.addEventListener('change', (e) => {
      if (e.target.dataset.check) {
        completeTask(e.target.dataset.cat, e.target.dataset.check);
      }
    });

    // Form submit (add task)
    document.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-cat-form]');
      if (!form) return;
      e.preventDefault();
      const catId = form.dataset.catForm;
      const title = form.querySelector('[data-field="title"]').value.trim();
      const desc = form.querySelector('[data-field="desc"]').value.trim();
      const priority = form.querySelector('[data-field="priority"]').value;
      const status = form.querySelector('[data-field="status"]').value;
      if (!title) return;
      addTask(catId, title, desc, priority, status);
      form.querySelector('[data-field="title"]').value = '';
      form.querySelector('[data-field="desc"]').value = '';
      form.classList.remove('visible');
    });
  }

  // ---- Init ----
  function init() {
    load();
    setDateUI();
    render();
    setupEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
