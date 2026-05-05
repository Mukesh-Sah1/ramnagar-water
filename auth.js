// ============================================================
// AUTHENTICATION MODULE
// ============================================================

let currentUser = null;
let currentUserData = null;

// ── Auth State Observer ──────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  hideLoadingScreen();
  if (user) {
    currentUser = user;
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        currentUserData = userDoc.data();
        updateHeaderForLoggedIn(currentUserData);
        // redirect based on current page if needed
        const activePage = document.querySelector('.page.active')?.id;
        if (activePage === 'page-auth') {
          if (currentUserData.role === 'admin') {
            showPage('admin');
            initAdminPanel();
          } else {
            showPage('dashboard');
            initDashboard();
          }
        }
      } else {
        // Profile incomplete, sign out
        await auth.signOut();
        currentUser = null;
        currentUserData = null;
      }
    } catch (e) {
      console.error('Auth state error:', e);
    }
  } else {
    currentUser = null;
    currentUserData = null;
    updateHeaderForLoggedOut();
  }
});

// ── Update Header ─────────────────────────────────────────────
function updateHeaderForLoggedIn(userData) {
  const logoutBtn = document.getElementById('header-logout');
  const loginBtn = document.getElementById('header-login');
  const dashBtn = document.getElementById('header-dashboard');
  if (loginBtn) loginBtn.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = '';
  if (dashBtn) {
    dashBtn.style.display = '';
    dashBtn.textContent = userData.role === 'admin' ? '⚙️ Admin' : '📊 Dashboard';
    dashBtn.onclick = () => {
      if (userData.role === 'admin') {
        showPage('admin'); initAdminPanel();
      } else {
        showPage('dashboard'); initDashboard();
      }
    };
  }
}
function updateHeaderForLoggedOut() {
  const logoutBtn = document.getElementById('header-logout');
  const loginBtn = document.getElementById('header-login');
  const dashBtn = document.getElementById('header-dashboard');
  if (loginBtn) loginBtn.style.display = '';
  if (logoutBtn) logoutBtn.style.display = 'none';
  if (dashBtn) dashBtn.style.display = 'none';
}

// ── Auth Tab Switching ────────────────────────────────────────
function setupAuthTabs() {
  const loginTab = document.getElementById('auth-tab-login');
  const registerTab = document.getElementById('auth-tab-register');
  const loginForm = document.getElementById('auth-login-form');
  const registerForm = document.getElementById('auth-register-form');

  loginTab?.addEventListener('click', () => {
    loginTab.classList.add('active'); registerTab.classList.remove('active');
    loginForm.style.display = ''; registerForm.style.display = 'none';
  });
  registerTab?.addEventListener('click', () => {
    registerTab.classList.add('active'); loginTab.classList.remove('active');
    registerForm.style.display = ''; loginForm.style.display = 'none';
  });
}

// ── LOGIN ─────────────────────────────────────────────────────
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');

  if (!email || !password) {
    errEl.textContent = 'सबै फिल्ड भर्नुहोस्'; errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');
  setLoading(btn, true);

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const userDoc = await db.collection('users').doc(cred.user.uid).get();
    if (!userDoc.exists) throw new Error('User profile not found');
    const userData = userDoc.data();
    currentUserData = userData;
    showToast('सफलतापूर्वक लगइन भयो! 🎉', 'success');
    if (userData.role === 'admin') {
      showPage('admin'); initAdminPanel();
    } else {
      showPage('dashboard'); initDashboard();
    }
  } catch (err) {
    errEl.textContent = translateFirebaseError(err.code) || err.message;
    errEl.classList.remove('hidden');
  } finally {
    setLoading(btn, false);
  }
});

// ── REGISTER ──────────────────────────────────────────────────
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('register-btn');
  const errEl = document.getElementById('register-error');

  const name = document.getElementById('reg-name').value.trim();
  const customerId = document.getElementById('reg-customer-id').value.trim();
  const address = document.getElementById('reg-address').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;

  if (!name || !customerId || !address || !phone || !email || !password || !confirm) {
    errEl.textContent = 'सबै फिल्ड भर्नुहोस्'; errEl.classList.remove('hidden'); return;
  }
  if (password !== confirm) {
    errEl.textContent = 'पासवर्ड मेल खाएन'; errEl.classList.remove('hidden'); return;
  }
  if (password.length < 6) {
    errEl.textContent = 'पासवर्ड कम्तिमा ६ अक्षरको हुनुपर्छ'; errEl.classList.remove('hidden'); return;
  }
  if (!/^[0-9\-]+$/.test(customerId)) {
    errEl.textContent = 'धारा नं मान्य छैन'; errEl.classList.remove('hidden'); return;
  }

  errEl.classList.add('hidden');
  setLoading(btn, true);

  try {
    // Check if customer ID exists in bills/users
    const existing = await db.collection('users').where('customerId', '==', customerId).get();
    if (!existing.empty) {
      throw new Error('यो धारा नं पहिले नै दर्ता भइसकेको छ');
    }

    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });

    await db.collection('users').doc(cred.user.uid).set({
      name, customerId, address, phone, email,
      role: 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast('सफलतापूर्वक दर्ता भयो! 🎉', 'success');
    showPage('dashboard');
    initDashboard();
  } catch (err) {
    errEl.textContent = translateFirebaseError(err.code) || err.message;
    errEl.classList.remove('hidden');
  } finally {
    setLoading(btn, false);
  }
});

// ── LOGOUT ────────────────────────────────────────────────────
async function logout() {
  try {
    await auth.signOut();
    currentUser = null; currentUserData = null;
    showPage('home');
    showToast('लगआउट भयो', 'info');
  } catch (e) {
    showToast('लगआउट गर्न समस्या भयो', 'error');
  }
}

// ── Error Translation ─────────────────────────────────────────
function translateFirebaseError(code) {
  const errors = {
    'auth/user-not-found': 'इमेल फेला परेन',
    'auth/wrong-password': 'पासवर्ड गलत छ',
    'auth/email-already-in-use': 'यो इमेल पहिले नै प्रयोगमा छ',
    'auth/invalid-email': 'मान्य इमेल ठेगाना राख्नुहोस्',
    'auth/too-many-requests': 'धेरै प्रयास भयो, केही समय पछि फेरि प्रयास गर्नुहोस्',
    'auth/weak-password': 'पासवर्ड कमजोर छ, कम्तिमा ६ अक्षरको हुनुपर्छ',
    'auth/network-request-failed': 'इन्टरनेट जडान समस्या',
  };
  return errors[code] || null;
}
