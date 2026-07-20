import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { UserProfile, Driver, TripReport, LocationLog } from '../types.js';

// Read Firebase applet configuration
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let config: any = {};
try {
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } else {
    console.warn('Warning: firebase-applet-config.json not found. Using empty config.');
  }
} catch (error) {
  console.error('Error reading firebase-applet-config.json:', error);
}

// Initialize Firebase App
const firebaseApp = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket
});

// Initialize Firebase Auth
export const auth = getAuth(firebaseApp);

// Initialize Firebase Storage
export const storage = getStorage(firebaseApp);

// Initialize Firestore with custom database ID if available
export const db = getFirestore(firebaseApp, config.firestoreDatabaseId || '(default)');

export function getFirebaseConfig() {
  return {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    firestoreDatabaseId: config.firestoreDatabaseId
  };
}

// Tracks admin UIDs discovered during seeding or login so they can be mapped to the single admin profile
const adminUids = new Set<string>();

function isSystemAdminEmail(email: string): boolean {
  const norm = email.toLowerCase();
  return norm === 'admin@dngps.com' || norm === 'dntrackerapp@gmail.com';
}

console.log(`[Firebase Service] Initialized Firestore with Project ID: ${config.projectId} and Database ID: ${config.firestoreDatabaseId || '(default)'}`);

// ============================================================================
// USER PROFILE OPERATIONS
// ============================================================================

export async function getUsers(): Promise<UserProfile[]> {
  try {
    const colRef = collection(db, 'users');
    const snapshot = await getDocs(colRef);
    const users: UserProfile[] = [];
    snapshot.forEach((docSnap) => {
      users.push(docSnap.data() as UserProfile);
    });
    return users;
  } catch (error) {
    console.error('Error in getUsers:', error);
    return [];
  }
}

export async function getUser(id: string): Promise<UserProfile | null> {
  try {
    const isMappedAdmin = id === 'admin_profile' || adminUids.has(id);
    const targetId = isMappedAdmin ? 'admin_profile' : id;
    
    const docRef = doc(db, 'users', targetId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    
    // Fallback in case seeding has not completed or the document is missing
    if (isMappedAdmin) {
      return {
        id: 'admin_profile',
        email: 'admin@dngps.com',
        name: 'DN Tracker Admin',
        role: 'admin',
        phone: '',
        vehiclePlate: '',
        createdAt: new Date().toISOString()
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error in getUser(${id}):`, error);
    return null;
  }
}

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    const lowercaseEmail = email.toLowerCase();
    if (isSystemAdminEmail(lowercaseEmail)) {
      return await getUser('admin_profile');
    }
    
    const colRef = collection(db, 'users');
    const q = query(colRef, where('email', '==', lowercaseEmail));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error(`Error in getUserByEmail(${email}):`, error);
    return null;
  }
}

export async function saveUser(user: UserProfile & { password?: string }): Promise<void> {
  try {
    const isMappedAdmin = user.id === 'admin_profile' || adminUids.has(user.id) || isSystemAdminEmail(user.email);
    const targetId = isMappedAdmin ? 'admin_profile' : user.id;
    
    if (isMappedAdmin) {
      user.id = 'admin_profile';
      user.role = 'admin';
    }
    
    const docRef = doc(db, 'users', targetId);
    await setDoc(docRef, user, { merge: true });
  } catch (error) {
    console.error('Error in saveUser:', error);
    throw error;
  }
}

export async function deleteUser(id: string): Promise<void> {
  try {
    const isMappedAdmin = id === 'admin_profile' || adminUids.has(id);
    if (isMappedAdmin) {
      console.warn('[Firebase Service] Attempted to delete administrator user. Operation ignored.');
      return;
    }
    const docRef = doc(db, 'users', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error in deleteUser(${id}):`, error);
    throw error;
  }
}

// ============================================================================
// DRIVER OPERATIONS
// ============================================================================

export async function getDrivers(): Promise<Driver[]> {
  try {
    const colRef = collection(db, 'drivers');
    const snapshot = await getDocs(colRef);
    const drivers: Driver[] = [];
    snapshot.forEach((docSnap) => {
      drivers.push(docSnap.data() as Driver);
    });
    return drivers;
  } catch (error) {
    console.error('Error in getDrivers:', error);
    return [];
  }
}

export async function getDriver(id: string): Promise<Driver | null> {
  try {
    const docRef = doc(db, 'drivers', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as Driver;
    }
    return null;
  } catch (error) {
    console.error(`Error in getDriver(${id}):`, error);
    return null;
  }
}

export async function getDriverByEmail(email: string): Promise<Driver | null> {
  try {
    const colRef = collection(db, 'drivers');
    const q = query(colRef, where('email', '==', email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as Driver;
    }
    return null;
  } catch (error) {
    console.error(`Error in getDriverByEmail(${email}):`, error);
    return null;
  }
}

export async function saveDriver(driver: Driver): Promise<void> {
  try {
    const docRef = doc(db, 'drivers', driver.id);
    await setDoc(docRef, driver, { merge: true });
  } catch (error) {
    console.error('Error in saveDriver:', error);
    throw error;
  }
}

export async function updateDriver(id: string, data: Partial<Driver>): Promise<void> {
  try {
    const docRef = doc(db, 'drivers', id);
    await updateDoc(docRef, data as any);
  } catch (error) {
    console.error(`Error in updateDriver(${id}):`, error);
    throw error;
  }
}

export async function deleteDriver(id: string): Promise<void> {
  try {
    const docRef = doc(db, 'drivers', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error in deleteDriver(${id}):`, error);
    throw error;
  }
}

// ============================================================================
// TRIP REPORT OPERATIONS
// ============================================================================

export async function getTripReports(): Promise<TripReport[]> {
  try {
    const colRef = collection(db, 'tripReports');
    const snapshot = await getDocs(colRef);
    const reports: TripReport[] = [];
    snapshot.forEach((docSnap) => {
      reports.push(docSnap.data() as TripReport);
    });
    return reports;
  } catch (error) {
    console.error('Error in getTripReports:', error);
    return [];
  }
}

export async function saveTripReport(report: TripReport): Promise<void> {
  try {
    const docRef = doc(db, 'tripReports', report.id);
    await setDoc(docRef, report, { merge: true });
  } catch (error) {
    console.error('Error in saveTripReport:', error);
    throw error;
  }
}

export async function getActiveTripReport(driverId: string): Promise<TripReport | null> {
  try {
    const colRef = collection(db, 'tripReports');
    const q = query(
      colRef, 
      where('driverId', '==', driverId),
      where('status', '==', 'ongoing')
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].data() as TripReport;
    }
    return null;
  } catch (error) {
    console.error(`Error in getActiveTripReport(${driverId}):`, error);
    return null;
  }
}

export async function endOngoingTrips(driverId: string): Promise<void> {
  try {
    const colRef = collection(db, 'tripReports');
    const q = query(
      colRef,
      where('driverId', '==', driverId),
      where('status', '==', 'ongoing')
    );
    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      const docRef = doc(db, 'tripReports', docSnap.id);
      await updateDoc(docRef, {
        status: 'completed',
        endTime: new Date().toISOString(),
        endLocation: 'Auto Terminated Shift'
      });
    }
  } catch (error) {
    console.error(`Error in endOngoingTrips(${driverId}):`, error);
    throw error;
  }
}

// ============================================================================
// LOCATION LOG OPERATIONS
// ============================================================================

export async function getLocationLogs(): Promise<LocationLog[]> {
  try {
    const colRef = collection(db, 'locationLogs');
    const snapshot = await getDocs(colRef);
    const logs: LocationLog[] = [];
    snapshot.forEach((docSnap) => {
      logs.push(docSnap.data() as LocationLog);
    });
    return logs;
  } catch (error) {
    console.error('Error in getLocationLogs:', error);
    return [];
  }
}

export async function saveLocationLog(log: LocationLog): Promise<void> {
  try {
    const docRef = doc(db, 'locationLogs', log.id);
    await setDoc(docRef, log, { merge: true });
  } catch (error) {
    console.error('Error in saveLocationLog:', error);
    throw error;
  }
}

export async function deleteLocationLogsForDriver(driverId: string): Promise<void> {
  try {
    const colRef = collection(db, 'locationLogs');
    const q = query(colRef, where('driverId', '==', driverId));
    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, 'locationLogs', docSnap.id));
    }
  } catch (error) {
    console.error(`Error in deleteLocationLogsForDriver(${driverId}):`, error);
    throw error;
  }
}

export async function deleteTripReportsForDriver(driverId: string): Promise<void> {
  try {
    const colRef = collection(db, 'tripReports');
    const q = query(colRef, where('driverId', '==', driverId));
    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, 'tripReports', docSnap.id));
    }
  } catch (error) {
    console.error(`Error in deleteTripReportsForDriver(${driverId}):`, error);
    throw error;
  }
}

export async function deleteTripReport(id: string): Promise<void> {
  try {
    const docRef = doc(db, 'tripReports', id);
    await deleteDoc(docRef);

    // Try to delete any related Firebase Storage file if one exists
    try {
      const storageRef = ref(storage, `reports/${id}`);
      await deleteObject(storageRef);
      console.log(`[Firebase Service] Deleted storage file reports/${id}`);
    } catch (storageError: any) {
      if (storageError.code === 'storage/object-not-found') {
        console.log(`[Firebase Service] No related storage file found for report ${id}. Skipping.`);
      } else {
        console.error('[Firebase Service] Error deleting storage file:', storageError);
      }
    }
  } catch (error) {
    console.error(`Error in deleteTripReport(${id}):`, error);
    throw error;
  }
}

export async function seedAdmin(email: string, name: string): Promise<void> {
  const defaultPassword = 'admin123';
  let uid = '';
  
  try {
    console.log(`[Firebase Service] Attempting to create Auth user for ${email}...`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, defaultPassword);
    uid = userCredential.user.uid;
    console.log(`[Firebase Service] Created Firebase Auth user for ${email} with UID: ${uid}`);
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log(`[Firebase Service] Auth user ${email} already exists.`);
      // Try to sign in to get the UID (if password is still default 'admin123')
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, defaultPassword);
        uid = userCredential.user.uid;
        console.log(`[Firebase Service] Successfully signed in existing Auth user. UID: ${uid}`);
      } catch (signInErr: any) {
        console.log(`[Firebase Service] Could not sign in ${email} (password may have changed). Searching Firestore...`);
        // If password changed, look up by email in Firestore
        const existingDoc = await getUserByEmail(email);
        if (existingDoc) {
          uid = existingDoc.id;
          console.log(`[Firebase Service] Found existing user in Firestore with UID: ${uid}`);
        } else {
          // Fallback random UID if both failed
          uid = 'admin_' + Math.random().toString(36).substring(2, 11);
          console.warn(`[Firebase Service] No Firestore document found for existing auth user ${email}. Created ID: ${uid}`);
        }
      }
    } else {
      console.error(`[Firebase Service] Error creating auth user for ${email}:`, error);
      throw error;
    }
  }

  if (uid) {
    adminUids.add(uid);

    // If there is any legacy document under this raw auth UID (other than 'admin_profile'), delete it to avoid duplicates
    if (uid !== 'admin_profile') {
      try {
        const legacyDocRef = doc(db, 'users', uid);
        const legacyDocSnap = await getDoc(legacyDocRef);
        if (legacyDocSnap.exists()) {
          console.log(`[Firebase Service] Deleting legacy raw-UID document ${uid} to enforce single admin_profile document`);
          await deleteDoc(legacyDocRef);
        }
      } catch (err) {
        console.error('[Firebase Service] Error cleanup legacy raw-UID doc:', err);
      }
    }

    // Check if the single canonical 'admin_profile' already exists in Firestore
    const existingAdminDoc = await getUser('admin_profile');
    if (!existingAdminDoc) {
      console.log(`[Firebase Service] Creating single shared 'admin_profile' in Firestore`);
      const adminProfile: UserProfile & { password?: string } = {
        id: 'admin_profile',
        email: 'admin@dngps.com', // Single canonical email for the admin profile
        password: 'admin', // save user's expected UI password
        name: 'DN Tracker Admin',
        role: 'admin',
        phone: '',
        vehiclePlate: '',
        createdAt: new Date().toISOString()
      };
      await saveUser(adminProfile);
    } else {
      console.log(`[Firebase Service] Canonical 'admin_profile' already exists in Firestore`);
    }
  }
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  try {
    console.log('[Firebase Service] Verifying administrator accounts in Firebase Auth and Firestore...');
    await seedAdmin('dntrackerapp@gmail.com', 'System Admin');
    await seedAdmin('admin@dngps.com', 'DN Tracker Admin');
    console.log('[Firebase Service] Database/Auth seeding checks completed successfully.');
  } catch (error) {
    console.error('[Firebase Service] Failed to seed database:', error);
  }
}

export async function loginWithFirebaseAuth(email: string, password: string): Promise<UserProfile> {
  const lowercaseEmail = email.toLowerCase();
  let authPassword = password;

  // Normalize system admin credentials so they always match Firebase Auth's seeded password
  if (isSystemAdminEmail(lowercaseEmail)) {
    if (password === 'admin' || password === 'admin123') {
      authPassword = 'admin123';
    }
  } else {
    // For non-admin (driver) users, if password is < 6 chars, append '123' as in registerDriver
    if (password.length < 6) {
      authPassword = password + '123';
    }
  }

  try {
    console.log(`[Firebase Service] Attempting sign-in for ${lowercaseEmail} in Firebase Auth...`);
    const credential = await signInWithEmailAndPassword(auth, lowercaseEmail, authPassword);
    const authUser = credential.user;
    console.log(`[Firebase Service] Auth signed in successfully. UID: ${authUser.uid}`);

    if (isSystemAdminEmail(lowercaseEmail)) {
      adminUids.add(authUser.uid);
      const adminProfile = await getUser('admin_profile');
      if (adminProfile) {
        return adminProfile;
      }
    }

    // Load user profile from users collection using UID
    let user = await getUser(authUser.uid);
    if (!user) {
      console.warn(`[Firebase Service] Firestore profile missing for signed-in Auth user ${lowercaseEmail}. Recreating default driver profile on-the-fly...`);
      const defaultCode = 'D' + Math.floor(100 + Math.random() * 900);
      const defaultName = lowercaseEmail.split('@')[0];
      
      // Recreate user document
      user = {
        id: authUser.uid,
        driverCode: defaultCode,
        email: lowercaseEmail,
        password: authPassword,
        name: defaultName,
        role: 'driver',
        phone: '555-0199',
        vehiclePlate: 'TX-999-TEMP',
        createdAt: new Date().toISOString()
      };
      await saveUser(user);

      // Recreate driver document
      const driverDoc: Driver = {
        id: authUser.uid,
        driverCode: defaultCode,
        name: defaultName,
        email: lowercaseEmail,
        password: authPassword,
        phone: '555-0199',
        vehiclePlate: 'TX-999-TEMP',
        vehicleNameType: 'Standard Vehicle',
        companyName: 'DN GPS Tracker',
        status: 'offline',
        lastLatitude: null,
        lastLongitude: null,
        lastActive: null
      };
      await saveDriver(driverDoc);
    }

    return user;
  } catch (authError: any) {
    console.error(`[Firebase Service] Authentication error for ${lowercaseEmail}:`, authError.message);
    
    // Check if there is a Firestore fallback for correct password matching
    const dbUser = await getUserByEmail(lowercaseEmail);
    if (dbUser && (dbUser.password === password || (password.length < 6 && dbUser.password === password + '123') || dbUser.password === authPassword)) {
      console.log(`[Firebase Service] Password matched Firestore user document for ${lowercaseEmail}. Allowing login via Firestore fallback.`);
      return dbUser;
    }

    if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential' || authError.code === 'auth/wrong-password') {
      throw new Error('Invalid email or password.');
    }
    throw authError;
  }
}

export async function registerDriver(driverData: any): Promise<any> {
  const lowercaseEmail = driverData.email.toLowerCase();
  
  console.log(`[Firebase Service] Registering driver with Email: ${lowercaseEmail}`);
  
  let uid: string;
  try {
    // 1. Create Firebase Auth account first
    const securePassword = driverData.password.length < 6 ? driverData.password + '123' : driverData.password;
    const userCredential = await createUserWithEmailAndPassword(auth, lowercaseEmail, securePassword);
    uid = userCredential.user.uid;
    console.log(`[Firebase Service] Created Auth user with UID: ${uid}`);
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      console.warn(`[Firebase Service] Auth account already exists for ${lowercaseEmail}. Reusing or generating custom deterministic UID.`);
      uid = 'uid_' + lowercaseEmail.replace(/[^a-zA-Z0-9]/g, '_');
    } else {
      throw err;
    }
  }

  // 2. Prepare driver document with uid as primary key, storing the custom ID in driverCode
  const driverDoc = {
    ...driverData,
    id: uid, // Use Auth UID or generated ID as the standard ID
    driverCode: driverData.id, // Save custom ID as driverCode
    email: lowercaseEmail,
    status: 'offline' as const,
    lastLatitude: null,
    lastLongitude: null,
    lastActive: null
  };
  await saveDriver(driverDoc);

  // 3. Prepare linked user document
  const userProfile: UserProfile = {
    id: uid, // Use Auth UID or generated ID as the standard ID
    driverCode: driverData.id, // Save custom ID as driverCode
    email: lowercaseEmail,
    password: driverData.password,
    name: driverData.name,
    role: 'driver',
    phone: driverData.phone,
    vehiclePlate: driverData.vehiclePlate,
    createdAt: new Date().toISOString()
  };
  await saveUser(userProfile);

  return driverDoc;
}

export async function deleteDriverTransaction(driverId: string): Promise<void> {
  console.log(`[Firebase Service] Starting complete transactional deletion for driver ID: ${driverId}`);
  
  // 1. Get driver profile to retrieve email and password for Auth deletion
  const driver = await getDriver(driverId);
  const user = await getUser(driverId);
  
  const email = driver?.email || user?.email;
  const password = driver?.password || user?.password;

  // 2. End any active trip reports for this driver (close/complete them instead of leaving ongoing or orphan)
  try {
    const colRef = collection(db, 'tripReports');
    const q = query(colRef, where('driverId', '==', driverId), where('status', '==', 'ongoing'));
    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      await setDoc(doc(db, 'tripReports', docSnap.id), {
        status: 'completed',
        endTime: new Date().toISOString(),
        endLocation: 'Shift Completed via Admin Deletion'
      }, { merge: true });
    }
    console.log(`[Firebase Service] Successfully closed ongoing trip reports for ${driverId}.`);
  } catch (err) {
    console.error(`[Firebase Service] Error closing ongoing trip reports for ${driverId}:`, err);
  }

  // 3. Delete live GPS records / location logs
  try {
    await deleteLocationLogsForDriver(driverId);
    console.log(`[Firebase Service] Deleted location logs for ${driverId}.`);
  } catch (err) {
    console.error(`[Firebase Service] Error deleting location logs for ${driverId}:`, err);
  }

  // 4. Delete Firestore documents (drivers and users)
  try {
    const driverRef = doc(db, 'drivers', driverId);
    await deleteDoc(driverRef);
    console.log(`[Firebase Service] Deleted drivers/${driverId} document.`);
  } catch (err) {
    console.error(`[Firebase Service] Error deleting drivers document for ${driverId}:`, err);
  }

  try {
    const userRef = doc(db, 'users', driverId);
    await deleteDoc(userRef);
    console.log(`[Firebase Service] Deleted users/${driverId} document.`);
  } catch (err) {
    console.error(`[Firebase Service] Error deleting users document for ${driverId}:`, err);
  }

  // 5. Delete Firebase Auth account
  if (email && password) {
    try {
      console.log(`[Firebase Service] Attempting to delete Auth account for ${email} using login credentials...`);
      const credential = await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
      if (credential.user) {
        await credential.user.delete();
        console.log(`[Firebase Service] Successfully deleted Firebase Auth account for ${email}.`);
      }
    } catch (authErr: any) {
      console.warn(`[Firebase Service] Warning: Auth deletion failed or account was not present:`, authErr.message);
    }
  } else {
    console.warn(`[Firebase Service] Email or password not found for ${driverId}. Skipping Auth account deletion.`);
  }

  console.log(`[Firebase Service] Transactional deletion completed for ${driverId}.`);
}

