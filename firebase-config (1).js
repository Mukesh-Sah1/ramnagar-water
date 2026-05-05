// ============================================================
// Firebase Configuration
// REPLACE these values with your actual Firebase project config
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAD19OmiNWLlTFmyTURwFLhQnHvlZ2GqTY",
  authDomain: "ramnagar-water.firebaseapp.com",
  projectId: "ramnagar-water",
  storageBucket: "ramnagar-water.firebasestorage.app",
  messagingSenderId: "57232725135",
  appId: "1:57232725135:web:47e2097fcb1cd75584ccfa",
  measurementId: "G-EQFNB9C8ZK"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Service references
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ============================================================
// Firestore Data Structure Reference:
//
// users/{userId}
//   - name: string
//   - customerId: string (धारा नं)
//   - address: string
//   - phone: string
//   - email: string
//   - role: "user" | "admin"
//   - createdAt: timestamp
//
// bills/{billId}
//   - userId: string
//   - customerId: string
//   - customerName: string
//   - amount: number
//   - dueDate: timestamp
//   - month: string (e.g., "2081-Baisakh")
//   - status: "paid" | "unpaid"
//   - createdAt: timestamp
//
// payments/{paymentId}
//   - userId: string
//   - billId: string
//   - customerId: string
//   - customerName: string
//   - amount: number
//   - method: "esewa" | "fonepay" | "connectips"
//   - transactionId: string
//   - receiptUrl: string
//   - paidAt: timestamp
//
// admins/{userId}
//   - email: string
//   - name: string
//
// members/{memberId}
//   - name: string
//   - position: string
//   - address: string
//   - phone: string
//   - email: string
// ============================================================
