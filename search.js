// ============================================================
// BILL SEARCH MODULE (Public)
// ============================================================

let searchType = 'id'; // 'id' or 'name'

function setSearchType(type) {
  searchType = type;
  document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.search-tab[data-search="${type}"]`)?.classList.add('active');
  const idField = document.getElementById('search-field-id');
  const nameField = document.getElementById('search-field-name');
  if (type === 'id') {
    idField?.classList.remove('hidden'); nameField?.classList.add('hidden');
  } else {
    nameField?.classList.remove('hidden'); idField?.classList.add('hidden');
  }
  clearBillResult();
}

function clearBillResult() {
  const resultEl = document.getElementById('bill-search-result');
  if (resultEl) resultEl.innerHTML = '';
}

async function searchBill() {
  const btn = document.getElementById('search-bill-btn');
  const resultEl = document.getElementById('bill-search-result');
  let searchValue = '';

  if (searchType === 'id') {
    searchValue = document.getElementById('search-by-id')?.value.trim();
  } else {
    searchValue = document.getElementById('search-by-name')?.value.trim();
  }

  if (!searchValue) {
    showToast('खोज्ने जानकारी भर्नुहोस्', 'warning'); return;
  }
  setLoading(btn, true);
  resultEl.innerHTML = '';

  try {
    let snap;
    if (searchType === 'id') {
      snap = await db.collection('bills')
        .where('customerId', '==', searchValue)
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();
    } else {
      // Search by name (case-sensitive prefix match — Firestore limitation)
      snap = await db.collection('bills')
        .where('customerName', '>=', searchValue)
        .where('customerName', '<=', searchValue + '\uf8ff')
        .orderBy('customerName')
        .limit(5)
        .get();
    }

    if (snap.empty) {
      resultEl.innerHTML = `
        <div class="alert alert-info mt-16">
          ℹ️ खोजेको ग्राहकको बिल फेला परेन।
          <br><small>धारा नं वा नाम सही छ कि भनेर जाँच गर्नुहोस्।</small>
        </div>`;
      return;
    }

    resultEl.innerHTML = snap.docs.map(doc => {
      const bill = doc.data();
      const isPaid = bill.status === 'paid';
      const statusBadge = isPaid
        ? '<span class="badge badge-paid">✓ भुक्तानी भयो</span>'
        : '<span class="badge badge-unpaid">⚠ बाँकी छ</span>';
      const dueDate = bill.dueDate?.toDate ? bill.dueDate.toDate() : null;
      const isOverdue = dueDate && dueDate < new Date() && !isPaid;

      return `
        <div class="bill-result mt-16">
          <div class="bill-result-header">
            <span>📄 बिल — ${bill.month || ''}</span>
            ${statusBadge}
          </div>
          <div class="bill-result-body">
            <div class="bill-field">
              <span class="bill-field-label">ग्राहकको नाम</span>
              <span class="bill-field-value" style="font-family:var(--font-nepali)">${bill.customerName}</span>
            </div>
            <div class="bill-field">
              <span class="bill-field-label">धारा नं</span>
              <span class="bill-field-value" style="font-family:var(--font-mono)">${bill.customerId}</span>
            </div>
            <div class="bill-field">
              <span class="bill-field-label">ठेगाना</span>
              <span class="bill-field-value">${bill.address || 'N/A'}</span>
            </div>
            <div class="bill-field">
              <span class="bill-field-label">बिल रकम</span>
              <span class="bill-field-value" style="color:var(--blue-deep);font-size:1.2rem;font-weight:800">
                ${formatCurrency(bill.amount)}
              </span>
            </div>
            <div class="bill-field">
              <span class="bill-field-label">म्याद</span>
              <span class="bill-field-value" style="color:${isOverdue ? 'var(--danger)' : 'inherit'}">
                ${formatDate(bill.dueDate)}
                ${isOverdue ? ' ⚠️ म्याद नाघेको' : ''}
              </span>
            </div>
            ${isPaid ? `
            <div class="bill-field">
              <span class="bill-field-label">भुक्तानी मिति</span>
              <span class="bill-field-value" style="color:var(--success)">${formatDate(bill.paidAt)}</span>
            </div>` : ''}
            ${!isPaid ? `
            <div class="mt-16 text-center">
              <p style="font-size:0.8rem;color:var(--gray-500);margin-bottom:10px">
                अनलाइन भुक्तानी गर्न लगइन गर्नुहोस्
              </p>
              <button class="btn btn-primary" onclick="showPage('auth')">
                🔐 लगइन गर्नुहोस्
              </button>
            </div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    resultEl.innerHTML = `
      <div class="alert alert-error mt-16">
        ❌ खोज्न समस्या भयो: ${e.message}
      </div>`;
  } finally {
    setLoading(btn, false);
  }
}

// Enter key support
document.getElementById('search-by-id')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') searchBill();
});
document.getElementById('search-by-name')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') searchBill();
});

// Search tab setup
document.querySelectorAll('.search-tab[data-search]').forEach(tab => {
  tab.addEventListener('click', () => setSearchType(tab.dataset.search));
});
