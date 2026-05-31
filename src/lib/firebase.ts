import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signInAnonymously, updateProfile } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

const cleanEnvVar = (val: string | undefined): string => {
  if (!val) return '';
  return val.replace(/^["']|["']$/g, '').trim();
};

const firebaseConfig = {
  apiKey: cleanEnvVar(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: cleanEnvVar(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: cleanEnvVar(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: cleanEnvVar(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnvVar(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanEnvVar(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: cleanEnvVar(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID),
};

const app = initializeApp(firebaseConfig);
const dbId = cleanEnvVar(import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID);
export const db = getFirestore(app, dbId && dbId !== '(default)' ? dbId : undefined);
export const auth = getAuth(app);

export const ADMIN_EMAIL = 'shashanknayal4@gmail.com';

let isSignInPending = false;

export const signInWithGoogle = async () => {
  if (isSignInPending) {
    console.warn('Sign-in already in progress. Ignoring duplicate request.');
    return null;
  }
  isSignInPending = true;
  const provider = new GoogleAuthProvider();
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  } finally {
    isSignInPending = false;
  }
};

export const signInAsGuest = async (displayName: string = 'Guest') => {
  try {
    const cred = await signInAnonymously(auth);
    if (cred.user) {
      await updateProfile(cred.user, {
        displayName: displayName
      });
    }
    return cred.user;
  } catch (error) {
    console.error('Guest login failed:', error);
    throw error;
  }
};

export const loginAsAdmin = async (password: string) => {
  try {
    return await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  } catch (error) {
    console.error('Admin login failed:', error);
    throw error;
  }
};

export const isAdmin = (user: any) => {
  return user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
};

// Connectivity check
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase is offline or configuration needs verification:", error.message);
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      // We explicitly DO NOT log email or PII in the error object sent to the console/UI
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  // In production, we would log this to a secure backend, not the browser console.
  // For this environment, we keep the logs minimal and non-PII.
  console.error('Firestore Operation Restricted:', operationType, path); 
  throw new Error(`Permission Denied: Unauthorized ${operationType} on ${path}`);
}
