import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

let firestoreInstance: any = null;

async function getDb() {
  if (firestoreInstance) return firestoreInstance;

  // Fetch the client configuration from the backend
  const res = await fetch('/api/config/firebase');
  const config = await res.json();

  if (!config.apiKey) {
    throw new Error('Firebase configuration not available');
  }

  const app = getApps().length === 0 ? initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket
  }) : getApp();

  firestoreInstance = getFirestore(app, config.firestoreDatabaseId || '(default)');
  return firestoreInstance;
}

export function subscribeToUserProfile(userId: string, onUpdate: (user: any) => void, onError?: (err: any) => void) {
  let unsubscribe: (() => void) | null = null;
  let active = true;

  getDb().then(db => {
    if (!active) return;
    const docRef = doc(db, 'users', userId);
    unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data());
      } else {
        onUpdate(null); // Document deleted
      }
    }, (err) => {
      console.error('[Firebase Client] Error listening to user profile:', err);
      if (onError) onError(err);
    });
  }).catch(err => {
    console.error('[Firebase Client] Failed to initialize db for user subscription:', err);
    if (onError) onError(err);
  });

  return () => {
    active = false;
    if (unsubscribe) unsubscribe();
  };
}

export function subscribeToDrivers(onUpdate: (drivers: any[]) => void, onError?: (err: any) => void) {
  let unsubscribe: (() => void) | null = null;
  let active = true;

  getDb().then(db => {
    if (!active) return;
    const colRef = collection(db, 'drivers');
    unsubscribe = onSnapshot(colRef, (snapshot) => {
      const drivers: any[] = [];
      snapshot.forEach(docSnap => {
        drivers.push(docSnap.data());
      });
      onUpdate(drivers);
    }, (err) => {
      console.error('[Firebase Client] Error listening to drivers:', err);
      if (onError) onError(err);
    });
  }).catch(err => {
    console.error('[Firebase Client] Failed to initialize db for drivers subscription:', err);
    if (onError) onError(err);
  });

  return () => {
    active = false;
    if (unsubscribe) unsubscribe();
  };
}

export function subscribeToTripReports(onUpdate: (reports: any[]) => void, onError?: (err: any) => void) {
  let unsubscribe: (() => void) | null = null;
  let active = true;

  getDb().then(db => {
    if (!active) return;
    const colRef = collection(db, 'tripReports');
    unsubscribe = onSnapshot(colRef, (snapshot) => {
      const reports: any[] = [];
      snapshot.forEach(docSnap => {
        reports.push(docSnap.data());
      });
      onUpdate(reports);
    }, (err) => {
      console.error('[Firebase Client] Error listening to tripReports:', err);
      if (onError) onError(err);
    });
  }).catch(err => {
    console.error('[Firebase Client] Failed to initialize db for tripReports subscription:', err);
    if (onError) onError(err);
  });

  return () => {
    active = false;
    if (unsubscribe) unsubscribe();
  };
}
