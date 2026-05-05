// ============================================================
// USER DASHBOARD MODULE
// ============================================================

async function initDashboard() {
  if (!currentUser || !currentUserData) return;
  renderDashboardProfile();
  loadUserBill();
  loadPaymentHistory();
  showDashTab('overview');
}

// ── Profile ───────────────────────────────────────────────────
function renderDashboardProfile() {
  const u = currentUserData;
  if (!u) return;
  // Sidebar
  const el = id => document.getElementById(id);
  if (el('dash-avatar')) el('dash-avatar').textContent = getInitials(u.name);
  if (el('dash-name')) el('dash-name').textContent = u.name;
  if (el('dash-cid')) el('dash-cid').textContent = `धारा नं: ${u.customerId}`;

  // Profile tab
  if (el('profile-name')) el('profile-name').value = u.name || '';
  if (el('profile-cid')) el('profile-cid').value = u.customerId || '';
  if (el('profile-address')) el('profile-address').value = u.address || '';
  if (el('profile-phone')) el('profile-phone').value = u.phone || '';
  if (el('profile-email')) el('profile-email').value = u.email || '';
  if (el('profile-since')) el('profile-since').textContent = formatDateEN(u.createdAt);
}

// ── Update Profile ────────────────────────────────────────────
document.getElementById('profile-update-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('profile-update-btn');
  const name = document.getElementById('profile-name').value.trim();
  const address = document.getElementById('profile-address').value.trim();
  const phone = document.getElementById('profile-phone').value.trim();

  if (!name || !address || !phone) {
    showToast('सबै फिल्ड भर्नुहोस्', 'warning'); return;
  }
  setLoading(btn, true);
  try {
    await db.collection('users').doc(currentUser.uid).update({ name, address, phone });
    currentUserData = { ...currentUserData, name, address, phone };
    renderDashboardProfile();
    showToast('प्रोफाइल अपडेट भयो', 'success');
  } catch (e) {
    showToast('अपडेट गर्न समस्या भयो', 'error');
  } finally {
    setLoading(btn, false);
  }
});

// ── Load Current Bill ─────────────────────────────────────────
async function loadUserBill() {
  const u = currentUserData;
  if (!u) return;
  const el = id => document.getElementById(id);

  // Overview card
  if (el('overview-bill-status')) el('overview-bill-status').textContent = 'लोड हुँदैछ...';

  try {
    const snap = await db.collection('bills')
      .where('customerId', '==', u.customerId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) {
      if (el('dash-bill-card')) el('dash-bill-card').innerHTML = `
        <div class="table-empty">📋 कुनै बिल उपलब्ध छैन</div>`;
      if (el('overview-bill-status')) el('overview-bill-status').textContent = 'कुनै बिल छैन';
      return;
    }

    const billDoc = snap.docs[0];
    const bill = { id: billDoc.id, ...billDoc.data() };
    window.currentBill = bill;
    renderBillCard(bill);
    updateOverviewStats(bill);
  } catch (e) {
    if (el('dash-bill-card')) el('dash-bill-card').innerHTML =
      `<div class="table-empty" style="color:var(--danger)">बिल लोड गर्न समस्या भयो</div>`;
  }
}

function renderBillCard(bill) {
  const el = id => document.getElementById(id);
  const statusBadge = bill.status === 'paid'
    ? '<span class="badge badge-paid">✓ भुक्तानी भयो</span>'
    : '<span class="badge badge-unpaid">⚠ बाँकी</span>';
  const card = el('dash-bill-card');
  if (!card) return;
  card.innerHTML = `
    <div class="bill-result">
      <div class="bill-result-header">
        <span>📄 हालको बिल — ${bill.month || ''}</span>
        ${statusBadge}
      </div>
      <div class="bill-result-body">
        <div class="bill-field">
          <span class="bill-field-label">ग्राहकको नाम</span>
          <span class="bill-field-value">${bill.customerName}</span>
        </div>
        <div class="bill-field">
          <span class="bill-field-label">धारा नं</span>
          <span class="bill-field-value" style="font-family:var(--font-mono)">${bill.customerId}</span>
        </div>
        <div class="bill-field">
          <span class="bill-field-label">बिल रकम</span>
          <span class="bill-field-value" style="color:var(--blue-deep);font-size:1.2rem;font-weight:800">${formatCurrency(bill.amount)}</span>
        </div>
        <div class="bill-field">
          <span class="bill-field-label">म्याद</span>
          <span class="bill-field-value">${formatDate(bill.dueDate)}</span>
        </div>
        ${bill.status === 'unpaid' ? `
        <div class="mt-16">
          <button class="btn btn-primary w-full" onclick="openPaymentModal()">
            💳 भुक्तानी गर्नुहोस्
          </button>
        </div>` : `
        <div class="mt-16">
          <button class="btn btn-blue w-full" onclick="viewReceipt('${bill.id}')">
            🧾 रसिद हेर्नुहोस्
          </button>
        </div>`}
      </div>
    </div>`;
}

function updateOverviewStats(bill) {
  const el = id => document.getElementById(id);
  if (el('overview-bill-status')) {
    el('overview-bill-status').textContent = bill.status === 'paid' ? 'भुक्तानी भयो' : 'बाँकी';
    el('overview-bill-status').style.color = bill.status === 'paid' ? 'var(--success)' : 'var(--danger)';
  }
  if (el('overview-bill-amount')) el('overview-bill-amount').textContent = formatCurrency(bill.amount);
  if (el('overview-due-date')) el('overview-due-date').textContent = formatDate(bill.dueDate);
}

// ── Payment History ───────────────────────────────────────────
async function loadPaymentHistory() {
  const u = currentUserData;
  if (!u) return;
  const tbody = document.getElementById('payment-history-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="table-empty">लोड हुँदैछ...</td></tr>`;

  try {
    const snap = await db.collection('payments')
      .where('userId', '==', currentUser.uid)
      .orderBy('paidAt', 'desc')
      .limit(20)
      .get();

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">📋 कुनै भुक्तानी इतिहास छैन</td></tr>`;
      if (document.getElementById('overview-total-paid'))
        document.getElementById('overview-total-paid').textContent = formatCurrency(0);
      return;
    }

    let totalPaid = 0;
    tbody.innerHTML = snap.docs.map(doc => {
      const p = doc.data();
      totalPaid += p.amount || 0;
      const methodIcons = { esewa: '🟢', fonepay: '🔵', connectips: '🟡' };
      return `<tr>
        <td style="font-family:var(--font-mono);font-size:0.78rem">${p.transactionId}</td>
        <td>${formatCurrency(p.amount)}</td>
        <td>${methodIcons[p.method] || '💳'} ${(p.method || '').toUpperCase()}</td>
        <td>${formatDateEN(p.paidAt)}</td>
        <td>
          <button class="btn btn-sm btn-blue" onclick="downloadReceiptById('${doc.id}')">⬇ रसिद</button>
        </td>
      </tr>`;
    }).join('');

    if (document.getElementById('overview-total-paid'))
      document.getElementById('overview-total-paid').textContent = formatCurrency(totalPaid);
    if (document.getElementById('overview-payment-count'))
      document.getElementById('overview-payment-count').textContent = snap.size;
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty" style="color:var(--danger)">डाटा लोड गर्न समस्या भयो</td></tr>`;
  }
}

// ── Payment Modal ─────────────────────────────────────────────
function openPaymentModal() {
  if (!window.currentBill) { showToast('बिल फेला परेन', 'error'); return; }
  const el = id => document.getElementById(id);
  if (el('pay-bill-amount')) el('pay-bill-amount').textContent = formatCurrency(window.currentBill.amount);
  if (el('pay-bill-name')) el('pay-bill-name').textContent = window.currentBill.customerName;
  openModal('payment-modal');
}

async function processPayment(method) {
  if (!window.currentBill || !currentUser) return;
  const bill = window.currentBill;
  const overlay = document.getElementById('payment-processing');
  if (overlay) overlay.classList.remove('hidden');

  const methodNames = { esewa: 'eSewa', fonepay: 'Fonepay', connectips: 'Connect IPS' };

  // Simulate payment gateway delay
  await new Promise(r => setTimeout(r, 2000));

  const txnId = generateTxnId();
  const now = firebase.firestore.FieldValue.serverTimestamp();

  try {
    const batch = db.batch();

    // Save payment record
    const payRef = db.collection('payments').doc();
    batch.set(payRef, {
      userId: currentUser.uid,
      billId: bill.id,
      customerId: bill.customerId,
      customerName: bill.customerName,
      address: currentUserData?.address || '',
      amount: bill.amount,
      method: method,
      transactionId: txnId,
      month: bill.month || '',
      paidAt: now,
      receiptUrl: '',
    });

    // Update bill status
    batch.update(db.collection('bills').doc(bill.id), {
      status: 'paid',
      paidAt: now,
      transactionId: txnId
    });

    await batch.commit();

    // Update local state
    window.currentBill.status = 'paid';
    window.currentBill.transactionId = txnId;

    if (overlay) overlay.classList.add('hidden');
    closeModal('payment-modal');

    // Show receipt
    showReceiptModal({
      name: bill.customerName,
      customerId: bill.customerId,
      address: currentUserData?.address,
      amount: bill.amount,
      method: methodNames[method],
      transactionId: txnId,
      month: bill.month,
      date: new Date().toLocaleString('en-US')
    });

    showToast(`${methodNames[method]} मार्फत भुक्तानी सफल भयो! 🎉`, 'success');
    loadUserBill();
    loadPaymentHistory();
  } catch (err) {
    if (overlay) overlay.classList.add('hidden');
    showToast('भुक्तानी गर्न समस्या भयो: ' + err.message, 'error');
  }
}

// ── Receipt Modal ─────────────────────────────────────────────
function showReceiptModal(data) {
  document.getElementById('receipt-content').innerHTML = generateReceiptHTML(data);
  openModal('receipt-modal');
}

function generateReceiptHTML(data) {
  return `
    <div class="receipt-wrap" id="printable-receipt">
      <div class="receipt-header">
        <div style="font-size:2rem; margin-bottom:8px">💧</div>
        <div class="receipt-org">रामनगर खानेपानी उपभोक्ता तथा सरसफाई समिति</div>
        <div style="font-size:0.75rem; color:var(--gray-500)">ईश्वरपुर नगरपालिका-९, रामनगर, सर्लाही, नेपाल</div>
        <div class="receipt-title" style="margin-top:8px">भुक्तानी रसिद / Payment Receipt</div>
      </div>
      <div style="text-align:left">
        <div class="receipt-row"><span>ग्राहकको नाम:</span><span style="font-weight:600">${data.name}</span></div>
        <div class="receipt-row"><span>धारा नं:</span><span style="font-family:var(--font-mono)">${data.customerId}</span></div>
        <div class="receipt-row"><span>ठेगाना:</span><span>${data.address || ''}</span></div>
        <div class="receipt-row"><span>महिना:</span><span>${data.month || ''}</span></div>
        <div class="receipt-row"><span>भुक्तानी विधि:</span><span>${data.method}</span></div>
        <div class="receipt-row"><span>मिति:</span><span>${data.date}</span></div>
        <div class="receipt-total">
          <span>कुल रकम</span>
          <span>${formatCurrency(data.amount)}</span>
        </div>
      </div>
      <div class="receipt-tid">
        Transaction ID: ${data.transactionId}
      </div>
      <div style="font-size:0.72rem; color:var(--gray-400); margin-top:8px">
        ✅ भुक्तानी प्रमाणित
      </div>
    </div>`;
}

async function downloadReceiptById(paymentId) {
  try {
    const doc = await db.collection('payments').doc(paymentId).get();
    if (!doc.exists) { showToast('रसिद फेला परेन', 'error'); return; }
    const p = doc.data();
    showReceiptModal({
      name: p.customerName,
      customerId: p.customerId,
      address: p.address,
      amount: p.amount,
      method: (p.method || '').toUpperCase(),
      transactionId: p.transactionId,
      month: p.month,
      date: formatDateEN(p.paidAt)
    });
  } catch (e) {
    showToast('रसिद लोड गर्न समस्या भयो', 'error');
  }
}

function printReceipt() {
  const content = document.getElementById('printable-receipt')?.outerHTML;
  if (!content) return;
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html>
    <head>
      <title>Receipt - Ramnagar Water</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi&family=Nunito:wght@400;600;700;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Nunito', sans-serif; padding: 40px; }
        .receipt-wrap { max-width: 400px; margin: 0 auto; border: 2px dashed #cbd5e1; padding: 32px 24px; border-radius: 12px; }
        .receipt-header { text-align: center; border-bottom: 2px solid #0d2b5e; padding-bottom: 16px; margin-bottom: 20px; }
        .receipt-org { font-family: 'Tiro Devanagari Hindi', serif; font-size: 1rem; font-weight: 700; color: #0d2b5e; }
        .receipt-title { font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
        .receipt-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.85rem; border-bottom: 1px dotted #e2e8f0; }
        .receipt-total { background: #0d2b5e; color: white; padding: 12px 16px; display: flex; justify-content: space-between; font-weight: 700; margin-top: 12px; font-size: 1.1rem; border-radius: 8px; }
        .receipt-tid { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #94a3b8; margin-top: 16px; text-align: center; }
      </style>
    </head>
    <body>${content}</body>
    </html>`);
  win.document.close();
  win.print();
}
