// ============================================================
// CORE UTILITIES
// ============================================================

// ── Toast Notifications ──────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Loading Screen ───────────────────────────────────────────
function hideLoadingScreen() {
  const screen = document.getElementById('loading-screen');
  if (screen) {
    screen.classList.add('hidden');
    setTimeout(() => screen.style.display = 'none', 500);
  }
}

// ── Page Navigation ──────────────────────────────────────────
const pages = ['home', 'auth', 'dashboard', 'admin', 'members', 'contact'];

function showPage(pageId) {
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.remove('active');
  });
  const target = document.getElementById(`page-${pageId}`);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // update nav active state
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageId);
  });
  closeMobileNav();
}

// ── Mobile Nav ───────────────────────────────────────────────
function toggleMobileNav() {
  document.getElementById('mobile-nav').classList.toggle('open');
}
function closeMobileNav() {
  document.getElementById('mobile-nav')?.classList.remove('open');
}

// ── Dashboard Tabs ───────────────────────────────────────────
function showDashTab(tabId) {
  document.querySelectorAll('.dashboard-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sidebar-item[data-tab]').forEach(i => i.classList.remove('active'));
  const tab = document.getElementById(`dash-${tabId}`);
  if (tab) tab.classList.add('active');
  const item = document.querySelector(`.sidebar-item[data-tab="${tabId}"]`);
  if (item) item.classList.add('active');
}

// ── Admin Tabs ───────────────────────────────────────────────
function showAdminTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-item[data-tab]').forEach(i => i.classList.remove('active'));
  const tab = document.getElementById(`admin-${tabId}`);
  if (tab) tab.classList.add('active');
  const item = document.querySelector(`.admin-item[data-tab="${tabId}"]`);
  if (item) item.classList.add('active');
}

// ── Modal ────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ── Helpers ──────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return 'N/A';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ne-NP', { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatDateEN(ts) {
  if (!ts) return 'N/A';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatCurrency(amount) {
  return `रु. ${Number(amount).toLocaleString('ne-NP')}`;
}
function generateTxnId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `RWC-${ts}-${rand}`;
}
function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(n => n[0]).join('').substr(0, 2).toUpperCase();
}
function setLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Loading...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.origText || 'Submit';
  }
}

// ── Sidebar Toggle (mobile) ───────────────────────────────────
function toggleSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('open');
}
function toggleAdminSidebar() {
  document.querySelector('.admin-sidebar')?.classList.toggle('open');
}

// ── Stats Updater (homepage) ──────────────────────────────────
async function loadPublicStats() {
  try {
    const [usersSnap, paymentsSnap] = await Promise.all([
      db.collection('users').where('role', '==', 'user').get(),
      db.collection('payments').get()
    ]);
    const totalUsers = usersSnap.size;
    const totalPayments = paymentsSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
    const el = id => document.getElementById(id);
    if (el('stat-users')) el('stat-users').textContent = totalUsers;
    if (el('stat-payments')) el('stat-payments').textContent = formatCurrency(totalPayments);
  } catch (e) { /* silent fail for public stats */ }
}

// ── Members Loader ───────────────────────────────────────────
async function loadMembers() {
  const grid = document.getElementById('members-grid');
  if (!grid) return;
  grid.innerHTML = '<p style="color:var(--gray-400); font-family:var(--font-nepali);">लोड हुँदैछ...</p>';
  try {
    const snap = await db.collection('members').orderBy('order', 'asc').get();
    if (snap.empty) {
      grid.innerHTML = `<p style="color:var(--gray-400)">कुनै सदस्य फेला परेन</p>`;
      return;
    }
    grid.innerHTML = snap.docs.map(doc => {
      const m = doc.data();
      return `
        <div class="member-card">
          <div class="member-avatar">${getInitials(m.name)}</div>
          <div class="member-info">
            <h3>${m.name || ''}</h3>
            <span class="member-position">${m.position || ''}</span>
            <div class="member-detail">📍 ${m.address || 'N/A'}</div>
            <div class="member-detail">📞 ${m.phone || 'N/A'}</div>
            ${m.email ? `<div class="member-detail">✉️ ${m.email}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    grid.innerHTML = `<p style="color:var(--danger)">डाटा लोड गर्न समस्या भयो</p>`;
  }
}

// ── Nav Link handlers (set up once DOM is ready) ─────────────
function setupNav() {
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      const page = el.dataset.page;
      if (page === 'members') loadMembers();
      showPage(page);
    });
  });
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => {
      if (el.closest('.admin-sidebar, .admin-main')) showAdminTab(el.dataset.tab);
      else showDashTab(el.dataset.tab);
    });
  });
  document.querySelectorAll('[data-modal-open]').forEach(el => {
    el.addEventListener('click', () => openModal(el.dataset.modalOpen));
  });
  document.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', () => closeModal(el.dataset.modalClose));
  });
  // close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
}
