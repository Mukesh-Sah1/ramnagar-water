// ============================================================
// ADMIN PANEL MODULE
// ============================================================

async function initAdminPanel() {
  if (!currentUser || !currentUserData || currentUserData.role !== 'admin') {
    showPage('home');
    showToast('एडमिन पहुँच आवश्यक छ', 'error');
    return;
  }
  await loadAdminStats();
  loadAdminCustomers();
  loadAdminBills();
  loadAdminPayments();
  loadAdminMembers();
  showAdminTab('dashboard');
}

// ── Admin Stats ───────────────────────────────────────────────
async function loadAdminStats() {
  try {
    const [usersSnap, billsSnap, paymentsSnap] = await Promise.all([
      db.collection('users').where('role', '==', 'user').get(),
      db.collection('bills').get(),
      db.collection('payments').get()
    ]);
    const unpaid = billsSnap.docs.filter(d => d.data().status === 'unpaid').length;
    const totalCollection = paymentsSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);

    const el = id => document.getElementById(id);
    if (el('astat-users')) el('astat-users').textContent = usersSnap.size;
    if (el('astat-payments')) el('astat-payments').textContent = formatCurrency(totalCollection);
    if (el('astat-pending')) el('astat-pending').textContent = unpaid;
    if (el('astat-transactions')) el('astat-transactions').textContent = paymentsSnap.size;
  } catch (e) { console.error('Admin stats error:', e); }
}

// ── Customer Management ───────────────────────────────────────
async function loadAdminCustomers(search = '') {
  const tbody = document.getElementById('admin-customers-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="table-empty">लोड हुँदैछ...</td></tr>`;
  try {
    let query = db.collection('users').where('role', '==', 'user').orderBy('createdAt', 'desc');
    const snap = await query.get();
    let docs = snap.docs;
    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter(d => {
        const u = d.data();
        return u.name?.toLowerCase().includes(s) || u.customerId?.includes(s) || u.address?.toLowerCase().includes(s);
      });
    }
    if (docs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">कुनै ग्राहक फेला परेन</td></tr>`;
      return;
    }
    tbody.innerHTML = docs.map(doc => {
      const u = doc.data();
      return `<tr>
        <td style="font-family:var(--font-mono);font-weight:600">${u.customerId}</td>
        <td style="font-family:var(--font-nepali)">${u.name}</td>
        <td>${u.address}</td>
        <td>${u.phone}</td>
        <td>${u.email}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-blue" onclick="editCustomer('${doc.id}')">✏️ सम्पादन</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCustomer('${doc.id}','${u.name}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty" style="color:var(--danger)">डाटा लोड गर्न समस्या भयो</td></tr>`;
  }
}

// Add Customer
document.getElementById('add-customer-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit]');
  const name = document.getElementById('ac-name').value.trim();
  const customerId = document.getElementById('ac-cid').value.trim();
  const address = document.getElementById('ac-address').value.trim();
  const phone = document.getElementById('ac-phone').value.trim();
  const email = document.getElementById('ac-email').value.trim();
  const password = document.getElementById('ac-password').value;

  if (!name || !customerId || !address || !phone || !email || !password) {
    showToast('सबै फिल्ड भर्नुहोस्', 'warning'); return;
  }
  setLoading(btn, true);
  try {
    // Check duplicate customer ID
    const existing = await db.collection('users').where('customerId', '==', customerId).get();
    if (!existing.empty) throw new Error('यो धारा नं पहिले नै प्रयोगमा छ');

    // Create Firebase Auth user
    const secondaryApp = firebase.initializeApp(firebase.apps[0].options, 'secondary');
    const secAuth = secondaryApp.auth();
    const cred = await secAuth.createUserWithEmailAndPassword(email, password);
    await secAuth.signOut();
    secondaryApp.delete();

    await db.collection('users').doc(cred.user.uid).set({
      name, customerId, address, phone, email,
      role: 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeModal('add-customer-modal');
    e.target.reset();
    loadAdminCustomers();
    loadAdminStats();
    showToast('ग्राहक सफलतापूर्वक थपियो', 'success');
  } catch (err) {
    showToast('त्रुटि: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
});

async function editCustomer(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) { showToast('ग्राहक फेला परेन', 'error'); return; }
    const u = doc.data();
    document.getElementById('ec-uid').value = uid;
    document.getElementById('ec-name').value = u.name || '';
    document.getElementById('ec-cid').value = u.customerId || '';
    document.getElementById('ec-address').value = u.address || '';
    document.getElementById('ec-phone').value = u.phone || '';
    openModal('edit-customer-modal');
  } catch (e) { showToast('त्रुटि: ' + e.message, 'error'); }
}

document.getElementById('edit-customer-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit]');
  const uid = document.getElementById('ec-uid').value;
  const name = document.getElementById('ec-name').value.trim();
  const address = document.getElementById('ec-address').value.trim();
  const phone = document.getElementById('ec-phone').value.trim();
  if (!name || !address || !phone) { showToast('सबै फिल्ड भर्नुहोस्', 'warning'); return; }
  setLoading(btn, true);
  try {
    await db.collection('users').doc(uid).update({ name, address, phone });
    closeModal('edit-customer-modal');
    loadAdminCustomers();
    showToast('ग्राहक जानकारी अपडेट भयो', 'success');
  } catch (err) {
    showToast('त्रुटि: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
});

async function deleteCustomer(uid, name) {
  if (!confirm(`के तपाईं "${name}" लाई मेटाउन चाहनुहुन्छ?`)) return;
  try {
    await db.collection('users').doc(uid).delete();
    loadAdminCustomers();
    loadAdminStats();
    showToast('ग्राहक मेटाइयो', 'info');
  } catch (e) { showToast('मेटाउन समस्या भयो: ' + e.message, 'error'); }
}

// Customer search
document.getElementById('customer-search')?.addEventListener('input', (e) => {
  loadAdminCustomers(e.target.value);
});

// ── Bill Management ───────────────────────────────────────────
async function loadAdminBills(search = '') {
  const tbody = document.getElementById('admin-bills-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="table-empty">लोड हुँदैछ...</td></tr>`;
  try {
    const snap = await db.collection('bills').orderBy('createdAt', 'desc').get();
    let docs = snap.docs;
    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter(d => {
        const b = d.data();
        return b.customerName?.toLowerCase().includes(s) || b.customerId?.includes(s);
      });
    }
    if (docs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">कुनै बिल फेला परेन</td></tr>`;
      return;
    }
    tbody.innerHTML = docs.map(doc => {
      const b = doc.data();
      const statusBadge = b.status === 'paid'
        ? '<span class="badge badge-paid">भुक्तानी</span>'
        : '<span class="badge badge-unpaid">बाँकी</span>';
      return `<tr>
        <td style="font-family:var(--font-mono)">${b.customerId}</td>
        <td style="font-family:var(--font-nepali)">${b.customerName}</td>
        <td>${b.month || ''}</td>
        <td style="font-weight:700;color:var(--blue-deep)">${formatCurrency(b.amount)}</td>
        <td>${statusBadge}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-blue" onclick="editBill('${doc.id}')">✏️</button>
          <button class="btn btn-sm btn-success" onclick="toggleBillStatus('${doc.id}','${b.status}')">
            ${b.status === 'paid' ? '↩ Unpaid' : '✓ Paid'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteBill('${doc.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty" style="color:var(--danger)">डाटा लोड गर्न समस्या भयो</td></tr>`;
  }
}

// Create Bill
document.getElementById('create-bill-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit]');
  const customerId = document.getElementById('cb-cid').value.trim();
  const amount = parseFloat(document.getElementById('cb-amount').value);
  const month = document.getElementById('cb-month').value.trim();
  const dueDate = document.getElementById('cb-due-date').value;

  if (!customerId || !amount || !month || !dueDate) {
    showToast('सबै फिल्ड भर्नुहोस्', 'warning'); return;
  }
  setLoading(btn, true);
  try {
    // Look up customer
    const userSnap = await db.collection('users').where('customerId', '==', customerId).get();
    if (userSnap.empty) throw new Error('धारा नं फेला परेन');
    const userData = userSnap.docs[0].data();

    await db.collection('bills').add({
      customerId,
      userId: userSnap.docs[0].id,
      customerName: userData.name,
      address: userData.address,
      amount,
      month,
      dueDate: firebase.firestore.Timestamp.fromDate(new Date(dueDate)),
      status: 'unpaid',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    closeModal('create-bill-modal');
    e.target.reset();
    loadAdminBills();
    loadAdminStats();
    showToast('बिल सफलतापूर्वक सिर्जना भयो', 'success');
  } catch (err) {
    showToast('त्रुटि: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
});

async function editBill(billId) {
  try {
    const doc = await db.collection('bills').doc(billId).get();
    if (!doc.exists) { showToast('बिल फेला परेन', 'error'); return; }
    const b = doc.data();
    document.getElementById('eb-id').value = billId;
    document.getElementById('eb-amount').value = b.amount;
    document.getElementById('eb-month').value = b.month || '';
    const dd = b.dueDate?.toDate?.();
    if (dd) document.getElementById('eb-due-date').value = dd.toISOString().split('T')[0];
    openModal('edit-bill-modal');
  } catch (e) { showToast('त्रुटि: ' + e.message, 'error'); }
}

document.getElementById('edit-bill-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit]');
  const billId = document.getElementById('eb-id').value;
  const amount = parseFloat(document.getElementById('eb-amount').value);
  const month = document.getElementById('eb-month').value.trim();
  const dueDate = document.getElementById('eb-due-date').value;
  if (!amount || !month || !dueDate) { showToast('सबै फिल्ड भर्नुहोस्', 'warning'); return; }
  setLoading(btn, true);
  try {
    await db.collection('bills').doc(billId).update({
      amount,
      month,
      dueDate: firebase.firestore.Timestamp.fromDate(new Date(dueDate))
    });
    closeModal('edit-bill-modal');
    loadAdminBills();
    showToast('बिल अपडेट भयो', 'success');
  } catch (err) {
    showToast('त्रुटि: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
});

async function toggleBillStatus(billId, currentStatus) {
  const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
  try {
    await db.collection('bills').doc(billId).update({ status: newStatus });
    loadAdminBills();
    loadAdminStats();
    showToast(`बिल ${newStatus === 'paid' ? 'भुक्तानी' : 'बाँकी'} चिन्हित भयो`, 'success');
  } catch (e) { showToast('त्रुटि: ' + e.message, 'error'); }
}

async function deleteBill(billId) {
  if (!confirm('के तपाईं यो बिल मेटाउन चाहनुहुन्छ?')) return;
  try {
    await db.collection('bills').doc(billId).delete();
    loadAdminBills(); loadAdminStats();
    showToast('बिल मेटाइयो', 'info');
  } catch (e) { showToast('मेटाउन समस्या: ' + e.message, 'error'); }
}

document.getElementById('bill-search')?.addEventListener('input', e => loadAdminBills(e.target.value));

// ── Payment Monitoring ────────────────────────────────────────
async function loadAdminPayments(filter = {}) {
  const tbody = document.getElementById('admin-payments-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="table-empty">लोड हुँदैछ...</td></tr>`;
  try {
    let query = db.collection('payments').orderBy('paidAt', 'desc').limit(100);
    const snap = await query.get();
    let docs = snap.docs;

    if (filter.search) {
      const s = filter.search.toLowerCase();
      docs = docs.filter(d => {
        const p = d.data();
        return p.customerName?.toLowerCase().includes(s) || p.customerId?.includes(s) || p.transactionId?.includes(s);
      });
    }
    if (filter.date) {
      const fd = new Date(filter.date);
      docs = docs.filter(d => {
        const p = d.data();
        if (!p.paidAt) return false;
        const pd = p.paidAt.toDate();
        return pd.toDateString() === fd.toDateString();
      });
    }
    if (docs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">कुनै भुक्तानी फेला परेन</td></tr>`;
      return;
    }
    const methodIcons = { esewa: '🟢', fonepay: '🔵', connectips: '🟡' };
    tbody.innerHTML = docs.map(doc => {
      const p = doc.data();
      return `<tr>
        <td style="font-family:var(--font-mono);font-size:0.78rem">${p.transactionId}</td>
        <td style="font-family:var(--font-nepali)">${p.customerName}</td>
        <td style="font-family:var(--font-mono)">${p.customerId}</td>
        <td style="font-weight:700;color:var(--blue-deep)">${formatCurrency(p.amount)}</td>
        <td>${methodIcons[p.method] || '💳'} ${(p.method||'').toUpperCase()}</td>
        <td>${formatDateEN(p.paidAt)}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty" style="color:var(--danger)">डाटा लोड गर्न समस्या</td></tr>`;
  }
}

document.getElementById('payment-filter-search')?.addEventListener('input', e => {
  loadAdminPayments({ search: e.target.value, date: document.getElementById('payment-filter-date')?.value });
});
document.getElementById('payment-filter-date')?.addEventListener('change', e => {
  loadAdminPayments({ date: e.target.value, search: document.getElementById('payment-filter-search')?.value });
});

// ── Members (Admin) ───────────────────────────────────────────
async function loadAdminMembers() {
  const tbody = document.getElementById('admin-members-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="table-empty">लोड हुँदैछ...</td></tr>`;
  try {
    const snap = await db.collection('members').orderBy('order').get();
    if (snap.empty) { tbody.innerHTML = `<tr><td colspan="5" class="table-empty">कुनै सदस्य छैन</td></tr>`; return; }
    tbody.innerHTML = snap.docs.map(doc => {
      const m = doc.data();
      return `<tr>
        <td style="font-family:var(--font-nepali);font-weight:600">${m.name}</td>
        <td style="font-family:var(--font-nepali)">${m.position}</td>
        <td>${m.address}</td>
        <td>${m.phone}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-danger" onclick="deleteMember('${doc.id}','${m.name}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty" style="color:var(--danger)">त्रुटि भयो</td></tr>`;
  }
}

document.getElementById('add-member-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit]');
  const name = document.getElementById('am-name').value.trim();
  const position = document.getElementById('am-position').value.trim();
  const address = document.getElementById('am-address').value.trim();
  const phone = document.getElementById('am-phone').value.trim();
  const email = document.getElementById('am-email').value.trim();
  if (!name || !position || !address || !phone) { showToast('सबै फिल्ड भर्नुहोस्', 'warning'); return; }
  setLoading(btn, true);
  try {
    const snap = await db.collection('members').orderBy('order', 'desc').limit(1).get();
    const nextOrder = snap.empty ? 1 : (snap.docs[0].data().order || 0) + 1;
    await db.collection('members').add({ name, position, address, phone, email, order: nextOrder });
    closeModal('add-member-modal');
    e.target.reset();
    loadAdminMembers();
    showToast('सदस्य थपियो', 'success');
  } catch (err) {
    showToast('त्रुटि: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
});

async function deleteMember(id, name) {
  if (!confirm(`"${name}" लाई मेटाउने?`)) return;
  try {
    await db.collection('members').doc(id).delete();
    loadAdminMembers();
    showToast('सदस्य मेटाइयो', 'info');
  } catch (e) { showToast('त्रुटि: ' + e.message, 'error'); }
}

// ── Reports / CSV Export ──────────────────────────────────────
async function exportPaymentsCSV() {
  const btn = document.getElementById('export-csv-btn');
  setLoading(btn, true);
  try {
    const month = document.getElementById('report-month')?.value;
    let query = db.collection('payments').orderBy('paidAt', 'desc');
    const snap = await query.get();
    let docs = snap.docs;
    if (month) {
      docs = docs.filter(d => {
        const p = d.data();
        return p.month === month;
      });
    }
    const headers = ['Transaction ID', 'Customer Name', 'Customer ID', 'Amount (NPR)', 'Method', 'Month', 'Date'];
    const rows = docs.map(doc => {
      const p = doc.data();
      const date = p.paidAt?.toDate?.()?.toLocaleDateString('en-US') || '';
      return [p.transactionId, p.customerName, p.customerId, p.amount, p.method, p.month, date];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ramnagar-water-payments-${month || 'all'}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('CSV निर्यात भयो', 'success');
  } catch (e) {
    showToast('निर्यात गर्न समस्या: ' + e.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function loadMonthlyReport() {
  const month = document.getElementById('report-month')?.value;
  const reportEl = document.getElementById('monthly-report-content');
  if (!reportEl) return;
  reportEl.innerHTML = '<p style="color:var(--gray-400)">लोड हुँदैछ...</p>';
  try {
    let query = db.collection('payments');
    const snap = await query.get();
    let docs = snap.docs;
    if (month) docs = docs.filter(d => d.data().month === month);

    const total = docs.reduce((s, d) => s + (d.data().amount || 0), 0);
    const byMethod = { esewa: 0, fonepay: 0, connectips: 0 };
    docs.forEach(d => {
      const m = d.data().method;
      if (m && byMethod[m] !== undefined) byMethod[m] += d.data().amount || 0;
    });

    reportEl.innerHTML = `
      <div class="info-card mb-16">
        <div class="info-card-icon">💰</div>
        <div class="info-card-value">${formatCurrency(total)}</div>
        <div class="info-card-label">${month ? month : 'कुल'} संकलन</div>
      </div>
      <div style="font-size:0.85rem">
        <div class="bill-field"><span>कुल लेनदेन</span><span style="font-weight:700">${docs.length}</span></div>
        <div class="bill-field"><span>🟢 eSewa</span><span>${formatCurrency(byMethod.esewa)}</span></div>
        <div class="bill-field"><span>🔵 Fonepay</span><span>${formatCurrency(byMethod.fonepay)}</span></div>
        <div class="bill-field"><span>🟡 Connect IPS</span><span>${formatCurrency(byMethod.connectips)}</span></div>
      </div>`;
  } catch (e) {
    reportEl.innerHTML = `<p style="color:var(--danger)">रिपोर्ट लोड गर्न समस्या</p>`;
  }
}
