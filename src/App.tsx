/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Wallet, Share2, Shield, Home, Plus, Upload, Clock, ArrowLeft, Copy, Check, Bell, X, FileText, CheckCircle2, XCircle, Eye, EyeOff, Award, Users, ExternalLink, Zap, MessageSquare, ChevronLeft, ChevronRight, Send, Briefcase, LogOut, LogIn, Search, UserCheck, Trash2, UserPlus, MessageCircle, Facebook, User as UserIcon, Settings, Lock, Unlock, Instagram, Twitter, Linkedin, Github, Phone, Coins, Sparkles, ShieldCheck, RefreshCw, AlertCircle, BookOpen, HelpCircle, Gift, UserCircle } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  sendPasswordResetEmail,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  where
} from 'firebase/firestore';

enum OperationType {
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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type Screen = 'signup' | 'home' | 'wallet' | 'referral' | 'admin' | 'chat' | 'profile';
type WalletStep = 'overview' | 'topup_options' | 'bank_transfer' | 'success';

interface CoinOption {
  coins: number;
  label: string;
  price: string;
  amount: number; // numeric value for profit calculation
}

interface TopUpRecord {
  id: string;
  option: CoinOption;
  date: string;
  fileName: string;
  fileObject?: File | null;
  fileUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  gigId?: string;
}

const BLURRY_COINS_BG = 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=1200&auto=format&fit=crop&q=80';

const AppNameWithCoins = ({ className = "" }: { className?: string; iconSize?: string }) => (
  <span className={className}>TimeGiG</span>
);

const BlurryCoinsBg = ({ opacity = 0.25, overlay = 'bg-black/60' }: { opacity?: number; overlay?: string }) => (
  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
    <img
      src={BLURRY_COINS_BG}
      alt=""
      className="w-full h-full object-cover blur-md scale-110"
      style={{ opacity }}
    />
    <div className={`absolute inset-0 ${overlay}`} />
  </div>
);

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

interface AgentCashoutRecord {
  id: string;
  agentName: string;
  avatarUrl: string;
  email: string;
  phone: string;
  bankName: string;
  accountNumber: string;
  branchCode: string;
  totalReferrals: number;
  rewardBoxCompleted: string;
  cashoutAmount: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
  role: string;
  lastMessage?: string;
  activeGigId?: string;
  activeGigTitle?: string;
  activeGigPrice?: string;
}

interface ChatMessage {
  id: string;
  contactId: string;
  sender: 'user' | 'contact';
  text: string;
  time: string;
}

const INITIAL_CONTACTS: Contact[] = [];

const INITIAL_MESSAGES: ChatMessage[] = [];

const SUGGESTED_SERVICE_PROVIDERS: { id: string; name: string; avatar: string; role: string }[] = [];

const INITIAL_AGENT_CASHOUTS: AgentCashoutRecord[] = [];

const COIN_OPTIONS: CoinOption[] = [
  { coins: 500, label: '500c', price: 'R5,00', amount: 5 },
  { coins: 1000, label: '1000c', price: 'R10,00', amount: 10 },
  { coins: 2000, label: '2000c', price: 'R20,00', amount: 20 },
  { coins: 4000, label: '4000c', price: 'R40,00', amount: 40 },
  { coins: 6000, label: '6000c', price: 'R60,00', amount: 60 },
  { coins: 10000, label: '10000c', price: 'R100,00', amount: 100 },
  { coins: 20000, label: '20000c', price: 'R200,00', amount: 200 },
];

interface RewardBox {
  id: string;
  reward: string;
  targetCoins: string;
  referralsRequired: number;
  link: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  progress: number;
}

interface Gig {
  id: string;
  title: string;
  price: string;
  location: string;
  description: string;
  imageUrls: string[];
  imageUrl: string;
  authorName: string;
  authorEmail?: string;
  authorId: string;
  authorAvatar: string;
  category: string;
  date: string;
}

const INITIAL_GIGS: Gig[] = [];

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 
  'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'
];

const PROVINCE_LOCATIONS: Record<string, string[]> = {
  'Gauteng': ['Johannesburg', 'Pretoria', 'Soweto', 'Sandton', 'Randburg'],
  'Western Cape': ['Cape Town', 'Stellenbosch', 'Paarl', 'George', 'Knysna'],
  'KwaZulu-Natal': ['Durban', 'Pietermaritzburg', 'Umhlanga', 'Ballito'],
  'Free State': ['Bloemfontein', 'Welkom', 'Bethlehem'],
  'Eastern Cape': ['Port Elizabeth', 'East London', 'Grahamstown'],
  'Limpopo': ['Polokwane', 'Thohoyandou', 'Tzaneen'],
  'Mpumalanga': ['Nelspruit', 'Witbank', 'Secunda'],
  'Northern Cape': ['Kimberley', 'Upington'],
  'North West': ['Rustenburg', 'Potchefstroom']
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const [activeScreen, setActiveScreenState] = useState<Screen>(() => {
    const saved = localStorage.getItem('activeScreen');
    console.log(`[DEBUG] Initializing activeScreen state on mount/reload. saved in localStorage: "${saved}"`);
    return (saved as Screen) || 'signup';
  });
  const setActiveScreen = (screen: Screen) => {
    console.log(`[DEBUG] setActiveScreen called with: "${screen}". Call stack:`, new Error().stack);
    localStorage.setItem('activeScreen', screen);
    setActiveScreenState(screen);
  };

  const [walletStep, setWalletStepState] = useState<WalletStep>(() => {
    const saved = localStorage.getItem('walletStep');
    console.log(`[DEBUG] Initializing walletStep state on mount/reload. saved in localStorage: "${saved}"`);
    return (saved as WalletStep) || 'overview';
  });
  const setWalletStep = (step: WalletStep) => {
    console.log(`[DEBUG] setWalletStep called with: "${step}". Call stack:`, new Error().stack);
    localStorage.setItem('walletStep', step);
    setWalletStepState(step);
  };

  const [balance, setBalance] = useState<number>(0);

  const [selectedOption, setSelectedOptionState] = useState<CoinOption | null>(() => {
    const saved = localStorage.getItem('selectedOption');
    console.log(`[DEBUG] Initializing selectedOption state on mount/reload. saved in localStorage: "${saved}"`);
    return saved ? JSON.parse(saved) : null;
  });
  const setSelectedOption = (opt: CoinOption | null) => {
    console.log(`[DEBUG] setSelectedOption called with:`, opt, `Call stack:`, new Error().stack);
    if (opt) {
      localStorage.setItem('selectedOption', JSON.stringify(opt));
    } else {
      localStorage.removeItem('selectedOption');
    }
    setSelectedOptionState(opt);
  };

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!proofFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [proofFile]);

  const [showReviewPopup, setShowReviewPopup] = useState<boolean>(false);
  const [showSplash, setShowSplash] = useState(true);

  // Advanced Payment Upload states
  const [paymentTab, setPaymentTab] = useState<'details' | 'guide' | 'security'>('details');
  const [isScanningProof, setIsScanningProof] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [previewRotation, setPreviewRotation] = useState<number>(0);

  const [scanResults, setScanResults] = useState<{
    txId: string;
    amount: string;
    matched: boolean;
    confidence: number;
    timestamp: string;
  } | null>(null);

  const [isOcrVerified, setIsOcrVerified] = useState<boolean>(false);

  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({});
  const handleCopyField = (field: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedStates(prev => ({...prev, [field]: true}));
    setTimeout(() => {
      setCopiedStates(prev => ({...prev, [field]: false}));
    }, 2000);
  };

  // Referral states declared early for rewardBoxes
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralCount, setReferralCount] = useState<number>(0);
  const [activeReferralCode, setActiveReferralCode] = useState<string | null>(localStorage.getItem('referralCode'));
  const [isAgent, setIsAgent] = useState<boolean>(false);

  // Profile states
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileMiddleName, setProfileMiddleName] = useState('');
  const [profileSurname, setProfileSurname] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSocialLinks, setProfileSocialLinks] = useState<string[]>(['']);
  const [profileSkills, setProfileSkills] = useState<string[]>(['']);
  const [profileProvince, setProfileProvince] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profilePhotoURL, setProfilePhotoURL] = useState('');
  const [isProfileLocked, setIsProfileLocked] = useState(false);
  const [profilePin, setProfilePin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [showProfileCongrats, setShowProfileCongrats] = useState(false);

  const appUrl = window.location.origin;
  const userReferralLink = `${appUrl}/?ref=${referralCode}`;

  const rewardBoxes: RewardBox[] = [
    { 
      id: 'r1', 
      reward: 'R200,00', 
      targetCoins: '2000c', 
      referralsRequired: 20, 
      link: userReferralLink,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50/80',
      borderColor: 'border-emerald-200 hover:border-emerald-300',
      badgeBg: 'bg-emerald-100 text-emerald-800',
      progress: Math.min(20, referralCount)
    },
    { 
      id: 'r2', 
      reward: 'R600,00', 
      targetCoins: '6000c', 
      referralsRequired: 60, 
      link: userReferralLink,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50/80',
      borderColor: 'border-blue-200 hover:border-blue-300',
      badgeBg: 'bg-blue-100 text-blue-800',
      progress: Math.min(60, referralCount)
    },
    { 
      id: 'r3', 
      reward: 'R800,00', 
      targetCoins: '8000c', 
      referralsRequired: 80, 
      link: userReferralLink,
      color: 'text-purple-700',
      bgColor: 'bg-purple-50/80',
      borderColor: 'border-purple-200 hover:border-purple-300',
      badgeBg: 'bg-purple-100 text-purple-800',
      progress: Math.min(80, referralCount)
    },
    { 
      id: 'r4', 
      reward: 'R1.000,00', 
      targetCoins: '10000c', 
      referralsRequired: 100, 
      link: userReferralLink,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50/80',
      borderColor: 'border-amber-200 hover:border-amber-300',
      badgeBg: 'bg-amber-100 text-amber-800',
      progress: Math.min(100, referralCount)
    },
    { 
      id: 'r5', 
      reward: 'R2.000,00', 
      targetCoins: '20000c', 
      referralsRequired: 200, 
      link: userReferralLink,
      color: 'text-rose-700',
      bgColor: 'bg-rose-50/80',
      borderColor: 'border-rose-200 hover:border-rose-300',
      badgeBg: 'bg-rose-100 text-rose-800',
      progress: Math.min(200, referralCount)
    },
  ];

  const handleBecomeAgent = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isAgent: true
      });
      setIsAgent(true);
      setToastMessage('🚀 You are now an Agent Partner!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Error becoming agent:", err);
    }
  };
  
  useEffect(() => {
    // Capture referral code from URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('referralCode', ref);
      setActiveReferralCode(ref);
    }
    
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 5000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsLoggedIn(true);
        try {
          // Check if admin
          const userDocRef = doc(db, 'users', currentUser.uid);
          let userDoc;
          try {
            userDoc = await getDoc(userDocRef);
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          }

          if (userDoc?.exists()) {
            const data = userDoc.data();
            setIsAdminUser(data.isAdmin || currentUser.email?.toLowerCase() === 'timegig2026@gmail.com'.toLowerCase());
            setBalance(data.balance || 0);
            setBankName(data.bankName || '');
            setAccountNumber(data.accountNumber || '');
            setBranchCode(data.branchCode || '');
            setAccountHolder(data.accountHolder || '');
            setIsBankingSaved(!!data.accountNumber);
            setIsAgent(data.isAgent || false);
            setProfileFirstName(data.firstName || '');
            setProfileMiddleName(data.middleName || '');
            setProfileSurname(data.surname || '');
            setProfilePhone(data.phone || '');
            setProfileSocialLinks(data.socialLinks || ['']);
            setProfileSkills(data.skills || ['']);
            setProfileProvince(data.province || '');
            setProfileLocation(data.location || '');
            setProfilePhotoURL(data.photoURL || '');
            setIsProfileLocked(data.isLocked || false);
            setProfilePin(data.pin || '');
            
            if (data.referralCode) {
              setReferralCode(data.referralCode);
            } else {
              // Generate referral code for legacy user
              const newReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              await updateDoc(userDocRef, { referralCode: newReferralCode });
              setReferralCode(newReferralCode);
            }
          } else {
            // Initialize user doc if it doesn't exist
            const isAdmin = currentUser.email?.toLowerCase() === 'timegig2026@gmail.com'.toLowerCase();
            const newReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const userData = {
              email: currentUser.email,
              isAdmin: isAdmin,
              balance: 0,
              referralCode: newReferralCode,
              isAgent: false,
              createdAt: serverTimestamp()
            };
            try {
              await setDoc(userDocRef, userData);
              
              // If there was an active referral code, record the referral
              const storedRefCode = localStorage.getItem('referralCode');
              if (storedRefCode) {
                try {
                  // Find the referrer
                  const usersRef = collection(db, 'users');
                  const q = query(usersRef, where('referralCode', '==', storedRefCode));
                  const querySnapshot = await getDocs(q);
                  if (!querySnapshot.empty) {
                    const referrerId = querySnapshot.docs[0].id;
                    await addDoc(collection(db, 'referrals'), {
                      referrerId: referrerId,
                      refereeId: currentUser.uid,
                      refereeEmail: currentUser.email,
                      createdAt: serverTimestamp()
                    });
                    
                    // Notify referrer
                    await addDoc(collection(db, 'notifications'), {
                      userId: referrerId,
                      title: 'New Referral! 🤝',
                      message: `A new user joined using your referral link! Your progress toward reward boxes has increased.`,
                      time: 'Just now',
                      read: false,
                      createdAt: serverTimestamp()
                    });
                    
                    localStorage.removeItem('referralCode');
                  }
                } catch (err) {
                  console.error("Error processing referral:", err);
                }
              }
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
            }
            setIsAdminUser(isAdmin);
            setBalance(0);
            setReferralCode(newReferralCode);
          }
        } catch (error) {
          console.error("Firestore initialization error:", error);
        }
        
        const savedScreen = localStorage.getItem('activeScreen');
        console.log(`[DEBUG] onAuthStateChanged: logged in. uid: "${currentUser.uid}", email: "${currentUser.email}". savedScreen in localStorage is: "${savedScreen}"`);
        if (savedScreen && savedScreen !== 'signup') {
          console.log(`[DEBUG] Restoring saved screen state from localStorage: "${savedScreen}"`);
          setActiveScreenState(savedScreen as Screen);
        } else {
          console.log(`[DEBUG] No valid saved screen or was "signup". Unconditional navigation to "home" now skipped/re-routed to home.`);
          setActiveScreen('home');
        }
      } else {
        console.log(`[DEBUG] onAuthStateChanged: logged out or session not found.`);
        setIsLoggedIn(false);
        setIsAdminUser(false);
        setBalance(0);
        
        const savedScreen = localStorage.getItem('activeScreen');
        if (savedScreen !== 'signup') {
          console.log(`[DEBUG] Logged out but savedScreen was "${savedScreen}", directing to "signup".`);
          setActiveScreen('signup');
        } else {
          setActiveScreenState('signup');
        }
      }
      setIsAuthLoading(false);
    });

    return () => {
      clearTimeout(timer);
      unsubscribeAuth();
    };
  }, []);

  // Sync Gigs from Firestore
  useEffect(() => {
    const q = query(collection(db, 'gigs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gigsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Gig[];
      setGigs(gigsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gigs');
    });
    return () => unsubscribe();
  }, []);

  // Sync Feedbacks from Firestore
  useEffect(() => {
    if (!isAdminUser) {
      setFeedbacks([]);
      return;
    }
    const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const feedbacksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as {id: string, user: string, text: string, date: string}[];
      setFeedbacks(feedbacksData);
    }, (error) => {
      console.error("Feedbacks sync error:", error);
    });
    return () => unsubscribe();
  }, [isAdminUser]);

  // Sync Notifications from Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NotificationItem[];
      setNotifications(notificationsData);
    }, (error) => {
      console.error("Notifications sync error:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Sync Top-ups from Firestore
  useEffect(() => {
    if (!user) return;
    
    let q;
    if (isAdminUser) {
      q = query(collection(db, 'topups'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'topups'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const topUpsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TopUpRecord[];
      setTopUps(topUpsData);
    }, (error) => {
      console.error("Top-ups sync error:", error);
    });
    return () => unsubscribe();
  }, [user, isAdminUser]);

  // Sync Referral Count from Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'referrals'), where('referrerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReferralCount(snapshot.size);
    }, (error) => {
      console.error("Referral count sync error:", error);
    });
    return () => unsubscribe();
  }, [user]);
  useEffect(() => {
    if (!isAdminUser) {
      setAgentCashouts([]);
      return;
    }
    const q = query(collection(db, 'agent_cashouts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cashoutsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AgentCashoutRecord[];
      setAgentCashouts(cashoutsData);
    }, (error) => {
      console.error("Agent cashouts sync error:", error);
    });
    return () => unsubscribe();
  }, [isAdminUser]);

  // Auth State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [showGigCongrats, setShowGigCongrats] = useState(false);
  
  // Tour State
  const [tourStep, setTourStep] = useState(0); // 0 = not started or done
  
  // Top-ups and Notifications state
  const [topUps, setTopUps] = useState<TopUpRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [agentCashouts, setAgentCashouts] = useState<AgentCashoutRecord[]>(INITIAL_AGENT_CASHOUTS);
  const [viewingAgentCashout, setViewingAgentCashout] = useState<AgentCashoutRecord | null>(null);

  // Agent mode state
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null);

  // Banking details required before starting referrals
  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [branchCode, setBranchCode] = useState<string>('');
  const [accountHolder, setAccountHolder] = useState<string>('');
  const [isBankingSaved, setIsBankingSaved] = useState<boolean>(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbacks, setFeedbacks] = useState<{id: string, user: string, text: string, date: string}[]>([]);

  // Gigs Marketplace state
  const [gigs, setGigs] = useState<Gig[]>(INITIAL_GIGS);
  const [showCreateGigModal, setShowCreateGigModal] = useState<boolean>(false);
  const [newGigTitle, setNewGigTitle] = useState<string>('');
  const [newGigPrice, setNewGigPrice] = useState<string>('');
  const [newGigLocation, setNewGigLocation] = useState<string>('');
  const [newGigDescription, setNewGigDescription] = useState<string>('');
  const [newGigCategory, setNewGigCategory] = useState<string>('Home Services');
  const [newGigImageUrl, setNewGigImageUrl] = useState<string>('https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&auto=format&fit=crop&q=80');
  const [newGigUploadedImages, setNewGigUploadedImages] = useState<string[]>([]);
  const [newGigAuthorName, setNewGigAuthorName] = useState<string>('');
  const [newGigAuthorAvatar, setNewGigAuthorAvatar] = useState<string>('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80');
  const [editingGigId, setEditingGigId] = useState<string | null>(null);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  const [fullScreenImageUrl, setFullScreenImageUrl] = useState<string | null>(null);

  const handleGigImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    
    // Limit to 5 images total
    if (newGigUploadedImages.length + fileList.length > 5) {
      setToastMessage('⚠️ You can upload a maximum of 5 images per gig.');
      setTimeout(() => setToastMessage(null), 3000);
      e.target.value = '';
      return;
    }

    let completedCount = 0;
    const maxDimension = 800; // Max width or height

    fileList.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxDimension) {
                height *= maxDimension / width;
                width = maxDimension;
              }
            } else {
              if (height > maxDimension) {
                width *= maxDimension / height;
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6); // 0.6 quality
              setNewGigUploadedImages((prev) => [...prev, compressedDataUrl]);
            }
            
            completedCount++;
            if (completedCount === fileList.length) {
              e.target.value = '';
            }
          };
          img.src = event.target.result as string;
        } else {
          completedCount++;
          if (completedCount === fileList.length) {
            e.target.value = '';
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveUploadedGigImage = (indexToRemove: number) => {
    setNewGigUploadedImages((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDimension = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height *= maxDimension / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width *= maxDimension / height;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setProfilePhotoURL(compressedDataUrl);
          }
        };
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerScanSimulation = (file: File) => {
    setIsScanningProof(true);
    setScanProgress(0);
    setScanResults(null);
    setIsOcrVerified(false);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        setTimeout(() => {
          setIsScanningProof(false);
          const mockTxId = `TXN-${Math.floor(100000 + Math.random() * 900000)}-${selectedOption?.label?.replace(/\s+/g, '') || 'CAP'}`;
          setScanResults({
            txId: mockTxId,
            amount: selectedOption?.price || 'R0.00',
            matched: true,
            confidence: 98.4 + (Math.random() * 1.5),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          setIsOcrVerified(true);
          setToastMessage('✅ AI Smart Scan completed: POP verified!');
          setTimeout(() => setToastMessage(null), 3000);
        }, 500);
      }
      setScanProgress(Math.min(progress, 100));
    }, 120);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDimension = 1000;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxDimension) {
                height *= maxDimension / width;
                width = maxDimension;
              }
            } else {
              if (height > maxDimension) {
                width *= maxDimension / height;
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (blob) {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  setProofFile(compressedFile);
                  triggerScanSimulation(compressedFile);
                } else {
                  setProofFile(file);
                  triggerScanSimulation(file);
                }
              }, 'image/jpeg', 0.7);
            } else {
              setProofFile(file);
              triggerScanSimulation(file);
            }
          };
          img.src = event.target.result as string;
        } else {
          setProofFile(file);
          triggerScanSimulation(file);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setProofFile(file);
      triggerScanSimulation(file);
    }
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setProofFile(null);
      setScanResults(null);
      setIsOcrVerified(false);
      return;
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDimension = 1000;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxDimension) {
                height *= maxDimension / width;
                width = maxDimension;
              }
            } else {
              if (height > maxDimension) {
                width *= maxDimension / height;
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (blob) {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  setProofFile(compressedFile);
                  triggerScanSimulation(compressedFile);
                } else {
                  setProofFile(file);
                  triggerScanSimulation(file);
                }
              }, 'image/jpeg', 0.7);
            } else {
              setProofFile(file);
              triggerScanSimulation(file);
            }
          };
          img.src = event.target.result as string;
        } else {
          setProofFile(file);
          triggerScanSimulation(file);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setProofFile(file);
      triggerScanSimulation(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!profilePhotoURL) {
      setToastMessage('⚠️ Please upload a profile picture first');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: profileFirstName,
        middleName: profileMiddleName,
        surname: profileSurname,
        phone: profilePhone,
        socialLinks: profileSocialLinks.filter(l => l.trim() !== ''),
        skills: profileSkills.filter(s => s.trim() !== ''),
        province: profileProvince,
        location: profileLocation,
        photoURL: profilePhotoURL,
        isLocked: true, // Always lock on save as requested
        pin: profilePin
      });
      setIsProfileLocked(true); // Update local state
      setActiveScreen('referral');
      setShowProfileCongrats(true);
      setTimeout(() => setShowProfileCongrats(false), 3000);
      setToastMessage('✅ Profile updated and locked!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
      setToastMessage('❌ Error saving profile.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    
    try {
      await addDoc(collection(db, 'feedbacks'), {
        user: user?.email || 'Anonymous',
        userId: user?.uid || 'anonymous',
        text: feedbackText,
        date: new Date().toLocaleDateString(),
        createdAt: serverTimestamp()
      });
      
      setFeedbackText('');
      setShowFeedbackModal(false);
      setToastMessage('Thank you for your feedback!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'feedbacks');
    }
  };

  const handleCreateGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGigTitle || !newGigPrice || !newGigLocation || !newGigDescription) return;

    const finalImageUrls = newGigUploadedImages.length > 0
      ? newGigUploadedImages
      : [newGigImageUrl || 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&auto=format&fit=crop&q=80'];
    const imgUrl = finalImageUrls[0];
    const formattedPrice = newGigPrice.startsWith('R') ? newGigPrice : `R${newGigPrice}`;
    const authorName = newGigAuthorName.trim() || (isBankingSaved && accountHolder ? accountHolder : 'Verified Member');
    const authorAvatar = newGigAuthorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

    const gigData = {
      title: newGigTitle,
      price: formattedPrice,
      location: newGigLocation,
      description: newGigDescription,
      imageUrls: finalImageUrls,
      imageUrl: imgUrl,
      authorName: authorName,
      authorEmail: user?.email || authEmail,
      authorAvatar: authorAvatar,
      category: newGigCategory,
      date: 'Just now',
      authorId: user?.uid || 'anonymous',
      createdAt: serverTimestamp()
    };

    try {
      let gigId = editingGigId;
      if (editingGigId) {
        try {
          await updateDoc(doc(db, 'gigs', editingGigId), gigData);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `gigs/${editingGigId}`);
        }
        setEditingGigId(null);
      } else {
        try {
          const docRef = await addDoc(collection(db, 'gigs'), gigData);
          gigId = docRef.id;
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'gigs');
        }
      }

      if (gigId) {
        setSelectedGig({ ...gigData, id: gigId } as Gig);
        setActiveImageIndex(0);
      }

      // Send gig notification to user
      if (user) {
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: user.uid,
            title: '📢 New Gig Alert!',
            message: `A new gig "${newGigTitle}" (${formattedPrice}) was published!`,
            time: 'Just now',
            read: false,
            createdAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'notifications');
        }
      }

      setToastMessage(`📢 Gig published: "${newGigTitle}"`);
      setTimeout(() => setToastMessage(null), 4000);
      closeCreateGigModal();
      
      // Congratulate and redirect
      setShowGigCongrats(true);
      setActiveScreen('home');
      setTimeout(() => {
        setShowGigCongrats(false);
      }, 3000);
    } catch (error) {
      console.error("Error publishing gig: ", error);
      setToastMessage('Error publishing gig. Please try again.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const closeCreateGigModal = () => {
    setEditingGigId(null);
    setNewGigTitle('');
    setNewGigPrice('');
    setNewGigLocation('');
    setNewGigDescription('');
    setNewGigAuthorName('');
    setNewGigUploadedImages([]);
    setShowCreateGigModal(false);
  };

  const triggerSimulatedGigAlert = () => {
    if (gigs.length > 0) {
      const latestGig = gigs[0];
      const newNotif: NotificationItem = {
        id: 'n_alert_' + Math.random().toString(36).substring(2, 9),
        title: '🔔 Marketplace Alert',
        message: `Latest active gig: "${latestGig.title}" by ${latestGig.authorName} (${latestGig.price}).`,
        time: 'Just now',
        read: false,
        gigId: latestGig.id
      };
      setNotifications((prev) => [newNotif, ...prev]);
      setToastMessage(`🔔 Alert: "${latestGig.title}" by ${latestGig.authorName}`);
    } else {
      setToastMessage('📢 No active gigs yet. Click "Post Gig" to publish the first gig!');
      setShowCreateGigModal(true);
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Auth state & Logout handler
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setToastMessage('🔒 Logged out successfully.');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Chat feature state
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [activeChatContactId, setActiveChatContactId] = useState<string | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState<string>('');
  const [selectedContactCategory, setSelectedContactCategory] = useState<string>('All');
  const [contactViewMode, setContactViewMode] = useState<'grid' | 'list'>('grid');

  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [newMessageText, setNewMessageText] = useState<string>('');
  const [showAddContactModal, setShowAddContactModal] = useState<boolean>(false);
  const [newContactName, setNewContactName] = useState<string>('');
  const [newContactRole, setNewContactRole] = useState<string>('');

  const handleAddContact = (name: string, role: string, avatar?: string) => {
    const existing = contacts.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setShowAddContactModal(false);
      setToastMessage(`${name} is already in your contact list.`);
      return;
    }

    const newContact: Contact = {
      id: 'c_' + Math.random().toString(36).substring(2, 9),
      name,
      avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      role: role || 'Service Provider',
      lastMessage: 'Verified contact'
    };

    setContacts(prev => [newContact, ...prev]);
    setShowAddContactModal(false);
    setToastMessage(`Added ${name} to contact list.`);
  };

  const handleClearAllChats = () => {
    setContacts([]);
    setToastMessage('Contact list cleared.');
  };
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(contactSearchQuery.toLowerCase());

    const matchesCategory =
      selectedContactCategory === 'All' ||
      (selectedContactCategory === 'Services' && (c.role.includes('Plumbing') || c.role.includes('Garden') || c.role.includes('Solar') || c.role.includes('Repairs'))) ||
      (selectedContactCategory === 'Education' && (c.role.includes('Tutor') || c.role.includes('Math') || c.role.includes('Physics'))) ||
      (selectedContactCategory === 'Tech' && (c.role.includes('Web') || c.role.includes('Developer'))) ||
      (selectedContactCategory === 'Logistics & Media' && (c.role.includes('Courier') || c.role.includes('Catering') || c.role.includes('Photo') || c.role.includes('Media')));

    return matchesSearch && matchesCategory;
  });

  const activeContact = contacts.find((c) => c.id === activeChatContactId) || null;
  const activeMessages = activeChatContactId
    ? messages.filter((m) => m.contactId === activeChatContactId)
    : [];

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessageText.trim() || !activeChatContactId) return;

    const text = newMessageText.trim();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: ChatMessage = {
      id: 'm_' + Math.random().toString(36).substring(2, 9),
      contactId: activeChatContactId,
      sender: 'user',
      text: text,
      time: timeStr
    };

    setMessages((prev) => [...prev, newMsg]);
    setNewMessageText('');

    // Update lastMessage snippet for this contact in contact list
    setContacts((prev) =>
      prev.map((c) => (c.id === activeChatContactId ? { ...c, lastMessage: text } : c))
    );
  };

  // Gig image swiping handlers (swipe through one gig owner's images)
  const handlePrevImage = () => {
    if (!selectedGig || !selectedGig.imageUrls || selectedGig.imageUrls.length === 0) return;
    setActiveImageIndex(prev => (prev - 1 + selectedGig.imageUrls.length) % selectedGig.imageUrls.length);
  };

  const handleNextImage = () => {
    if (!selectedGig || !selectedGig.imageUrls || selectedGig.imageUrls.length === 0) return;
    setActiveImageIndex(prev => (prev + 1) % selectedGig.imageUrls.length);
  };

  let touchStartX = 0;
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = e.changedTouches[0].clientX - touchStartX;
    if (diffX > 50) {
      handlePrevImage();
    } else if (diffX < -50) {
      handleNextImage();
    }
  };

  const handleApplyGig = (gig: Gig) => {
    if (gig.authorEmail === (user?.email || authEmail)) {
      alert("You cannot apply or chat to your own gig.");
      return;
    }

    let contact = contacts.find(c => c.name.toLowerCase() === gig.authorName.toLowerCase());
    let targetContactId = contact ? contact.id : 'c_' + Math.random().toString(36).substring(2, 9);

    if (!contact) {
      const newContact: Contact = {
        id: targetContactId,
        name: gig.authorName,
        avatar: gig.authorAvatar,
        role: gig.category + ' Provider',
        lastMessage: `Inquiring for: ${gig.title}`,
        activeGigId: gig.id,
        activeGigTitle: gig.title,
        activeGigPrice: gig.price
      };
      setContacts(prev => [newContact, ...prev]);
      contact = newContact;
    } else {
      // Update contact with active gig info
      setContacts(prev => prev.map(c => c.id === contact!.id ? {
        ...c,
        activeGigId: gig.id,
        activeGigTitle: gig.title,
        activeGigPrice: gig.price,
        lastMessage: `Inquiring for: ${gig.title}`
      } : c));
    }

    const applicationText = `Hi ${gig.authorName}, I'm interested in your gig: "${gig.title}" (${gig.price}). Is this still available?`;
    const initialMsg: ChatMessage = {
      id: 'm_' + Math.random().toString(36).substring(2, 9),
      contactId: targetContactId,
      sender: 'user',
      text: applicationText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, initialMsg]);
    setActiveChatContactId(targetContactId);
    
    setActiveChatContactId(targetContactId);
    setActiveScreen('chat');
    setSelectedGig(null);
  };

  const handleDeleteGig = async (gigId: string) => {
    if (!gigId) {
      setToastMessage('❌ Error: Gig ID is missing.');
      return;
    }
    if (window.confirm("Are you sure you want to delete this gig?")) {
      try {
        await deleteDoc(doc(db, 'gigs', gigId));
        setSelectedGig(null);
        setToastMessage('✅ Gig deleted successfully.');
        setTimeout(() => setToastMessage(null), 3000);
      } catch (error: any) {
        console.error("Delete error:", error);
        setToastMessage(`❌ Delete failed: ${error.message || 'Permission denied'}`);
        setTimeout(() => setToastMessage(null), 5000);
        // Do not re-throw here to prevent crashing the UI, just handle it gracefully
      }
    }
  };

  const handleClearAllGigs = async () => {
    if (window.confirm("⚠️ CRITICAL ACTION: Are you sure you want to delete ALL gig posts from the market? This action is permanent and cannot be undone.")) {
      try {
        const querySnapshot = await getDocs(collection(db, 'gigs'));
        if (querySnapshot.empty) {
          setToastMessage('ℹ️ The market is already empty.');
          setTimeout(() => setToastMessage(null), 3000);
          return;
        }
        
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        setToastMessage('✅ All gigs have been removed from the market.');
        setTimeout(() => setToastMessage(null), 3000);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'gigs (ALL)');
      }
    }
  };

  const handleEditGigInit = (gig: Gig) => {
    setNewGigTitle(gig.title);
    setNewGigPrice(gig.price);
    setNewGigLocation(gig.location);
    setNewGigDescription(gig.description);
    setNewGigCategory(gig.category);
    setNewGigUploadedImages(gig.imageUrls || []);
    setEditingGigId(gig.id);
    setShowCreateGigModal(true);
    setSelectedGig(null);
  };

  const handleShareGig = async (gig: Gig) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: gig.title,
          text: `Check out this gig on TimeGiG: ${gig.title} for ${gig.price}!`,
          url: window.location.href, // Or a specific deep link if we had one
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    } else {
      alert("Sharing is not supported on this device. You can copy the link manually.");
    }
  };

  // Full screen document viewer state for admin
  const [viewingDocument, setViewingDocument] = useState<TopUpRecord | null>(null);

  const [copied, setCopied] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleCopyAccount = () => {
    navigator.clipboard.writeText('1334067366');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyRewardLink = (id: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLinkId(id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  const handleSubmitProof = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!selectedOption) {
      setToastMessage('⚠️ Please select a top-up option');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (!proofFile) {
      setToastMessage('⚠️ Please upload a POP');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (!user) {
      setToastMessage('⚠️ Please sign in to submit proof');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setIsSubmittingProof(true);
    try {
      // Helper to convert file to base64
      const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });
      };

      let fileUrl = '';
      if (proofFile.size > 1024 * 1024) { // 1MB Limit for Firestore
        setToastMessage('⚠️ File size too large. Please upload a file smaller than 1MB.');
        setTimeout(() => setToastMessage(null), 3000);
        setIsSubmittingProof(false);
        return;
      }

      fileUrl = await fileToBase64(proofFile);

      const newRecord = {
        userId: user.uid,
        userEmail: user.email || 'Anonymous',
        option: selectedOption,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString(),
        fileName: proofFile.name,
        fileUrl: fileUrl,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'topups'), newRecord);
      setShowReviewPopup(true);
      setProofFile(null); // Clear after success
    } catch (error) {
      console.error("Error submitting proof:", error);
      setToastMessage('❌ Error submitting POP. Please try again.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsSubmittingProof(false);
    }
  };

  const handleClosePopup = () => {
    setShowReviewPopup(false);
    setWalletStep('overview');
    setSelectedOption(null);
    setProofFile(null);
  };

  // Admin Actions
  const handleApproveTopUp = async (id: string) => {
    if (processedIds.includes(id)) return;

    const target = topUps.find((t) => t.id === id);
    if (!target || target.status !== 'pending') return;

    try {
      setProcessedIds((prev) => [...prev, id]);
      
      await updateDoc(doc(db, 'topups', id), { status: 'approved' });

      if (target.userId && target.userId !== 'anonymous') {
        const userRef = doc(db, 'users', target.userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const currentBalance = userDoc.data().balance || 0;
          await updateDoc(userRef, { balance: currentBalance + target.option.coins });
        }
        
        await addDoc(collection(db, 'notifications'), {
          userId: target.userId,
          title: 'Top-Up Approved!',
          message: `Your top-up of ${target.option.label} (${target.option.price}) has been approved and added to your wallet balance.`,
          time: 'Just now',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      setToastMessage(`✅ Approved ${target.option.label}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (error) {
      console.error("Error approving top-up:", error);
    }
  };

  const handleRejectTopUp = async (id: string) => {
    if (processedIds.includes(id)) return;

    const target = topUps.find((t) => t.id === id);
    if (!target || target.status !== 'pending') return;

    try {
      setProcessedIds((prev) => [...prev, id]);
      await updateDoc(doc(db, 'topups', id), { status: 'rejected' });
      
      if (target.userId && target.userId !== 'anonymous') {
        await addDoc(collection(db, 'notifications'), {
          userId: target.userId,
          title: 'Top-Up Rejected',
          message: `Your top-up of ${target.option.label} (${target.option.price}) was rejected. Please check your POP and try again.`,
          time: 'Just now',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error rejecting top-up:", error);
    }
  };

  const handleApproveCashout = async (id: string) => {
    const target = agentCashouts.find((a) => a.id === id);
    if (!target || target.status !== 'pending') return;

    try {
      await updateDoc(doc(db, 'agent_cashouts', id), { status: 'approved' });

      if (target.userId && target.userId !== 'anonymous') {
        await addDoc(collection(db, 'notifications'), {
          userId: target.userId,
          title: 'Cashout Approved! 💸',
          message: `Your cashout request of ${target.cashoutAmount} for box ${target.rewardBoxCompleted} has been approved and paid out to your bank account (${target.bankName}).`,
          time: 'Just now',
          read: false,
          createdAt: serverTimestamp()
        });
      }
      
      setToastMessage(`✅ Cashout Approved for ${target.agentName}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (error) {
      console.error("Error approving cashout:", error);
    }
  };

  const handleRejectCashout = async (id: string) => {
    const target = agentCashouts.find((a) => a.id === id);
    if (!target || target.status !== 'pending') return;

    try {
      await updateDoc(doc(db, 'agent_cashouts', id), { status: 'rejected' });

      if (target.userId && target.userId !== 'anonymous') {
        await addDoc(collection(db, 'notifications'), {
          userId: target.userId,
          title: 'Cashout Rejected',
          message: `Your cashout request of ${target.cashoutAmount} was rejected. Please verify your bank details or contact support.`,
          time: 'Just now',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error rejecting cashout:", error);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;
    try {
      const promises = notifications.map(n => {
        if (!n.read) {
          return updateDoc(doc(db, 'notifications', n.id), { read: true });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
    } catch (error) {
      console.error("Error marking notifications read:", error);
    }
  };

  const clearNotifications = async () => {
    if (!user) return;
    try {
      const promises = notifications.map(n => deleteDoc(doc(db, 'notifications', n.id)));
      await Promise.all(promises);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  // Calculate Admin Profit Balance (Total ZAR from approved topups + agent cashout net profit)
  const approvedTopupsProfit = topUps
    .filter((t) => t.status === 'approved')
    .reduce((sum, t) => sum + t.option.amount, 0);

  const approvedCashoutsNetProfit = agentCashouts
    .filter((a) => a.status === 'approved')
    .reduce((sum, a) => {
      let packageAmountZAR = 400;
      if (a.rewardBoxCompleted.includes('2000c')) packageAmountZAR = 20 * 20;
      else if (a.rewardBoxCompleted.includes('4000c')) packageAmountZAR = 40 * 20;
      else if (a.rewardBoxCompleted.includes('6000c')) packageAmountZAR = 60 * 20;
      else if (a.rewardBoxCompleted.includes('8000c')) packageAmountZAR = 80 * 20;
      else if (a.rewardBoxCompleted.includes('10000c')) packageAmountZAR = 100 * 20;
      else if (a.rewardBoxCompleted.includes('20000c')) packageAmountZAR = 200 * 20;

      let rewardZAR = 200;
      if (a.cashoutAmount.includes('400')) rewardZAR = 400;
      else if (a.cashoutAmount.includes('600')) rewardZAR = 600;
      else if (a.cashoutAmount.includes('800')) rewardZAR = 800;
      else if (a.cashoutAmount.includes('1.000') || a.cashoutAmount.includes('1000')) rewardZAR = 1000;
      else if (a.cashoutAmount.includes('2.000') || a.cashoutAmount.includes('2000')) rewardZAR = 2000;

      const net = Math.max(0, packageAmountZAR - rewardZAR);
      return sum + net;
    }, 0);

  const totalProfit = approvedTopupsProfit + approvedCashoutsNetProfit;

  const [authLoading, setAuthLoading] = useState(false);
  
  const handleForgotPassword = async () => {
    const email = authEmail.trim().toLowerCase();
    if (!email) {
      setToastMessage('📧 Please enter your email address first.');
      return;
    }
    setAuthLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setToastMessage('📩 Password reset link sent to your email!');
    } catch (error: any) {
      console.error("Reset error:", error);
      setToastMessage(`❌ Reset error: ${error.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = authEmail.trim().toLowerCase();
    const password = authPassword.trim();

    if (email && password && (authMode === 'login' || acceptedTerms)) {
      setAuthLoading(true);
      try {
        if (authMode === 'login') {
          await signInWithEmailAndPassword(auth, email, password);
          setToastMessage('🔑 Welcome back! Redirecting...');
        } else {
          await createUserWithEmailAndPassword(auth, email, password);
          setShowCongrats(true);
          setTimeout(() => {
            setShowCongrats(false);
            setTourStep(1); // Start tour
          }, 3000);
        }
      } catch (error: any) {
        console.error("Auth error:", error);
        let errorMessage = 'Auth error. Please try again.';
        
        // Map common Firebase auth errors to friendly messages
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'Account not found. Please check your email or sign up.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password. Please try again or reset it.';
            break;
          case 'auth/email-already-in-use':
            errorMessage = 'This email is already registered. Switching to login mode...';
            // Automatically help user by suggesting login mode
            setAuthMode('login');
            break;
          case 'auth/invalid-credential':
          case 'auth/invalid-login-credentials':
            errorMessage = 'Incorrect email or password. Please verify your credentials.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please use at least 6 characters.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Access temporarily disabled due to many failed attempts. Try again later.';
            break;
          default:
            errorMessage = error.message || 'Authentication failed. Please check your connection.';
        }
        
        setToastMessage(`❌ ${errorMessage}`);
        setTimeout(() => setToastMessage(null), 5000);
      } finally {
        setAuthLoading(false);
      }
    }
  };

  const handleNextTourStep = () => {
    if (tourStep === 1) {
      setTourStep(2);
      setShowNotifications(true); // Open notifications to show them
    } else if (tourStep === 2) {
      setShowNotifications(false);
      setTourStep(3);
      setActiveScreen('referral');
    } else if (tourStep === 3) {
      setTourStep(4);
      setActiveScreen('wallet');
    } else if (tourStep === 4) {
      setTourStep(5);
      setActiveScreen('chat');
    } else if (tourStep === 5) {
      setTourStep(0);
      setActiveScreen('home');
    }
  };

  const isAdmin = isAdminUser;

  if (showSplash || isAuthLoading) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100] animate-fadeIn">
        <AppNameWithCoins className="text-5xl font-black text-black tracking-widest uppercase mb-4" iconSize="w-8 h-8" />
        {isAuthLoading && (
           <div className="flex flex-col items-center space-y-2">
             <div className="w-6 h-6 border-2 border-neutral-200 border-t-black rounded-full animate-spin" />
             <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">Checking workspace...</p>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white text-neutral-900 flex flex-col justify-between select-none font-sans relative ${activeScreen === 'chat' || activeScreen === 'signup' ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {tourStep > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 animate-fadeIn border border-neutral-200">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <span>
                {tourStep === 1 && <div className="flex items-center space-x-2">Welcome to <AppNameWithCoins className="font-bold" />!</div>}
                {tourStep === 2 && "Stay Updated"}
                {tourStep === 3 && "Earn with Referrals"}
                {tourStep === 4 && "Manage Your Wallet"}
                {tourStep === 5 && "Chat & Connect"}
              </span>
            </h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
                {tourStep === 1 && "Browse and post local services in the GIGs marketplace."}
                {tourStep === 2 && "Check the bell icon for alerts about new gigs and messages."}
                {tourStep === 3 && "Join our agent program, refer friends, and earn real cash."}
                {tourStep === 4 && "Top up your coins and track your cashouts securely."}
                {tourStep === 5 && "Communicate directly with clients and service providers."}
            </p>
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-neutral-400 font-medium">Step {tourStep} of 5</span>
              <button
                onClick={handleNextTourStep}
                className="px-5 py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors"
              >
                {tourStep === 5 ? "Get Started" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGigCongrats && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 overflow-hidden">
          <div className="bg-white rounded-[32px] p-8 shadow-2xl max-w-sm w-full space-y-6 animate-scaleIn border border-neutral-100 text-center relative">
            <BlurryCoinsBg opacity={0.1} overlay="bg-white/80" />
            <div className="relative z-10 space-y-6">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-2 rotate-3 shadow-sm border border-emerald-100">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-neutral-900 tracking-tight">Gig Published!</h2>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  Congratulations! Your gig is now live on the marketplace. Redirecting you to the feed...
                </p>
              </div>
              <div className="flex justify-center">
                 <div className="flex space-x-1">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar with Feedback, Facebook, Admin and Notification Bell (Hidden on Chat Screen) */}
      {activeScreen !== 'chat' && (
        <header className="w-full px-6 py-3 flex items-center justify-end border-b border-neutral-200 sticky top-0 z-40 bg-white/75 backdrop-blur-xl overflow-hidden relative shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
          <div className="flex items-center space-x-1 sm:space-x-2 relative z-10">
            {/* Feedback small icon */}
            <button
              onClick={() => setShowFeedbackModal(true)}
              className="p-1.5 text-neutral-600 hover:text-black transition-colors"
              title="Feedback"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            
            {/* Facebook small icon */}
            <a
              href="https://www.facebook.com/profile.php?id=61592108856924"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-neutral-600 hover:text-[#1877F2] transition-colors"
              title="Facebook"
            >
              <Facebook className="w-4 h-4" />
            </a>

            <div className="h-4 w-[1px] bg-neutral-200 mx-1"></div>

            {/* Notification Bell */}
            {isLoggedIn && (
              <button
                onClick={() => {
                  setShowNotifications(true);
                  markAllNotificationsRead();
                }}
                className="p-2 rounded-full transition-colors text-neutral-600 hover:bg-neutral-100 hover:text-black relative"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Admin Icon */}
            {isLoggedIn && isAdmin && (
              <button
                onClick={() => setActiveScreen('admin')}
                className={`p-2 rounded-full transition-colors ${
                  activeScreen === 'admin'
                    ? 'bg-black text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-black'
                }`}
                title="Admin Panel"
                aria-label="Admin Panel"
              >
                <Shield className="w-5 h-5" />
              </button>
            )}

            {/* Logout Top Corner Icon Button */}
            <button
              onClick={handleLogout}
              className={`p-2 rounded-full transition-colors relative ${
                isLoggedIn
                  ? 'text-neutral-600 hover:bg-neutral-100 hover:text-rose-500'
                  : 'text-white bg-black hover:bg-neutral-900 shadow-xs'
              }`}
              title={isLoggedIn ? "Log Out" : "Log In"}
              aria-label={isLoggedIn ? "Log Out" : "Log In"}
            >
              {isLoggedIn ? <LogOut className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            </button>
          </div>
        </header>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-medium flex items-center space-x-2 border border-neutral-700 animate-fadeIn max-w-sm w-full mx-auto">
          <Bell className="w-4 h-4 text-yellow-400 shrink-0 animate-bounce" />
          <span className="flex-1 truncate">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-neutral-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Centered Notification Board Modal */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left border border-neutral-100">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-neutral-800" />
                <h3 className="font-semibold text-base text-neutral-900">Notification Board</h3>
              </div>
              <div className="flex items-center space-x-3">
                {notifications.length > 0 && (
                  <button
                    onClick={clearNotifications}
                    className="text-xs text-neutral-500 hover:text-black underline transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-neutral-400 text-sm">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (n.gigId) {
                        const g = gigs.find(item => item.id === n.gigId);
                        if (g) {
                          setSelectedGig(g);
                          setActiveScreen('home');
                          setShowNotifications(false);
                        }
                      }
                    }}
                    className={`p-4 rounded-xl border bg-neutral-50/70 border-neutral-200/60 space-y-1 transition-all ${
                      n.gigId ? 'cursor-pointer hover:border-black/30 hover:bg-neutral-100/80 shadow-2xs' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-900 flex items-center space-x-1">
                        <span>{n.title}</span>
                      </span>
                      <span className="text-[10px] text-neutral-400">{n.time}</span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">{n.message}</p>
                    {n.gigId && (
                      <div className="pt-1 text-[11px] font-semibold text-black flex items-center space-x-1">
                        <span>View Gig Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowNotifications(false)}
              className="w-full py-3 bg-black text-white rounded-xl font-medium text-sm hover:bg-neutral-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col items-center justify-start ${activeScreen === 'chat' || activeScreen === 'signup' ? 'p-0 sm:p-2 h-full overflow-hidden max-w-4xl' : 'p-4 sm:p-6 max-w-2xl'} mx-auto w-full`}>
        {activeScreen === 'signup' && (
          <div className="w-full h-full flex flex-col items-center justify-center relative p-6 animate-fadeIn">
            <BlurryCoinsBg opacity={0.2} overlay="bg-neutral-50/80" />
            <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-xl border border-neutral-200/60 p-8 space-y-6">
              {showCongrats ? (
                <div className="text-center space-y-4 py-8 animate-fadeIn">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-neutral-900">Congratulations!</h2>
                  <p className="text-sm text-neutral-500">Your workspace is ready. Redirecting to gigs...</p>
                </div>
              ) : (
                <>
                  <div className="text-center space-y-2">
                    <AppNameWithCoins className="text-sm font-black text-black tracking-[0.3em] uppercase mb-6" />
                    <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
                      {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
                    </h1>
                    <p className="text-xs text-neutral-500">
                      {authMode === 'signup' ? 'Join the ultimate local services marketplace' : 'Log in to access your workspace'}
                    </p>
                  </div>
                  <form onSubmit={handleAuth} className="space-y-4 mt-8">
                    <div className="space-y-3">
                      <input
                        type="email"
                        placeholder="Email address"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                        required
                      />
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black p-1"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {authMode === 'signup' && (
                      <label className="flex items-start space-x-3 pt-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          className="mt-1 form-checkbox h-4 w-4 text-black rounded border-neutral-300 focus:ring-black cursor-pointer"
                          required
                        />
                        <span className="text-xs text-neutral-600 leading-relaxed group-hover:text-neutral-900 transition-colors">
                          I accept the <span className="font-semibold text-black underline">Terms and Conditions</span> and acknowledge that I will receive my own workspace.
                        </span>
                      </label>
                    )}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-[10px] text-neutral-400 hover:text-black transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading || !authEmail || !authPassword || (authMode === 'signup' && !acceptedTerms)}
                      className="w-full py-3.5 bg-black text-white rounded-xl text-sm font-bold shadow-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4 flex items-center justify-center space-x-2"
                    >
                      {authLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      <span>{authMode === 'signup' ? 'Sign Up' : 'Log In'}</span>
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode(authMode === 'signup' ? 'login' : 'signup');
                          setAuthPassword(''); // Clear password when switching
                          setShowPassword(false);
                        }}
                        className="text-xs text-neutral-500 hover:text-black transition-colors"
                      >
                        {authMode === 'signup' ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
        
        {activeScreen === 'home' && (
          <div className="w-full space-y-6 animate-fadeIn py-2">
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-start space-x-3 mb-2 shadow-sm">
              <Zap className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-bold block mb-1">Welcome to <AppNameWithCoins className="font-bold" />!</span>
                Please note that this application is currently new and under active development. Some features may be limited or subject to change. Thank you for your support!
              </div>
            </div>

            {/* Dynamic Gold "Refer & Earn" Guidance Banner */}
            <div 
              onClick={() => {
                setActiveScreen('referral');
                setWalletStep('overview');
              }}
              className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer transition-all duration-300 shadow-xs hover:shadow-md hover:border-amber-500/50 group"
            >
              <div className="flex items-start space-x-3.5 relative z-10">
                <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm border border-amber-400 animate-pulse">
                  💵
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-sm sm:text-base flex items-center gap-1.5 flex-wrap">
                    Become an Agent & Earn Real Cash! <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider animate-pulse">Hot Reward</span>
                  </h3>
                  <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                    Refer your friends, colleagues, and family! Earn direct bank payouts of up to <span className="font-extrabold text-neutral-900">R2,000.00 cash</span> when they join and participate!
                  </p>
                </div>
              </div>
              <button className="px-4 py-2.5 bg-black text-white hover:bg-neutral-800 rounded-xl text-xs font-bold shrink-0 transition-all group-hover:scale-105 shadow-sm">
                Get Invite Link →
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-neutral-900">GIGs Marketplace</h1>
                <p className="text-xs text-neutral-500 mt-0.5">Explore services, local jobs & community gigs posted by users.</p>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={triggerSimulatedGigAlert}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-neutral-200/80"
                  title="Receive new gig alert notification"
                >
                  <Bell className="w-3.5 h-3.5 text-neutral-700" />
                  <span className="hidden sm:inline">Receive Gig Alert</span>
                </button>
                <button
                  onClick={() => setShowCreateGigModal(true)}
                  className="px-4 py-2.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Post Gig</span>
                </button>
              </div>
            </div>

            {/* Gigs Grid (Facebook Marketplace style) */}
            {gigs.length === 0 ? (
              <div className="relative overflow-hidden w-full bg-white border border-neutral-200/90 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-2xs">
                <BlurryCoinsBg opacity={0.15} overlay="bg-white/85" />
                <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-neutral-100/90 text-neutral-600 flex items-center justify-center border border-neutral-200 shadow-2xs">
                    <Briefcase className="w-8 h-8 text-neutral-800" />
                  </div>
                  <div className="max-w-md space-y-1.5">
                    <h3 className="text-base font-bold text-neutral-900">No GIGs Posted Yet</h3>
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      The marketplace is ready for real members! Post your first gig or request to offer local services or find help.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateGigModal(true)}
                    className="px-5 py-2.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Post Your First Gig</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
                {gigs.map((gig) => (
                  <div
                    key={gig.id}
                    onClick={() => setSelectedGig(gig)}
                    className="relative overflow-hidden bg-white border border-neutral-200/80 rounded-2xl shadow-2xs hover:shadow-md hover:border-neutral-300 transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <BlurryCoinsBg opacity={0.12} overlay="bg-white/90" />
                    <div className="relative z-10 flex flex-col justify-between h-full">
                      <div>
                        <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
                          <img
                            src={gig.imageUrl}
                            alt={gig.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-amber-500/20">
                            {gig.price}
                          </span>
                        </div>

                        <div className="p-3.5 space-y-1.5">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">{gig.category}</div>
                          <h3 className="font-semibold text-neutral-900 text-xs sm:text-sm line-clamp-2 leading-snug">{gig.title}</h3>
                          <div className="text-[11px] text-neutral-500 flex items-center space-x-1 truncate">
                            <span>📍</span>
                            <span className="truncate">{gig.location}</span>
                          </div>
                        </div>
                      </div>

                      <div className="px-3.5 pb-3.5 pt-2 border-t border-neutral-100 flex items-center justify-between gap-1.5">
                        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                          <img
                            src={gig.authorAvatar}
                            alt={gig.authorName}
                            className="w-5 h-5 rounded-full object-cover shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-[11px] text-neutral-600 font-medium truncate">{gig.authorName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyGig(gig);
                          }}
                          className="px-2.5 py-1 bg-black hover:bg-neutral-800 text-white rounded-lg text-[10px] font-semibold flex items-center space-x-1 shrink-0 transition-colors shadow-2xs"
                          title={`Chat with ${gig.authorName}`}
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Chat</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeScreen === 'wallet' && (
          <div className="w-full flex-1 flex flex-col py-2">
            {walletStep === 'overview' && (
              <div className="space-y-6 w-full animate-fadeIn">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-semibold text-neutral-900">Wallet</h1>
                </div>

                {/* Coin Balance Block */}
                <div className="relative overflow-hidden bg-neutral-900 text-white p-6 rounded-2xl shadow-md flex flex-col justify-between space-y-4 border border-amber-500/20">
                  <BlurryCoinsBg opacity={0.35} overlay="bg-gradient-to-r from-neutral-950/80 via-black/60 to-amber-950/50" />
                  <div className="relative z-10 space-y-4">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-amber-300/80 font-medium">Available Balance</span>
                      <div className="text-3xl font-bold tracking-tight mt-1 text-white">{balance}c</div>
                    </div>
                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                      <span className="text-xs text-neutral-300 font-medium">Verified Coins</span>
                      <button
                        onClick={() => setWalletStep('topup_options')}
                        className="bg-white text-neutral-900 px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors flex items-center space-x-1.5 shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Top Up</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Earn Cash through Referral Guide */}
                <div 
                  onClick={() => {
                    setActiveScreen('referral');
                    setWalletStep('overview');
                  }}
                  className="bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold shrink-0">
                      🎁
                    </div>
                    <div>
                      <div className="text-sm font-bold text-neutral-950">Short on coins or cash?</div>
                      <div className="text-xs text-neutral-600 mt-0.5">Refer friends and convert your coin tier to instant bank payouts!</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-600 hover:text-amber-700 whitespace-nowrap">Invite Now →</span>
                </div>

                {/* Top Ups History / Pending */}
                {topUps.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-medium text-neutral-600">Top-Up Requests</h2>
                    <div className="space-y-2">
                      {topUps.map((item) => (
                        <div key={item.id} className="bg-neutral-50 border border-neutral-200/60 p-4 rounded-xl flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${
                              item.status === 'approved' ? 'bg-green-50 text-green-600' :
                              item.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {item.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> :
                               item.status === 'rejected' ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-neutral-800">+{item.option.label} ({item.option.price})</div>
                              <div className="text-xs text-neutral-400">{item.date} • {item.fileName}</div>
                            </div>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                            item.status === 'approved' ? 'bg-green-100 text-green-800' :
                            item.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Latest Transactions */}
                <div className="space-y-3 pt-2">
                  <h2 className="text-sm font-medium text-neutral-600">Latest Transactions</h2>
                  {topUps.length === 0 ? (
                    <div className="bg-neutral-50 border border-neutral-200/60 p-6 rounded-2xl text-center text-neutral-400 text-xs">
                      No transactions yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topUps.map((item) => (
                        <div key={item.id} className="bg-neutral-50 border border-neutral-200/60 p-4 rounded-xl flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-full bg-neutral-200/60 flex items-center justify-center font-bold text-neutral-700">
                              🪙
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-neutral-900">Top-Up {item.option.label}</div>
                              <div className="text-xs text-neutral-500">{item.date} • Ref: {item.option.label}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-neutral-900">+{item.option.coins}c</div>
                            <div className={`text-[10px] font-medium capitalize ${
                              item.status === 'approved' ? 'text-green-600' :
                              item.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                            }`}>
                              {item.status} ({item.option.price})
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {walletStep === 'topup_options' && (
              <div className="space-y-6 w-full animate-fadeIn">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setWalletStep('overview')}
                    className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-600"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-xl font-semibold text-neutral-900">Select Coin Package</h1>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {COIN_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => {
                        setSelectedOption(opt);
                        setWalletStep('bank_transfer');
                      }}
                      className="relative overflow-hidden w-full bg-white border border-neutral-200 hover:border-black p-4 rounded-xl flex items-center justify-between transition-all group shadow-xs hover:shadow-sm"
                    >
                      <BlurryCoinsBg opacity={0.18} overlay="bg-white/80" />
                      <div className="relative z-10 flex items-center justify-between w-full">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-neutral-700 group-hover:bg-black group-hover:text-white transition-colors">
                            🪙
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-neutral-900">{opt.label}</div>
                            <div className="text-xs text-neutral-500">Instant top-up package</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-neutral-900">{opt.price}</div>
                          <div className="text-xs text-neutral-400 group-hover:text-black">Select →</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {walletStep === 'bank_transfer' && selectedOption && (
              <div className="space-y-6 w-full animate-fadeIn pb-6">
                {/* Header with back button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        setWalletStep('topup_options');
                        setProofFile(null);
                        setScanResults(null);
                        setIsOcrVerified(false);
                      }}
                      className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-600"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h1 className="text-xl font-bold text-neutral-900">Advanced Top-up Portal</h1>
                      <p className="text-xs text-neutral-500">Secure automated POP verification</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-semibold text-amber-700 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                    <span>AI-OCR Enabled</span>
                  </div>
                </div>

                {/* Modern Segmented Tab Controls */}
                <div className="bg-neutral-100 p-1.5 rounded-xl grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setPaymentTab('details')}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                      paymentTab === 'details'
                        ? 'bg-white text-black shadow-xs'
                        : 'text-neutral-500 hover:text-black'
                    }`}
                  >
                    <span>1. Transfer</span>
                  </button>
                  <button
                    onClick={() => setPaymentTab('security')}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                      paymentTab === 'security'
                        ? 'bg-white text-black shadow-xs'
                        : 'text-neutral-500 hover:text-black'
                    }`}
                  >
                    <span>2. Upload & Scan</span>
                    {proofFile && (
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                    )}
                  </button>
                  <button
                    onClick={() => setPaymentTab('guide')}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                      paymentTab === 'guide'
                        ? 'bg-white text-black shadow-xs'
                        : 'text-neutral-500 hover:text-black'
                    }`}
                  >
                    <span>3. Guidelines</span>
                  </button>
                </div>

                {/* Tab Content 1: Transfer details */}
                {paymentTab === 'details' && (
                  <div className="space-y-4 animate-fadeIn text-left">
                    <div className="bg-neutral-50 border border-neutral-200/80 p-4 rounded-xl text-xs text-neutral-600 flex items-start space-x-2.5">
                      <AlertCircle className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
                      <div>
                        To purchase the <strong className="text-black">{selectedOption.label}</strong> package, transfer exactly <strong className="text-black">{selectedOption.price}</strong> using the designated Capitec details below. Use the mandatory reference.
                      </div>
                    </div>

                    <div className="relative overflow-hidden bg-neutral-900 text-white p-5 rounded-2xl space-y-4 shadow-md">
                      <BlurryCoinsBg opacity={0.3} overlay="bg-gradient-to-r from-neutral-950/90 via-black/80 to-neutral-950/90" />
                      
                      <div className="relative z-10 space-y-3.5">
                        <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
                          <span className="text-xs text-neutral-400 font-medium">Selected top-up</span>
                          <span className="text-sm font-bold text-amber-400">{selectedOption.label} ({selectedOption.price})</span>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {/* Bank Name */}
                          <div className="flex items-center justify-between p-2.5 bg-neutral-950/50 rounded-xl border border-neutral-800/60 hover:border-neutral-700 transition-colors">
                            <div>
                              <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Bank Name</span>
                              <div className="font-semibold text-white text-sm">Capitec Bank</div>
                            </div>
                            <button
                              onClick={() => handleCopyField('bank', 'Capitec Bank')}
                              className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                              title="Copy Bank Name"
                            >
                              {copiedStates['bank'] ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* Account Name */}
                          <div className="flex items-center justify-between p-2.5 bg-neutral-950/50 rounded-xl border border-neutral-800/60 hover:border-neutral-700 transition-colors">
                            <div>
                              <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Account Holder</span>
                              <div className="font-semibold text-white text-sm">Matthews</div>
                            </div>
                            <button
                              onClick={() => handleCopyField('holder', 'Matthews')}
                              className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                              title="Copy Account Holder"
                            >
                              {copiedStates['holder'] ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* Account Number */}
                          <div className="flex items-center justify-between p-2.5 bg-neutral-950/50 rounded-xl border border-neutral-800/60 hover:border-neutral-700 transition-colors">
                            <div>
                              <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Account Number</span>
                              <div className="font-mono font-bold text-amber-300 text-base tracking-wider">1334067366</div>
                            </div>
                            <button
                              onClick={() => handleCopyField('account', '1334067366')}
                              className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                              title="Copy Account Number"
                            >
                              {copiedStates['account'] ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* Required Reference */}
                          <div className="p-3 bg-neutral-950 border border-amber-500/20 rounded-xl">
                            <span className="text-[10px] text-amber-300/80 uppercase tracking-wider font-semibold">Mandatory Reference</span>
                            <div className="flex items-center justify-between mt-1">
                              <span className="font-mono font-bold text-amber-400 text-lg tracking-widest">{selectedOption.label}</span>
                              <button
                                onClick={() => handleCopyField('reference', selectedOption.label)}
                                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all border border-amber-500/30"
                              >
                                {copiedStates['reference'] ? <Check className="w-3.5 h-3.5 text-green-300" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedStates['reference'] ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setPaymentTab('security')}
                      className="w-full py-3.5 bg-black text-white rounded-xl font-semibold text-sm hover:bg-neutral-800 transition-all shadow-sm flex items-center justify-center space-x-2"
                    >
                      <span>I have made the transfer →</span>
                    </button>
                  </div>
                )}

                {/* Tab Content 2: Upload and AI Scan */}
                {paymentTab === 'security' && (
                  <div className="space-y-5 animate-fadeIn text-left">
                    <div>
                      <label className="block text-xs font-bold text-neutral-800 mb-1.5 uppercase tracking-wider">
                        Upload POP (PDF or Image)
                      </label>
                      
                      {/* Drag & Drop Container */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all relative overflow-hidden ${
                          isDragOver
                            ? 'border-black bg-neutral-50 scale-[0.99] shadow-inner'
                            : proofFile
                            ? 'border-green-200 bg-green-50/20'
                            : 'border-neutral-300 hover:border-black bg-white hover:bg-neutral-50/50'
                        }`}
                      >
                        <input
                          type="file"
                          onChange={handleProofFileChange}
                          accept="image/*,application/pdf"
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        />
                        
                        <div className="flex flex-col items-center space-y-2.5 relative z-0">
                          <div className={`p-3 rounded-full ${
                            proofFile ? 'bg-green-100 text-green-600' : 'bg-neutral-100 text-neutral-500'
                          }`}>
                            <Upload className="w-6 h-6" />
                          </div>
                          
                          <div className="text-xs text-neutral-600">
                            {proofFile ? (
                              <span className="font-semibold text-neutral-900 break-all">{proofFile.name}</span>
                            ) : (
                              <>
                                <span className="font-bold text-black underline">Choose files</span> or drag & drop POP here
                              </>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-400">PDF, PNG, JPG accepted (up to 1MB, automatically compressed)</span>
                        </div>
                      </div>
                    </div>

                    {/* Scanning Feedback Overlay Animation */}
                    {isScanningProof && (
                      <div className="bg-neutral-950 text-white rounded-xl p-4 space-y-3 relative overflow-hidden border border-amber-500/20 shadow-lg animate-pulse">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-amber-400 opacity-80 shadow-[0_0_10px_#f59e0b] animate-scan-beam" style={{
                          animation: 'scan-beam 2s infinite linear'
                        }} />
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-amber-400 flex items-center space-x-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>AI-OCR Reading System...</span>
                          </span>
                          <span className="font-mono">{scanProgress}%</span>
                        </div>

                        {/* Progress slider bar */}
                        <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-400 h-1.5 rounded-full transition-all duration-150"
                            style={{ width: `${scanProgress}%` }}
                          />
                        </div>

                        {/* Scanner stage label */}
                        <div className="text-[10px] text-neutral-400 font-mono text-center">
                          {scanProgress < 30 && "⚙️ Initializing Secure OCR Reader..."}
                          {scanProgress >= 30 && scanProgress < 60 && "🔍 Inspecting Capitec digital watermark..."}
                          {scanProgress >= 60 && scanProgress < 85 && "📝 Extracting transaction amount & reference..."}
                          {scanProgress >= 85 && scanProgress < 100 && "🛡️ Validating security keys with bank register..."}
                          {scanProgress === 100 && "✅ AI scan verified successfully!"}
                        </div>
                      </div>
                    )}

                    {/* Uploaded File Details & Controls (Rotation, Trash) */}
                    {proofFile && !isScanningProof && (
                      <div className="space-y-3">
                        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-neutral-200 text-neutral-700 rounded-lg">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="text-left">
                                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Document Ready</span>
                                <h4 className="text-xs font-bold text-neutral-900 break-all leading-snug">{proofFile.name}</h4>
                                <p className="text-[10px] text-neutral-500">
                                  Size: {(proofFile.size / 1024).toFixed(1)} KB • Format: {proofFile.type}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setProofFile(null);
                                setScanResults(null);
                                setIsOcrVerified(false);
                              }}
                              className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete File"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Interactive Image Preview with Rotation Angle */}
                          {proofFile.type.startsWith('image/') && (
                            <div className="flex flex-col items-center space-y-2 pt-2 border-t border-neutral-200">
                              <div className="relative border border-neutral-200 bg-neutral-100 rounded-lg overflow-hidden max-h-40 flex items-center justify-center p-2 w-full">
                                <img
                                  src={previewUrl || ''}
                                  alt="Proof thumbnail"
                                  className="max-h-36 object-contain rounded transition-transform duration-300 shadow-xs"
                                  style={{ transform: `rotate(${previewRotation}deg)` }}
                                />
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setPreviewRotation(prev => (prev + 90) % 360)}
                                  className="px-2.5 py-1 bg-white border border-neutral-300 hover:border-black rounded-lg text-[10px] font-semibold text-neutral-700 flex items-center space-x-1 transition-colors"
                                >
                                  <RefreshCw className="w-3 h-3 text-neutral-500" />
                                  <span>Rotate 90°</span>
                                </button>
                                <span className="text-[10px] text-neutral-400">Angle: {previewRotation}°</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Smart Scanner Metadata Results Card */}
                        {scanResults && (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-green-700 tracking-wider flex items-center space-x-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                                <span>AI Scanner Analysis</span>
                              </span>
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-[9px] font-bold rounded-md">
                                {scanResults.confidence.toFixed(1)}% Confidence
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-neutral-700">
                              <div className="bg-white/60 p-2 rounded-lg border border-green-100/50">
                                <span className="text-[9px] text-neutral-400 block uppercase">Extracted Reference</span>
                                <span className="font-mono text-neutral-900">{scanResults.txId}</span>
                              </div>
                              <div className="bg-white/60 p-2 rounded-lg border border-green-100/50">
                                <span className="text-[9px] text-neutral-400 block uppercase">Scanned Amount</span>
                                <span className="font-mono text-neutral-900">{scanResults.amount}</span>
                              </div>
                            </div>

                            <div className="flex items-start space-x-2 pt-1">
                              <input
                                type="checkbox"
                                id="ocr-confirm"
                                checked={isOcrVerified}
                                onChange={(e) => setIsOcrVerified(e.target.checked)}
                                className="mt-0.5 rounded border-neutral-300 text-green-600 focus:ring-green-500 cursor-pointer"
                              />
                              <label htmlFor="ocr-confirm" className="text-[10px] text-neutral-600 select-none cursor-pointer leading-tight">
                                I confirm that the scanned reference ID matches my receipt details perfectly.
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Final Submission Button with state guard */}
                    <button
                      type="button"
                      onClick={handleSubmitProof}
                      disabled={isSubmittingProof || isScanningProof || !proofFile || (scanResults && !isOcrVerified)}
                      className="w-full py-3.5 bg-black text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-colors shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmittingProof ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Submitting for Clearance...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Submit Verified POP</span>
                        </>
                      )}
                    </button>
                    
                    {!isOcrVerified && proofFile && scanResults && (
                      <p className="text-[10px] text-neutral-400 text-center">
                        ⚠️ Please check the OCR confirmation box before submitting
                      </p>
                    )}
                  </div>
                )}

                {/* Tab Content 3: Detailed Guidelines */}
                {paymentTab === 'guide' && (
                  <div className="space-y-4 animate-fadeIn text-left">
                    <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3.5">
                      <h4 className="text-sm font-bold text-neutral-900 flex items-center space-x-1.5">
                        <BookOpen className="w-4 h-4 text-amber-500" />
                        <span>Accepted POP Guide</span>
                      </h4>
                      
                      <div className="space-y-2.5 text-xs text-neutral-600">
                        <p>
                          Our advanced scanning algorithms automatically verify transactions instantly if the uploaded POP conforms to standard banking guidelines:
                        </p>
                        
                        <div className="grid grid-cols-1 gap-2 pt-1">
                          <div className="p-2.5 bg-white rounded-lg border border-neutral-200">
                            <span className="font-semibold text-neutral-800 block mb-0.5">✅ Valid Formats</span>
                            Official PDF reports or clear, uncropped screen captures of the successful transfer completion.
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-neutral-200">
                            <span className="font-semibold text-neutral-800 block mb-0.5">🔍 Scanner Requirements</span>
                            Ensure the <strong className="text-black">Reference Code</strong> and the <strong className="text-black">Exact Amount</strong> are fully visible without blur or highlights.
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-neutral-200">
                            <span className="font-semibold text-neutral-800 block mb-0.5">⚠️ Unacceptable Documents</span>
                            Handwritten receipts, blurred screen captures, crop-edited images, or deposit slips from ATM devices.
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setPaymentTab('security')}
                      className="w-full py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2"
                    >
                      <span>Proceed to Upload Section</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeScreen === 'referral' && (
          <div className="flex-1 flex flex-col items-start w-full space-y-6 py-2">
            <div className="flex items-center justify-between w-full">
              <div>
                <h1 className="text-xl font-semibold text-neutral-900">Referral Portal</h1>
                <p className="text-xs text-neutral-500 mt-0.5">Invite friends and earn cash rewards as an agent.</p>
              </div>
              {isBankingSaved && !isAgent && (
                <button
                  onClick={handleBecomeAgent}
                  className="px-4 py-2 bg-black text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors shadow-xs"
                >
                  Become an Agent
                </button>
              )}
            </div>

            <div className="w-full bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm font-medium flex items-center space-x-2">
              <Clock className="w-5 h-5 shrink-0" />
              <span>Hurry! The referral program ends in 90 days.</span>
            </div>

            {/* Real Cash Guidance Guide */}
            <div className="w-full bg-linear-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/15 rounded-2xl p-5 space-y-3.5">
              <h2 className="text-xs sm:text-sm font-bold text-amber-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                How to Earn Real Cash in 3 Steps
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <div className="space-y-1 bg-white p-3.5 rounded-xl border border-neutral-200/60 shadow-2xs">
                  <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-mono text-[10px] shrink-0">1</span>
                    Save Bank Info
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    Securely enter your banking details below so we can process direct bank transfers to you.
                  </p>
                </div>
                <div className="space-y-1 bg-white p-3.5 rounded-xl border border-neutral-200/60 shadow-2xs">
                  <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-mono text-[10px] shrink-0">2</span>
                    Invite Friends
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    Share your personalized reward box links on WhatsApp, X (Twitter), Facebook or Telegram.
                  </p>
                </div>
                <div className="space-y-1 bg-white p-3.5 rounded-xl border border-neutral-200/60 shadow-2xs">
                  <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-mono text-[10px] shrink-0">3</span>
                    Get Direct Cash
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    When your invitees join and top up, claim up to R2,000.00 cash rewards instantly!
                  </p>
                </div>
              </div>
            </div>

            {/* Mandatory Banking Details Section */}
            {!isBankingSaved ? (
              <div className="relative overflow-hidden w-full bg-amber-50/90 border border-amber-300 p-6 rounded-2xl space-y-4 shadow-xs">
                <BlurryCoinsBg opacity={0.25} overlay="bg-amber-50/80 backdrop-blur-2xs" />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0 border border-amber-200">
                      ⚠️
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-neutral-900 text-base">Banking Details Required</h3>
                      <p className="text-xs text-neutral-600 leading-relaxed">
                        You must fill in and save your valid bank account details before you can become an agent and start referring users to earn cash rewards.
                      </p>
                    </div>
                  </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!bankName || !accountNumber || !branchCode || !accountHolder) {
                      alert('Please fill in all banking details.');
                      return;
                    }
                    if (user) {
                      try {
                        await updateDoc(doc(db, 'users', user.uid), {
                          bankName,
                          accountNumber,
                          branchCode,
                          accountHolder
                        });
                        setIsBankingSaved(true);
                        setToastMessage('✅ Banking details saved securely.');
                        setTimeout(() => setToastMessage(null), 3000);
                      } catch (err) {
                        console.error("Error saving banking details:", err);
                      }
                    } else {
                      setIsBankingSaved(true);
                    }
                  }}
                  className="space-y-4 pt-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. FNB, Capitec, Standard Bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Full Name as on Account"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Account Number</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 1334067366"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Branch Code</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 250655"
                        value={branchCode}
                        onChange={(e) => setBranchCode(e.target.value)}
                        className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-black text-white rounded-xl font-medium text-sm hover:bg-neutral-800 transition-colors shadow-xs"
                  >
                    Save Banking Details & Start Referring
                  </button>
                </form>
                </div>
              </div>
            ) : (
              <>
                {/* Saved Banking Details Summary & Edit Toggle */}
                <div className="w-full bg-white border border-neutral-200 p-4 rounded-xl flex items-center justify-between shadow-2xs">
                  <div className="space-y-0.5">
                    <div className="text-[11px] text-neutral-500 font-medium">Saved Payout Bank Account</div>
                    <div className="text-sm font-bold text-neutral-900">{bankName} • <span className="font-mono">{accountNumber}</span></div>
                    <div className="text-xs text-neutral-600">Holder: {accountHolder} (Branch: {branchCode})</div>
                  </div>
                  <button
                    onClick={() => setIsBankingSaved(false)}
                    className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-medium transition-colors"
                  >
                    Edit Bank Info
                  </button>
                </div>

                {isAgent && (
                  <div className="relative overflow-hidden w-full bg-neutral-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-md border border-amber-500/20">
                    <BlurryCoinsBg opacity={0.35} overlay="bg-gradient-to-r from-neutral-950/80 via-black/60 to-amber-950/50" />
                    <div className="relative z-10 flex items-center justify-between w-full">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-amber-300 border border-amber-500/30">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-amber-300/80 font-medium">Agent Status</div>
                          <div className="text-base font-semibold">Active Agent Partner</div>
                        </div>
                      </div>
                      <span className="text-xs px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-medium">Verified</span>
                    </div>
                  </div>
                )}

                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-neutral-800">Agent Reward Boxes ({rewardBoxes.length})</h2>
                    <span className="text-xs text-neutral-400">Earn cash rewards as you refer users</span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 w-full">
                    {rewardBoxes.map((box) => {
                      const isExpanded = expandedBoxId === box.id;
                      const percentage = Math.min(100, Math.round((box.progress / box.referralsRequired) * 100));

                      return (
                        <div
                          key={box.id}
                          onClick={() => setExpandedBoxId(isExpanded ? null : box.id)}
                          className={`relative overflow-hidden ${box.bgColor} border ${box.borderColor} p-5 rounded-2xl shadow-xs space-y-4 cursor-pointer transition-all hover:shadow-md group`}
                        >
                          <BlurryCoinsBg opacity={0.22} overlay="bg-white/75 backdrop-blur-2xs" />
                          <div className="relative z-10 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-xl bg-white/90 border border-neutral-200/80 flex items-center justify-center font-bold text-neutral-900 shadow-xs">
                                  🎁
                                </div>
                                <div>
                                  <div className={`font-bold text-base ${box.color}`}>{box.reward} Cash Reward</div>
                                  <div className="text-xs text-neutral-600">Refer {box.referralsRequired} valid referrals to top up {box.targetCoins}</div>
                                </div>
                              </div>
                              <span className={`text-xs font-semibold px-2.5 py-1 ${box.badgeBg} rounded-lg shadow-2xs`}>
                                {box.targetCoins}
                              </span>
                            </div>

                          {/* Clickable toggle info */}
                          <div className="text-[11px] font-medium text-neutral-500 flex items-center justify-between pt-1">
                            <span>{isExpanded ? 'Hide progress details ▴' : 'Click to view progress & links ▾'}</span>
                            <span className="font-semibold text-neutral-700">{box.progress} / {box.referralsRequired} Referrals</span>
                          </div>

                          {/* Expanded Progress Bar and Links */}
                          {isExpanded && (
                            <div className="pt-3 border-t border-neutral-200/60 space-y-4 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-medium">
                                  <span className="text-neutral-700">Referral Goal Progress</span>
                                  <span className="text-neutral-900 font-bold">{percentage}% ({box.progress}/{box.referralsRequired})</span>
                                </div>
                                <div className="w-full bg-white/80 border border-neutral-200 rounded-full h-3 overflow-hidden p-0.5">
                                  <div
                                    className="bg-black h-full rounded-full transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono text-neutral-600 truncate">
                                  {box.link}
                                </div>
                                <button
                                  onClick={() => handleCopyRewardLink(box.id, box.link)}
                                  className="px-3.5 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-colors shrink-0"
                                >
                                  {copiedLinkId === box.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedLinkId === box.id ? 'Copied' : 'Copy Link'}</span>
                                </button>
                              </div>

                              {/* Social Media Sharing */}
                              <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                                <span>Share via:</span>
                                <div className="flex items-center space-x-3">
                                  <a
                                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Join and top up ${box.targetCoins} using my agent link: ${box.link}`)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-black font-medium transition-colors"
                                  >
                                    WhatsApp
                                  </a>
                                  <span>•</span>
                                  <a
                                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Earn rewards! Join and top up ${box.targetCoins} here: ${box.link}`)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-black font-medium transition-colors"
                                  >
                                    X / Twitter
                                  </a>
                                  <span>•</span>
                                  <a
                                    href={`https://t.me/share/url?url=${encodeURIComponent(box.link)}&text=${encodeURIComponent(`Top up ${box.targetCoins} reward link`)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-black font-medium transition-colors"
                                  >
                                    Telegram
                                  </a>
                                </div>
                              </div>

                              {percentage >= 100 && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!user) return;
                                    try {
                                      await addDoc(collection(db, 'agent_cashouts'), {
                                        userId: user.uid,
                                        agentName: accountHolder || user.email,
                                        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
                                        email: user.email,
                                        phone: 'N/A',
                                        bankName: bankName,
                                        accountNumber: accountNumber,
                                        branchCode: branchCode,
                                        totalReferrals: box.referralsRequired,
                                        rewardBoxCompleted: box.targetCoins,
                                        cashoutAmount: box.reward,
                                        status: 'pending',
                                        date: new Date().toLocaleDateString(),
                                        createdAt: serverTimestamp()
                                      });
                                      setToastMessage('✅ Cashout request submitted!');
                                      setTimeout(() => setToastMessage(null), 3000);
                                    } catch (error) {
                                      console.error("Error submitting cashout:", error);
                                    }
                                  }}
                                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm animate-pulse"
                                >
                                  Claim {box.reward} Reward
                                </button>
                              )}
                            </div>
                          )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeScreen === 'profile' && (
          <div className="w-full flex-1 flex flex-col h-full animate-fadeIn overflow-hidden">
            {isProfileLocked && pinInput !== profilePin ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 bg-white">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-neutral-400" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-neutral-900">Profile Locked</h2>
                  <p className="text-sm text-neutral-500">Enter your 4-digit PIN to access your profile.</p>
                </div>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div 
                      key={i}
                      className={`w-12 h-14 border-2 rounded-xl flex items-center justify-center text-xl font-bold transition-all ${
                        pinInput.length > i ? 'border-black bg-black text-white' : 'border-neutral-200 bg-neutral-50'
                      }`}
                    >
                      {pinInput.length > i ? '•' : ''}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '✓'].map((num) => (
                    <button
                      key={num}
                      onClick={() => {
                        if (num === 'C') setPinInput('');
                        else if (num === '✓') {
                          if (pinInput === profilePin) {
                            // PIN correct
                          } else {
                            setToastMessage('❌ Incorrect PIN');
                            setTimeout(() => setToastMessage(null), 3000);
                            setPinInput('');
                          }
                        }
                        else if (typeof num === 'number' && pinInput.length < 4) setPinInput(prev => prev + num);
                      }}
                      className={`h-14 rounded-xl text-lg font-semibold transition-colors flex items-center justify-center ${
                        num === '✓' ? 'bg-emerald-600 text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 bg-white pb-24">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">User Profile</h2>
                    <p className="text-xs text-neutral-400">Manage your personal information and presence</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isProfileLocked && (
                      <button 
                        onClick={() => setPinInput('')}
                        className="p-2 bg-neutral-100 text-neutral-500 rounded-full hover:bg-neutral-200 transition-colors"
                        title="Lock Profile"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                    )}
                    <button className="p-2 bg-neutral-900 text-white rounded-full hover:bg-neutral-800 transition-colors">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Profile Header */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-neutral-100 flex items-center justify-center relative group">
                      {profilePhotoURL ? (
                        <img src={profilePhotoURL} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-12 h-12 text-neutral-300" />
                      )}
                      <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        <Upload className="w-6 h-6 text-white" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleProfileImageUpload} />
                      </label>
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-neutral-900">
                      {profileFirstName || 'New'} {profileSurname || 'User'}
                    </h3>
                    <p className="text-xs text-neutral-400">{user?.email}</p>
                    {isAgent && (
                      <span className="inline-block mt-2 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                        Agent Partner
                      </span>
                    )}
                  </div>
                </div>

                {/* Profile Security / PIN */}
                <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white rounded-lg shadow-xs">
                        <Shield className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-800">Security PIN</p>
                        <p className="text-[10px] text-neutral-500">Lock your profile with a 4-digit code</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (!profilePin || profilePin.length !== 4) {
                          setToastMessage('⚠️ Please enter a 4-digit PIN first');
                          setTimeout(() => setToastMessage(null), 3000);
                          return;
                        }
                        setIsProfileLocked(!isProfileLocked);
                        if (!isProfileLocked) {
                          setToastMessage('🔒 Profile lock enabled');
                        } else {
                          setToastMessage('🔓 Profile lock disabled');
                        }
                        setTimeout(() => setToastMessage(null), 3000);
                      }}
                      className={`w-12 h-6 rounded-full transition-all duration-300 relative ${isProfileLocked ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${isProfileLocked ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase">Set PIN (4 digits)</label>
                      <input 
                        type="password"
                        maxLength={4}
                        placeholder="••••"
                        value={profilePin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          if (val.length <= 4) setProfilePin(val);
                        }}
                        className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                  </div>
                </div>

                {/* Basic Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest border-l-2 border-black pl-2">Basic Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">First Name</label>
                      <input 
                        value={profileFirstName}
                        onChange={(e) => setProfileFirstName(e.target.value)}
                        placeholder="First Name"
                        className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Surname</label>
                      <input 
                        value={profileSurname}
                        onChange={(e) => setProfileSurname(e.target.value)}
                        placeholder="Surname"
                        className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase">Middle Name</label>
                    <input 
                      value={profileMiddleName}
                      onChange={(e) => setProfileMiddleName(e.target.value)}
                      placeholder="Optional"
                      className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input 
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="+27 00 000 0000"
                        className="w-full pl-10 p-3 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest border-l-2 border-black pl-2">Province & Location</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Province</label>
                      <select 
                        value={profileProvince}
                        onChange={(e) => {
                          setProfileProvince(e.target.value);
                          setProfileLocation('');
                        }}
                        className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all appearance-none"
                      >
                        <option value="">Select</option>
                        {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Location</label>
                      <select 
                        value={profileLocation}
                        onChange={(e) => setProfileLocation(e.target.value)}
                        disabled={!profileProvince}
                        className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all appearance-none disabled:opacity-50"
                      >
                        <option value="">Select</option>
                        {profileProvince && PROVINCE_LOCATIONS[profileProvince]?.map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest border-l-2 border-black pl-2">Social Media</h3>
                    <button 
                      onClick={() => setProfileSocialLinks([...profileSocialLinks, ''])}
                      className="flex items-center space-x-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100"
                    >
                      <Plus className="w-3 h-3" />
                      <span>ADD LINK</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {profileSocialLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center space-x-2 animate-fadeIn">
                        <div className="flex-1 relative">
                          <ExternalLink className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                          <input 
                            value={link}
                            onChange={(e) => {
                              const newLinks = [...profileSocialLinks];
                              newLinks[idx] = e.target.value;
                              setProfileSocialLinks(newLinks);
                            }}
                            placeholder="https://social.com/user"
                            className="w-full pl-10 p-3 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all"
                          />
                        </div>
                        {profileSocialLinks.length > 1 && (
                          <button 
                            onClick={() => setProfileSocialLinks(profileSocialLinks.filter((_, i) => i !== idx))}
                            className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skills */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest border-l-2 border-black pl-2">Skills & Expertise</h3>
                    <button 
                      onClick={() => setProfileSkills([...profileSkills, ''])}
                      className="flex items-center space-x-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100"
                    >
                      <Plus className="w-3 h-3" />
                      <span>ADD SKILL</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {profileSkills.map((skill, idx) => (
                      <div key={idx} className="relative group animate-fadeIn">
                        <input 
                          value={skill}
                          onChange={(e) => {
                            const newSkills = [...profileSkills];
                            newSkills[idx] = e.target.value;
                            setProfileSkills(newSkills);
                          }}
                          placeholder="Skill name"
                          className="px-4 py-2 bg-neutral-100 border border-neutral-200 rounded-full text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all w-32"
                        />
                        {profileSkills.length > 1 && (
                          <button 
                            onClick={() => setProfileSkills(profileSkills.filter((_, i) => i !== idx))}
                            className="absolute -top-1.5 -right-1.5 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 pb-8">
                  <button
                    onClick={handleSaveProfile}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center space-x-2 border-b-4 border-emerald-800"
                  >
                    <Lock className="w-5 h-5" />
                    <span>SAVE PROFILE & LOCK DATA</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeScreen === 'chat' && (
          <div className="w-full flex-1 flex flex-col h-screen max-w-4xl mx-auto animate-fadeIn">
            {activeChatContactId !== null && activeContact ? (
              /* Direct Chat Room */
              <div className="w-full flex-1 bg-white border border-neutral-200/90 sm:rounded-2xl shadow-xs overflow-hidden flex flex-col h-full">
                {/* Header - Fixed Top Bar */}
                <div className="sticky top-0 z-30 px-3 py-2.5 bg-white text-neutral-900 flex items-center justify-between gap-3 shrink-0 border-b border-neutral-200">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <button
                      onClick={() => setActiveChatContactId(null)}
                      className="p-1.5 hover:bg-neutral-100 text-neutral-800 rounded-full transition-colors shrink-0"
                      title="Back to all chats"
                      aria-label="Back to all chats"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="relative shrink-0">
                      <img
                        src={activeContact.avatar}
                        alt={activeContact.name}
                        className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-full"></span>
                    </div>

                    <div className="min-w-0 leading-tight">
                      <div className="flex items-center space-x-1.5">
                        <h3 className="text-xs sm:text-sm font-bold text-neutral-900 truncate">{activeContact.name}</h3>
                        <span className="text-[8px] sm:text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.1 rounded-full shrink-0">
                          Verified
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-neutral-500 font-normal truncate">{activeContact.role}</p>
                    </div>
                  </div>
                </div>

                {/* Active Gig Context Banner */}
                {(() => {
                  const matchingGig = gigs.find(g => g.authorName.toLowerCase() === activeContact.name.toLowerCase()) || 
                    (activeContact.activeGigTitle ? { id: activeContact.activeGigId, title: activeContact.activeGigTitle, price: activeContact.activeGigPrice } : null);
                  
                  if (!matchingGig) return null;

                  return (
                    <div className="px-3.5 py-2 bg-neutral-50 text-neutral-800 text-xs flex items-center justify-between gap-2 border-b border-neutral-200 shrink-0">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <span className="text-emerald-600 font-bold shrink-0">💼 Active Gig:</span>
                        <span className="font-semibold truncate text-neutral-800">{matchingGig.title}</span>
                        {matchingGig.price && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 border border-emerald-200">{matchingGig.price}</span>}
                      </div>
                      <button
                        onClick={() => {
                          const fullGig = gigs.find(g => g.authorName.toLowerCase() === activeContact.name.toLowerCase());
                          if (fullGig) {
                            setSelectedGig(fullGig);
                            setActiveScreen('home');
                          }
                        }}
                        className="px-2.5 py-1 bg-black hover:bg-neutral-800 text-white rounded-lg text-[10px] font-bold shrink-0 transition-colors shadow-2xs"
                      >
                        View Gig
                      </button>
                    </div>
                  );
                })()}

                {/* Messages Stream Area */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-neutral-50/50">
                  {activeMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div className="max-w-xs">
                        <p className="text-sm font-bold text-neutral-800">Start a Conversation</p>
                        <p className="text-xs text-neutral-500 mt-1">Send a message to discuss gig details, pricing, or set up an appointment with {activeContact.name}.</p>
                      </div>
                    </div>
                  ) : (
                    activeMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            msg.sender === 'user'
                              ? 'bg-black text-white rounded-br-none shadow-2xs'
                              : 'bg-white text-neutral-900 border border-neutral-200/90 rounded-bl-none shadow-2xs'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-neutral-400 px-1 font-medium">{msg.time}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Message Input Box anchored at bottom of screen */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 sm:p-4 bg-white border-t border-neutral-200/90 flex items-center space-x-2 shrink-0 sticky bottom-0 z-20 shadow-md"
                >
                  <input
                    type="text"
                    placeholder={`Type a message to ${activeContact.name}...`}
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-neutral-900 focus:outline-hidden focus:border-black focus:bg-white transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newMessageText.trim()}
                    className="px-4 py-2.5 bg-black hover:bg-neutral-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs flex items-center space-x-1.5 shrink-0"
                  >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            ) : (
              /* Chat Threads / Select Contact List */
              <div className="w-full flex-1 bg-white border border-neutral-200/90 sm:rounded-2xl shadow-xs overflow-hidden flex flex-col h-full">
                {/* Fixed Top Header */}
                <div className="sticky top-0 z-30 px-3 py-2.5 bg-white text-neutral-900 flex items-center space-x-2.5 shrink-0 border-b border-neutral-200">
                  <button
                    onClick={() => setActiveScreen('home')}
                    className="p-1.5 hover:bg-neutral-100 text-neutral-800 rounded-full transition-colors shrink-0"
                    title="Back to GIGs"
                    aria-label="Back to GIGs"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h1 className="text-xs sm:text-sm font-bold text-neutral-900 flex items-center space-x-1.5">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span>Chat & Messages</span>
                    </h1>
                  </div>
                </div>

                {/* Fixed Search Bar (Does NOT move or scroll) */}
                <div className="p-3 sm:p-4 bg-white border-b border-neutral-200/80 shrink-0 z-20 shadow-2xs">
                  <div className="relative">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search messages or service providers..."
                      value={contactSearchQuery}
                      onChange={(e) => setContactSearchQuery(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-neutral-900 focus:outline-hidden focus:border-black focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                {/* Threads / Contacts Scrollable List Only */}
                <div className="p-3 sm:p-4 flex-1 overflow-y-auto space-y-3 bg-neutral-50/40">
                  {filteredContacts.length === 0 ? (
                    <div className="relative overflow-hidden p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs">
                      <BlurryCoinsBg opacity={0.15} overlay="bg-white/85" />
                      <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                          <MessageSquare className="w-7 h-7" />
                        </div>
                        <div className="max-w-xs space-y-1">
                          <h3 className="text-sm font-bold text-neutral-900">No Chat Contacts Yet</h3>
                          <p className="text-xs text-neutral-500 leading-relaxed">
                            When you or other real members post gigs and inquire about services, real conversations will appear here.
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 pt-1">
                          <button
                            onClick={() => {
                              setActiveScreen('home');
                              setShowCreateGigModal(true);
                            }}
                            className="px-4 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs"
                          >
                            Post a Gig
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100 border border-neutral-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          onClick={() => setActiveChatContactId(contact.id)}
                          className="p-3.5 flex items-center justify-between hover:bg-neutral-50 cursor-pointer transition-colors gap-3 group"
                        >
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className="relative shrink-0">
                              <img
                                src={contact.avatar}
                                alt={contact.name}
                                className="w-11 h-11 rounded-full object-cover border border-neutral-200"
                                referrerPolicy="no-referrer"
                              />
                              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-neutral-900 group-hover:text-black truncate">{contact.name}</h3>
                                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">Verified</span>
                              </div>
                              <p className="text-xs text-emerald-700 font-medium truncate">{contact.role}</p>
                              {(() => {
                                const contactGig = gigs.find(g => g.authorName.toLowerCase() === contact.name.toLowerCase()) ||
                                  (contact.activeGigTitle ? { title: contact.activeGigTitle, price: contact.activeGigPrice } : null);
                                if (contactGig) {
                                  return (
                                    <div className="mt-1 flex items-center space-x-1 text-[10px] text-neutral-700 bg-neutral-100/90 px-2 py-0.5 rounded-md w-fit max-w-full">
                                      <span className="font-bold text-neutral-900 shrink-0">📌 Gig:</span>
                                      <span className="truncate font-medium">{contactGig.title}</span>
                                      {contactGig.price && <span className="font-bold text-emerald-700 shrink-0">({contactGig.price})</span>}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              {contact.lastMessage && (
                                <p className="text-xs text-neutral-500 truncate mt-0.5">"{contact.lastMessage}"</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveChatContactId(contact.id);
                            }}
                            className="px-3 py-1.5 bg-black group-hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-2xs"
                          >
                            Chat
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer in list view */}
                <div className="p-3 bg-white border-t border-neutral-200/80 text-center text-xs text-neutral-500 shrink-0">
                  Tap any contact above to open direct chat room
                </div>
              </div>
            )}
          </div>
        )}

        {activeScreen === 'admin' && (
          <div className="flex-1 flex flex-col items-start w-full space-y-6 py-2">
            <div className="flex items-center justify-between w-full">
              <h1 className="text-xl font-semibold text-neutral-900">Admin Dashboard</h1>
              <span className="text-xs px-3 py-1 bg-neutral-100 text-neutral-800 rounded-full font-medium">Administrator</span>
            </div>

            {/* Profit Balance Block */}
            <div className="relative overflow-hidden w-full bg-neutral-900 text-white p-6 rounded-2xl shadow-md flex flex-col justify-between space-y-2 border border-amber-500/20">
              <BlurryCoinsBg opacity={0.35} overlay="bg-gradient-to-r from-neutral-950/80 via-black/60 to-amber-950/50" />
              <div className="relative z-10 space-y-2">
                <span className="text-xs uppercase tracking-wider text-amber-300/80 font-medium flex block">Coin Top-Up Profit Balance</span>
                <div className="text-3xl font-bold tracking-tight">R{totalProfit.toFixed(2).replace('.', ',')}</div>
                <span className="text-[11px] text-neutral-300 block">Total revenue generated from approved coin top-ups</span>
              </div>
            </div>

            {/* Top-up Submissions Review Queue */}
            <div className="w-full space-y-3">
              <h2 className="text-sm font-medium text-neutral-700">POP Review Queue</h2>
              {topUps.length === 0 ? (
                <div className="relative overflow-hidden bg-neutral-50 border border-neutral-200 rounded-2xl p-8 text-center text-neutral-400 text-xs shadow-xs">
                  <BlurryCoinsBg opacity={0.15} overlay="bg-neutral-50/80" />
                  <div className="relative z-10">
                    No top-up submissions yet.
                  </div>
                </div>
              ) : (
                <div className="space-y-3 w-full">
                  {topUps.map((item) => (
                    <div key={item.id} className="relative overflow-hidden bg-white border border-neutral-200 p-4 rounded-xl flex flex-col space-y-3 shadow-xs">
                      <BlurryCoinsBg opacity={0.15} overlay="bg-white/90" />
                      <div className="relative z-10 flex flex-col space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-neutral-900 text-sm">Package: {item.option.label} ({item.option.price})</div>
                            <div className="text-xs text-neutral-500">Submitted at {item.date}</div>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                            item.status === 'approved' ? 'bg-green-100 text-green-800' :
                            item.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {item.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                          <div className="flex items-center space-x-2 text-xs text-neutral-600 truncate max-w-[200px]">
                            <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span className="truncate">{item.fileName}</span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setViewingDocument(item)}
                              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            {item.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveTopUp(item.id)}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleRejectTopUp(item.id)}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Market Management */}
            <div className="w-full space-y-3 pt-4 border-t border-neutral-200">
              <h2 className="text-sm font-medium text-neutral-700 italic">Market Management</h2>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col space-y-3 shadow-xs">
                <div className="flex items-start space-x-3">
                  <div className="bg-red-100 p-2 rounded-lg">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-red-900">Clear Market Gigs</div>
                    <p className="text-[11px] text-red-700/80 mt-0.5 leading-relaxed">
                      Delete every active gig post currently published on the market. This is an administrative cleanup tool and cannot be reversed.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClearAllGigs}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-sm active:scale-[0.98]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove All Gigs from Market</span>
                </button>
              </div>
            </div>

            {/* Agent Cashout & Referral Reward Payout Requests */}
            <div className="w-full space-y-3 pt-4 border-t border-neutral-200">
              <h2 className="text-sm font-medium text-neutral-700">Agent Cashout & Reward Payout Requests</h2>
              {agentCashouts.length === 0 ? (
                <div className="relative overflow-hidden bg-neutral-50 border border-neutral-200 rounded-2xl p-8 text-center text-neutral-400 text-xs shadow-xs">
                  <BlurryCoinsBg opacity={0.15} overlay="bg-neutral-50/80" />
                  <div className="relative z-10">
                    No agent cashout requests yet.
                  </div>
                </div>
              ) : (
                <div className="space-y-3 w-full">
                  {agentCashouts.map((agent) => (
                    <div key={agent.id} className="relative overflow-hidden bg-white border border-neutral-200 p-4 rounded-xl flex flex-col space-y-3 shadow-xs">
                      <BlurryCoinsBg opacity={0.15} overlay="bg-white/90" />
                      <div className="relative z-10 flex flex-col space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <img
                              src={agent.avatarUrl}
                              alt={agent.agentName}
                              className="w-10 h-10 rounded-full object-cover border border-neutral-200"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <div className="font-semibold text-neutral-900 text-sm">{agent.agentName}</div>
                              <div className="text-xs text-neutral-500">Cashout Amount: <strong className="text-neutral-900">{agent.cashoutAmount}</strong></div>
                            </div>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                            agent.status === 'approved' ? 'bg-green-100 text-green-800' :
                            agent.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {agent.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs text-neutral-600">
                          <div>
                            <span>Completed Box: </span>
                            <strong className="text-neutral-900">{agent.rewardBoxCompleted}</strong>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setViewingAgentCashout(agent)}
                              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>View Agent Profile & Bank</span>
                            </button>

                            {agent.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveCashout(agent.id)}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Pay Out</span>
                                </button>
                                <button
                                  onClick={() => handleRejectCashout(agent.id)}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* User Feedbacks Section */}
            <div className="w-full space-y-3 pt-4 border-t border-neutral-200">
              <h2 className="text-sm font-medium text-neutral-700">User Feedbacks</h2>
              {feedbacks.length === 0 ? (
                <div className="relative overflow-hidden bg-neutral-50 border border-neutral-200 rounded-2xl p-8 text-center text-neutral-400 text-xs shadow-xs">
                  <div className="relative z-10">
                    No feedbacks submitted yet.
                  </div>
                </div>
              ) : (
                <div className="space-y-3 w-full">
                  {feedbacks.map((item) => (
                    <div key={item.id} className="bg-white border border-neutral-200 p-4 rounded-xl flex flex-col space-y-2 shadow-xs">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-neutral-900 text-sm">{item.user}</span>
                        <span className="text-xs text-neutral-500">{item.date}</span>
                      </div>
                      <p className="text-sm text-neutral-700 whitespace-pre-wrap">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Agent Profile & Bank Details Inspection Modal */}
      {viewingAgentCashout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl text-left border border-neutral-100">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-neutral-800" />
                <h3 className="font-semibold text-base text-neutral-900">Agent Profile & Bank Info</h3>
              </div>
              <button
                onClick={() => setViewingAgentCashout(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Agent Info & Avatar */}
            <div className="flex items-center space-x-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200/60">
              <img
                src={viewingAgentCashout.avatarUrl}
                alt={viewingAgentCashout.agentName}
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                referrerPolicy="no-referrer"
              />
              <div className="space-y-1">
                <h4 className="font-bold text-neutral-900 text-base">{viewingAgentCashout.agentName}</h4>
                <p className="text-xs text-neutral-500">{viewingAgentCashout.email}</p>
                <p className="text-xs text-neutral-500">{viewingAgentCashout.phone}</p>
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full mt-1">
                  Active Agent Partner
                </span>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-50 border border-neutral-200/60 p-3.5 rounded-xl space-y-1">
                <span className="text-[11px] text-neutral-500 font-medium">Total Referrals</span>
                <div className="text-xl font-bold text-neutral-900">{viewingAgentCashout.totalReferrals} Valid</div>
              </div>
              <div className="bg-neutral-50 border border-neutral-200/60 p-3.5 rounded-xl space-y-1">
                <span className="text-[11px] text-neutral-500 font-medium">Cashout Request</span>
                <div className="text-xl font-bold text-neutral-900">{viewingAgentCashout.cashoutAmount}</div>
              </div>
            </div>

            {/* Reward Box Completed */}
            <div className="bg-neutral-50 border border-neutral-200/60 p-4 rounded-xl space-y-1">
              <span className="text-xs text-neutral-500 font-medium">Reward Box Completed</span>
              <div className="font-semibold text-neutral-900 text-sm flex items-center space-x-2">
                <span>🎁</span>
                <span>{viewingAgentCashout.rewardBoxCompleted}</span>
              </div>
            </div>

            {/* Bank Details */}
            <div className="bg-neutral-900 text-white p-4 rounded-xl space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Bank Payout Details</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-neutral-400">Bank Name</span>
                  <div className="font-semibold text-white mt-0.5">{viewingAgentCashout.bankName}</div>
                </div>
                <div>
                  <span className="text-neutral-400">Branch Code</span>
                  <div className="font-semibold text-white mt-0.5">{viewingAgentCashout.branchCode}</div>
                </div>
                <div className="col-span-2 pt-1 border-t border-neutral-800">
                  <span className="text-neutral-400">Account Number</span>
                  <div className="font-mono font-bold text-white text-base tracking-wider mt-0.5">{viewingAgentCashout.accountNumber}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              {viewingAgentCashout.status === 'pending' ? (
                <>
                  <button
                    onClick={() => {
                      handleApproveCashout(viewingAgentCashout.id);
                      setViewingAgentCashout(null);
                    }}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm transition-colors text-center shadow-xs"
                  >
                    Approve & Pay Out
                  </button>
                  <button
                    onClick={() => {
                      handleRejectCashout(viewingAgentCashout.id);
                      setViewingAgentCashout(null);
                    }}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors text-center shadow-xs"
                  >
                    Reject Payout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setViewingAgentCashout(null)}
                  className="w-full py-3 bg-black text-white rounded-xl font-medium text-sm hover:bg-neutral-800 transition-colors"
                >
                  Close Profile
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Document Viewer Modal for Admin */}
      {viewingDocument && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col z-50 p-6 animate-fadeIn">
          <div className="flex items-center justify-between text-white pb-4 border-b border-neutral-800">
            <div>
              <h3 className="font-semibold text-lg">{viewingDocument.fileName}</h3>
              <p className="text-xs text-neutral-400">Package: {viewingDocument.option.label} ({viewingDocument.option.price})</p>
            </div>
            <button
              onClick={() => setViewingDocument(null)}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {viewingDocument.fileUrl && viewingDocument.fileName.match(/\.(png|jpg|jpeg|webp)$/i) ? (
              <img
                src={viewingDocument.fileUrl}
                alt="POP"
                className="max-h-[80vh] max-w-full object-contain rounded-xl border border-neutral-700 shadow-2xl"
              />
            ) : (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center space-y-4 max-w-md w-full">
                <FileText className="w-16 h-16 text-neutral-500 mx-auto" />
                <div>
                  <h4 className="text-white font-medium text-base">{viewingDocument.fileName}</h4>
                  <p className="text-xs text-neutral-400 mt-1">Document uploaded for payment reference: <strong className="text-white">{viewingDocument.option.label}</strong></p>
                </div>
                <div className="pt-2 text-xs text-neutral-500">
                  Simulated document preview container.
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-neutral-800 flex justify-end space-x-3">
            {viewingDocument.status === 'pending' && (
              <>
                <button
                  onClick={() => {
                    handleRejectTopUp(viewingDocument.id);
                    setViewingDocument(null);
                  }}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Reject POP
                </button>
                <button
                  onClick={() => {
                    handleApproveTopUp(viewingDocument.id);
                    setViewingDocument(null);
                  }}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Approve POP
                </button>
              </>
            )}
            <button
              onClick={() => setViewingDocument(null)}
              className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Close Viewer
            </button>
          </div>
        </div>
      )}

      {/* Under Review Popup Modal */}
      {showReviewPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-neutral-900">Payment Under Review</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Your POP has been submitted successfully. Review takes about 15 to 20 minutes.
              </p>
            </div>
            <button
              onClick={handleClosePopup}
              className="w-full py-3 bg-black text-white rounded-xl font-medium text-sm hover:bg-neutral-800 transition-colors"
            >
              Back to Wallet
            </button>
          </div>
        </div>
      )}

      {/* Create Gig Modal */}
      {showCreateGigModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-left border border-neutral-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="font-bold text-lg text-neutral-900">{editingGigId ? 'Edit Gig' : 'Post a New Gig'}</h3>
              <button
                onClick={() => closeCreateGigModal()}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-200/80">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">Posted By (Member Name)</label>
                  <input
                    type="text"
                    placeholder={accountHolder || "e.g. Sipho Dlamini"}
                    value={newGigAuthorName}
                    onChange={(e) => setNewGigAuthorName(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-hidden focus:border-black font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">Author Avatar</label>
                  <select
                    value={newGigAuthorAvatar}
                    onChange={(e) => setNewGigAuthorAvatar(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-hidden focus:border-black"
                  >
                    <option value="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80">Verified Member (Default)</option>
                    <option value="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80">Plumbing Specialist</option>
                    <option value="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80">Academic Tutor</option>
                    <option value="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80">Tech Developer</option>
                    <option value="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80">Courier Logistics</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Gig Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Expert House Painting & Waterproofing"
                  value={newGigTitle}
                  onChange={(e) => setNewGigTitle(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Price / Rate (ZAR)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. R500 or R150/hr"
                    value={newGigPrice}
                    onChange={(e) => setNewGigPrice(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Category</label>
                  <select
                    value={newGigCategory}
                    onChange={(e) => setNewGigCategory(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black"
                  >
                    <option value="Home Services">Home Services</option>
                    <option value="Education">Education & Tutoring</option>
                    <option value="Tech & Design">Tech & Design</option>
                    <option value="Delivery">Delivery & Courier</option>
                    <option value="General Services">General Services</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pretoria Central, Gauteng"
                  value={newGigLocation}
                  onChange={(e) => setNewGigLocation(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-neutral-800">
                    Upload Photos from Device <span className="text-neutral-500 font-normal">(Multiple files supported)</span>
                  </label>
                  {newGigUploadedImages.length > 0 && (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {newGigUploadedImages.length} image{newGigUploadedImages.length > 1 ? 's' : ''} selected
                    </span>
                  )}
                </div>

                {/* Device Multiple Image Selector Box */}
                <label className="border-2 border-dashed border-neutral-300 hover:border-black rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-neutral-50 hover:bg-neutral-100/90 transition-all text-center group">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleGigImageUpload}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-full bg-neutral-200 group-hover:bg-black text-neutral-700 group-hover:text-white flex items-center justify-center transition-colors mb-2 shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-neutral-900 group-hover:text-black">
                    Select Images from Device
                  </span>
                  <span className="text-[11px] text-neutral-500 mt-0.5">
                    Click to browse phone gallery or local computer files
                  </span>
                </label>

                {/* Selected Image Thumbnails */}
                {newGigUploadedImages.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="text-[11px] font-semibold text-neutral-700 flex items-center justify-between">
                      <span>Selected Photos Preview:</span>
                      <button
                        type="button"
                        onClick={() => setNewGigUploadedImages([])}
                        className="text-[10px] text-red-600 hover:underline font-medium"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {newGigUploadedImages.map((imgSrc, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-neutral-300 group bg-neutral-100 shadow-2xs">
                          <img src={imgSrc} alt={`Gig photo ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveUploadedGigImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-black/80 hover:bg-red-600 text-white rounded-full transition-colors shadow-xs"
                            title="Remove photo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          {idx === 0 && (
                            <span className="absolute bottom-1 left-1 bg-black/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                              Main Photo
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Web Image URL or Sample Presets */}
                <div className="mt-3 pt-2.5 border-t border-neutral-100">
                  <details className="text-xs group">
                    <summary className="cursor-pointer text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 flex items-center justify-between select-none">
                      <span>Optionally add via image URL or sample presets</span>
                      <span className="text-[10px] text-neutral-400 font-normal">▼</span>
                    </summary>
                    <div className="mt-2 space-y-2">
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={newGigImageUrl}
                        onChange={(e) => {
                          setNewGigImageUrl(e.target.value);
                          if (e.target.value && !newGigUploadedImages.includes(e.target.value)) {
                            setNewGigUploadedImages((prev) => [...prev, e.target.value]);
                          }
                        }}
                        className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-1.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black font-mono text-[11px]"
                      />
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600&auto=format&fit=crop&q=80',
                          'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&auto=format&fit=crop&q=80',
                          'https://images.unsplash.com/photo-1542744094-24638eff58bb?w=600&auto=format&fit=crop&q=80',
                          'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80'
                        ].map((preset, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setNewGigImageUrl(preset);
                              if (!newGigUploadedImages.includes(preset)) {
                                setNewGigUploadedImages((prev) => [...prev, preset]);
                              }
                            }}
                            className={`relative aspect-video rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                              newGigUploadedImages.includes(preset) ? 'border-black ring-2 ring-black/20' : 'border-transparent hover:border-neutral-400'
                            }`}
                          >
                            <img src={preset} alt="preset" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe your service, experience, and what's included..."
                  value={newGigDescription}
                  onChange={(e) => setNewGigDescription(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl p-3.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black resize-none"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => closeCreateGigModal()}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                >
                  {editingGigId ? 'Save Changes' : 'Publish Gig'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-neutral-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-neutral-800" />
                <h3 className="font-bold text-base text-neutral-900">Add New Contact</h3>
              </div>
              <button
                onClick={() => setShowAddContactModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Quick Select Verified Service Providers */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">Quick Select Verified Service Provider</label>
              <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
                {SUGGESTED_SERVICE_PROVIDERS.map((sp) => (
                  <div
                    key={sp.id}
                    onClick={() => handleAddContact(sp.name, sp.role, sp.avatar)}
                    className="p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <img src={sp.avatar} alt={sp.name} className="w-9 h-9 rounded-full object-cover border border-neutral-200" referrerPolicy="no-referrer" />
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900 group-hover:text-black">{sp.name}</h4>
                        <p className="text-[11px] text-emerald-700 font-medium">{sp.role}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-black text-white rounded-lg text-[10px]">Add Contact</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-neutral-200"></div>
              <span className="flex-shrink mx-3 text-[11px] text-neutral-400 uppercase font-semibold">Or Add Custom Contact</span>
              <div className="flex-grow border-t border-neutral-200"></div>
            </div>

            {/* Section 2: Custom Contact Form */}
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newContactName.trim()) {
                handleAddContact(newContactName.trim(), newContactRole.trim() || 'Service Provider');
                setNewContactName('');
                setNewContactRole('');
              }
            }} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Johnson"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Role / Service Specialty</label>
                <input
                  type="text"
                  placeholder="e.g. Electrician, Designer, Fitness Coach"
                  value={newContactRole}
                  onChange={(e) => setNewContactRole(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 focus:outline-hidden focus:border-black"
                />
              </div>

              <button
                type="submit"
                disabled={!newContactName.trim()}
                className="w-full py-2.5 bg-neutral-900 hover:bg-black disabled:opacity-40 text-white rounded-xl font-semibold text-xs transition-colors shadow-xs"
              >
                Add to Contact List
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Selected Gig Details Modal (Facebook Marketplace style view with single gig owner image swipe & apply) */}
      {selectedGig && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div
              className="relative aspect-video w-full bg-neutral-950 overflow-hidden flex items-center justify-center select-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={selectedGig.imageUrls?.[activeImageIndex] || selectedGig.imageUrl}
                alt={selectedGig.title}
                className="w-full h-full object-contain transition-all duration-300 cursor-pointer"
                onClick={() => setFullScreenImageUrl(selectedGig.imageUrls?.[activeImageIndex] || selectedGig.imageUrl)}
                referrerPolicy="no-referrer"
              />

              {/* Previous Image Arrow */}
              {selectedGig.imageUrls && selectedGig.imageUrls.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevImage();
                  }}
                  className="absolute left-3 p-2.5 bg-black/60 hover:bg-black text-white rounded-full transition-colors backdrop-blur-xs shadow-md"
                  title="Previous Photo"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {/* Next Image Arrow */}
              {selectedGig.imageUrls && selectedGig.imageUrls.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextImage();
                  }}
                  className="absolute right-3 p-2.5 bg-black/60 hover:bg-black text-white rounded-full transition-colors backdrop-blur-xs shadow-md"
                  title="Next Photo"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={() => setSelectedGig(null)}
                className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-colors backdrop-blur-xs shadow-md"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-xs text-white font-bold text-sm sm:text-base px-3.5 py-1.5 rounded-xl">
                {selectedGig.price}
              </div>

              {/* Image pagination indicator */}
              <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-lg flex items-center space-x-1.5">
                <span>Photo {activeImageIndex + 1} of {selectedGig.imageUrls?.length || 1}</span>
              </div>
            </div>

            {/* Image dots thumbnail bar for single gig owner */}
            {selectedGig.imageUrls && selectedGig.imageUrls.length > 1 && (
              <div className="bg-neutral-900 py-2 px-4 flex items-center justify-center space-x-2">
                {selectedGig.imageUrls.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-12 h-8 rounded-lg overflow-hidden border-2 transition-all ${
                      activeImageIndex === idx ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-neutral-400">{selectedGig.category}</span>
                  <span className="text-xs text-neutral-400">{selectedGig.date}</span>
                </div>
                <h2 className="text-lg font-bold text-neutral-900 leading-snug">{selectedGig.title}</h2>
                <div className="text-xs text-neutral-600 flex items-center space-x-1 pt-1">
                  <span>📍</span>
                  <span>{selectedGig.location}</span>
                </div>
              </div>

              {/* Contact Information Card */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={selectedGig.authorAvatar}
                    alt={selectedGig.authorName}
                    className="w-11 h-11 rounded-full object-cover border border-neutral-300 shadow-2xs"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="text-[11px] text-neutral-400 font-medium">Gig Owner / Creator</div>
                    <div className="text-sm font-bold text-neutral-900">{selectedGig.authorName}</div>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">Verified Poster</span>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Description & Details</h4>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">{selectedGig.description}</p>
              </div>

              {/* Action Buttons on Gig Post */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                {isAdminUser || selectedGig.authorId === user?.uid || selectedGig.authorEmail === (user?.email || authEmail) ? (
                  <>
                    <button
                      onClick={() => handleShareGig(selectedGig)}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs flex items-center justify-center space-x-2"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </button>
                    <button
                      onClick={() => handleEditGigInit(selectedGig)}
                      className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs flex items-center justify-center space-x-2"
                    >
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteGig(selectedGig.id)}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs flex items-center justify-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleApplyGig(selectedGig)}
                      className="flex-1 py-3 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs flex items-center justify-center space-x-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Apply for Gig</span>
                    </button>
                    <button
                      onClick={() => handleShareGig(selectedGig)}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs flex items-center justify-center space-x-2"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedGig(null)}
                  className="px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Image Viewer */}
      {fullScreenImageUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setFullScreenImageUrl(null)}
        >
          <button 
            onClick={() => setFullScreenImageUrl(null)}
            className="absolute top-4 right-4 p-3 bg-neutral-900/50 hover:bg-neutral-800 text-white rounded-full transition-colors backdrop-blur-md"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={fullScreenImageUrl} 
            alt="Full screen view" 
            className="w-full h-full object-contain cursor-zoom-out"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Profile Congrats Modal */}
      {showProfileCongrats && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div className="relative bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl animate-scaleIn">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-neutral-900">Congratulations! 🎉</h2>
              <p className="text-neutral-500">Your profile has been successfully updated and secured.</p>
            </div>
            <div className="pt-4">
              <button 
                onClick={() => setShowProfileCongrats(false)}
                className="w-full py-4 bg-black text-white rounded-2xl font-bold shadow-lg hover:bg-neutral-800 transition-all"
              >
                Great, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="font-bold text-lg text-neutral-900">Send Feedback</h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">Your Feedback</label>
                <textarea
                  placeholder="What features do you need? What can we improve?"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 resize-none h-32"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Menu Bar with GIGs, Wallet, Chat, and Referral (Hidden on Chat Screen and Signup) */}
      {activeScreen !== 'chat' && activeScreen !== 'signup' && (
        <nav className="w-full border-t border-neutral-200 py-3 px-3 sm:px-6 flex items-center justify-around sticky bottom-0 z-40 relative bg-white/75 backdrop-blur-xl overflow-hidden shadow-[0_-4px_30px_rgba(0,0,0,0.03)]">
          <div className="relative z-10 flex items-center justify-around w-full">
          <button
            onClick={() => {
              setActiveScreen('home');
              setWalletStep('overview');
            }}
            className={`flex flex-col items-center space-y-1 transition-colors ${
              activeScreen === 'home' ? 'text-neutral-950 font-semibold scale-105' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[11px] sm:text-xs">GIGs</span>
          </button>

          <button
            onClick={() => {
              setActiveScreen('wallet');
              setWalletStep('overview');
            }}
            className={`flex flex-col items-center space-y-1 transition-colors ${
              activeScreen === 'wallet' ? 'text-neutral-950 font-semibold scale-105' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[11px] sm:text-xs">Wallet</span>
          </button>

          <button
            onClick={() => {
              setActiveScreen('chat');
              setActiveChatContactId(null);
            }}
            className={`flex flex-col items-center space-y-1 transition-colors ${
              activeScreen === 'chat' ? 'text-neutral-950 font-semibold scale-105' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[11px] sm:text-xs">Chat</span>
          </button>

          <button
            onClick={() => {
              setActiveScreen('referral');
              setWalletStep('overview');
            }}
            className={`flex flex-col items-center space-y-1 transition-all duration-300 ${
              activeScreen === 'referral' ? 'text-neutral-950 font-bold scale-105' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <div className={`p-1.5 rounded-full transition-all duration-500 ${
              activeScreen === 'referral' 
                ? 'bg-black text-white shadow-[0_0_15px_rgba(0,0,0,0.15)] ring-2 ring-black/25' 
                : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
            }`}>
              <Gift className={`w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 ${activeScreen === 'referral' ? 'scale-110' : ''}`} />
            </div>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-tight font-bold">Referral</span>
          </button>

          <button
            onClick={() => {
              setActiveScreen('profile');
              setWalletStep('overview');
            }}
            className={`flex flex-col items-center space-y-1 transition-colors relative ${
              activeScreen === 'profile' ? 'text-neutral-950 font-semibold scale-105' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <div className="relative">
              <UserCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              {isProfileLocked && (
                <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border border-white shadow-sm">
                  <Lock className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
            <span className="text-[11px] sm:text-xs">Profile</span>
          </button>
          </div>
        </nav>
      )}
    </div>
  );
}
