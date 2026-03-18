/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Handshake, 
  Bell, 
  BellOff,
  UserCircle, 
  Calendar as CalendarIcon, 
  XCircle,
  ChevronLeft, 
  ChevronRight, 
  Info, 
  MapPin, 
  Users, 
  User as UserIcon,
  PlusCircle, 
  Check, 
  Verified, 
  ShieldCheck, 
  Headset,
  Instagram,
  Share2,
  Lock,
  LayoutDashboard,
  LogOut,
  Clock,
  ExternalLink,
  Search,
  X,
  Trash2,
  Mail,
  MailOpen,
  Banknote,
  MessageCircle,
  AlertCircle,
  Video,
  FileText,
  BarChart3,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from './firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  Timestamp,
  DocumentData,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  getDocs
} from 'firebase/firestore';
import { onAuthStateChanged, signOut, User, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { WEDDING_HALLS, WeddingHall } from './data/weddingHalls';
import { uploadWeddingHallsFromCSV, clearWeddingHalls } from './utils/csvUploader';

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Types
type TeamOption = {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: React.ReactNode;
};

type AddOnOption = {
  id: string;
  name: string;
  description: string;
  price: number;
};

type SettlementType = 'A' | 'B' | 'C';

type ReservationHistory = {
  timestamp: string;
  status: string;
  note?: string;
};

type Reservation = {
  id?: string;
  date: string;
  time: string;
  guestCount: number;
  weddingHall: string;
  location: string;
  teamId: string;
  teamName: string;
  side?: 'groom' | 'bride';
  settlementType: SettlementType;
  customerName: string;
  customerPhone: string;
  addOns: string[];
  totalPrice: number;
  travelFee: number;
  tripodCheck: 'possible' | 'not_checked' | 'impossible';
  isWaitlist: boolean;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'rejected' | 'cancel_requested';
  staffAssignments?: { staffId: string; staffName: string }[];
  history?: ReservationHistory[];
  uid?: string | null;
};

type Staff = {
  id: string;
  name: string;
  role: string;
  phone: string;
  createdAt: string;
};

type BlockedDate = {
  id?: string;
  date: string;
  reason?: string;
  createdAt: string;
};

const LOCATIONS = [
  { name: '수원', fee: 0 },
  { name: '군포', fee: 0 },
  { name: '의왕', fee: 0 },
  { name: '오산', fee: 0 },
  { name: '성남', fee: 30000 },
  { name: '용인', fee: 30000 },
  { name: '과천', fee: 30000 },
  { name: '안양', fee: 30000 },
  { name: '안산', fee: 30000 },
  { name: '시흥', fee: 30000 },
  { name: '화성', fee: 30000 },
  { name: '서울', fee: 50000 },
  { name: '인천', fee: 50000 },
  { name: '부천', fee: 50000 },
  { name: '평택', fee: 50000 },
  { name: '광명', fee: 50000 },
  { name: '안성', fee: 50000 },
  { name: '이천', fee: 50000 },
  { name: '여주', fee: 50000 },
  { name: '양평', fee: 50000 },
  { name: '광주', fee: 50000 },
  { name: '하남', fee: 50000 },
  { name: '구리', fee: 50000 },
];

const TEAM_OPTIONS: TeamOption[] = [
  {
    id: 'team-2',
    name: '2인 전문 팀 (단독 구성)',
    description: '신랑 또는 신부측 한 쪽만 집중 케어가 필요한 경우 추천드립니다.\n(기준 인원 200명)',
    price: 400000,
    icon: (
      <div className="flex -space-x-2">
        <UserIcon className="w-5 h-5" />
        <UserIcon className="w-5 h-5" />
      </div>
    )
  },
  {
    id: 'team-4',
    name: '4인 전문 팀 (양가 구성)',
    description: '양가 부모님 및 하객분들을 모두 전문적으로 안내해 드리는 베스트 상품입니다.\n(기준 인원 300명)',
    price: 750000,
    icon: (
      <div className="grid grid-cols-2 gap-0.5">
        <UserIcon className="w-3.5 h-3.5" />
        <UserIcon className="w-3.5 h-3.5" />
        <UserIcon className="w-3.5 h-3.5" />
        <UserIcon className="w-3.5 h-3.5" />
      </div>
    )
  }
];

const ADD_ON_OPTIONS: AddOnOption[] = [
  {
    id: 'video',
    name: '영상 메시지 서비스',
    description: '하객들의 축하 인사를 생생한 영상으로 담아 전달합니다.',
    price: 100000
  },
  {
    id: 'staff',
    name: '현장 스탭 1인 추가',
    description: '대규모 하객(400인 이상) 예상 시 원활한 안내를 위해 권장합니다.',
    price: 150000
  },
  {
    id: 'settlement',
    name: '식권/답례품 정산 대행',
    description: '예식 종료 후 복잡한 정산 업무를 전문적으로 투명하게 대행합니다.',
    price: 50000
  }
];

const SETTLEMENT_TYPES = [
  { 
    id: 'A' as SettlementType, 
    name: 'TYPE A: 금액 미확인 즉시 밀봉', 
    description: '가장 안전한 방식. 금액 노출 없이 봉투 수령 즉시 밀봉 보관 (초과 인원에 대한 추가 비용 없음)',
    price: 0,
    icon: <Mail className="w-5 h-5" />,
    label: 'Sealed'
  },
  { 
    id: 'B' as SettlementType, 
    name: 'TYPE B: 금액 확인 후 밀봉 보관', 
    description: '봉투별 금액 확인 후 장부 기재 및 밀봉. 카메라 앞에서 진행',
    price: 0,
    icon: <MailOpen className="w-5 h-5" />,
    label: 'Check'
  },
  { 
    id: 'C' as SettlementType, 
    name: 'TYPE C: 개봉 후 권종별 현금정리', 
    description: '전용 계수기 + 수기 더블 체크, 100장 단위 묶음(현금 띠지 사용)',
    price: 50000,
    icon: <Banknote className="w-5 h-5" />,
    label: 'Count'
  },
];

// Custom 3D-style Logo Component
const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    className={className}
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="mangoGradient" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFD600" />
        <stop offset="50%" stopColor="#FFB800" />
        <stop offset="100%" stopColor="#FF6B00" />
      </linearGradient>
      <linearGradient id="bananaGradient" x1="30" y1="20" x2="70" y2="80" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFF9A0" />
        <stop offset="100%" stopColor="#FFD600" />
      </linearGradient>
      <filter id="3dEffect" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
        <feOffset in="blur" dx="3" dy="3" result="offsetBlur" />
        <feSpecularLighting in="blur" surfaceScale="5" specularConstant="0.75" specularExponent="20" lightingColor="#white" result="specOut">
          <fePointLight x="-5000" y="-10000" z="20000" />
        </feSpecularLighting>
        <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
        <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litGraphic" />
        <feMerge>
          <feMergeNode in="offsetBlur" />
          <feMergeNode in="litGraphic" />
        </feMerge>
      </filter>
    </defs>
    
    {/* Mango Shape */}
    <motion.path
      initial={{ scale: 0.9, rotate: -5 }}
      animate={{ scale: 1, rotate: 5 }}
      transition={{ duration: 2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      d="M50 30C35 30 25 45 25 60C25 75 40 85 55 85C70 85 80 75 80 60C80 45 70 30 55 30C52 30 51 30 50 30Z"
      fill="url(#mangoGradient)"
      filter="url(#3dEffect)"
    />
    
    {/* Banana Shape */}
    <motion.path
      initial={{ scale: 0.9, rotate: 5 }}
      animate={{ scale: 1, rotate: -5 }}
      transition={{ duration: 2, delay: 0.5, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      d="M40 20C50 20 70 30 80 50C85 60 80 75 70 80C60 85 50 80 45 70C40 60 35 40 40 20Z"
      fill="url(#bananaGradient)"
      filter="url(#3dEffect)"
    />

    {/* Cute Heart with Glow */}
    <motion.path
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      d="M50 50C50 45 45 40 40 40C35 40 30 45 30 50C30 60 50 70 50 70C50 70 70 60 70 50C70 45 65 40 60 40C55 40 50 45 50 50Z"
      fill="#FF4D88"
      filter="drop-shadow(0 0 2px rgba(255, 77, 136, 0.5))"
    />
    
    {/* Blush dots for cuteness */}
    <circle cx="35" cy="65" r="3" fill="#FF9EAA" opacity="0.6" />
    <circle cx="75" cy="65" r="3" fill="#FF9EAA" opacity="0.6" />
  </svg>
);

export default function App() {
  // View State
  const [view, setView] = useState<'user' | 'admin' | 'intro'>('intro');
  const [adminViewMode, setAdminViewMode] = useState<'list' | 'calendar' | 'data' | 'staff'>('list');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [csvInput, setCsvInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [adminHallSearch, setAdminHallSearch] = useState('');
  const [selectedStatsMonth, setSelectedStatsMonth] = useState(new Date().toISOString().substring(0, 7));
  const [adminStatusFilter, setAdminStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'rejected' | 'cancel_requested'>('all');
  const [adminSortOrder, setAdminSortOrder] = useState<'createdAt' | 'reservation'>('createdAt');
  const [selectedReservationForDetail, setSelectedReservationForDetail] = useState<Reservation | null>(null);
  const [deletingHallId, setDeletingHallId] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  // User Form State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 2, 21)); // Mar 21, 2026 (Sat)
  const [selectedHour, setSelectedHour] = useState<string>('10');
  const [selectedMinute, setSelectedMinute] = useState<string>('00');
  const [isDirectTime, setIsDirectTime] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('team-4');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [selectedSide, setSelectedSide] = useState<'groom' | 'bride' | null>(null);
  const [selectedSettlementType, setSelectedSettlementType] = useState<SettlementType>('A');
  const [weddingHallSearch, setWeddingHallSearch] = useState('');
  const [showWeddingHallDropdown, setShowWeddingHallDropdown] = useState(false);
  const [selectedWeddingHall, setSelectedWeddingHall] = useState<WeddingHall | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tripodCheck, setTripodCheck] = useState<'possible' | 'not_checked' | 'impossible' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showPrecautions, setShowPrecautions] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [allWeddingHalls, setAllWeddingHalls] = useState<WeddingHall[]>([]);
  const [pendingConfirmReservationId, setPendingConfirmReservationId] = useState<string | null>(null);
  const [showMyReservations, setShowMyReservations] = useState(false);
  const [userReservations, setUserReservations] = useState<Reservation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLastSubmissionWaitlist, setIsLastSubmissionWaitlist] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmDeleteStaffId, setConfirmDeleteStaffId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lookupName, setLookupName] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  
  // Admin Notification & UI State
  const [adminNotifications, setAdminNotifications] = useState<Reservation[]>([]);
  const [lastReservationCount, setLastReservationCount] = useState<number | null>(null);
  const [showAdminNotifications, setShowAdminNotifications] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('readNotificationIds');
    return saved ? JSON.parse(saved) : [];
  });

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 11);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  };

  const formatTimeInput = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length <= 2) return cleaned;
    return `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`;
  };

  // Calendar State
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date(2026, 2, 1)); // March 2026

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // Real-time Sync for all views
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setCustomerName(currentUser.displayName || '');
        if (currentUser.email === 'nealjin29@gmail.com' || currentUser.email === 'contact@mangobananawedding.com') {
          setIsAdminAuthenticated(true);
        }
      } else {
        setIsAdminAuthenticated(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'weddingHalls'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const halls = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setAllWeddingHalls(halls);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'weddingHalls');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdminAuthenticated || !user || (user.email !== 'nealjin29@gmail.com' && user.email !== 'contact@mangobananawedding.com')) return;

    const q = query(collection(db, 'staff'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const staffList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Staff[];
      setStaff(staffList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'staff');
    });
    return () => unsubscribe();
  }, [isAdminAuthenticated, user]);

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'));
    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reservation[];
      setReservations(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reservations');
      // If permission denied, clear reservations
      if (error.code === 'permission-denied') {
        setReservations([]);
      }
    });

    return () => unsubscribeFirestore();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'blockedDates'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BlockedDate[];
      setBlockedDates(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'blockedDates');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Filter reservations that are pending or cancel_requested and NOT in readNotificationIds
    const unread = reservations.filter(r => {
      if (r.status !== 'pending' && r.status !== 'cancel_requested') return false;
      const key = `${r.id}_${r.status}`;
      return !readNotificationIds.includes(key);
    });
    setAdminNotifications(unread);
  }, [reservations, readNotificationIds]);

  const markAsRead = (id: string, status: string) => {
    const key = `${id}_${status}`;
    setReadNotificationIds(prev => {
      const next = [...new Set([...prev, key])];
      localStorage.setItem('readNotificationIds', JSON.stringify(next));
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setIsAdminAuthenticated(false);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  // Derived State
  const selectedTeam = TEAM_OPTIONS.find(t => t.id === selectedTeamId);
  
  const settlementSurcharge = selectedSettlementType === 'C' ? 50000 : 0;
  
  const totalPrice = (selectedTeam?.price || 0) + settlementSurcharge;
  const [showDisabledTooltip, setShowDisabledTooltip] = useState(false);

  // Admin Stats
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    reservations.forEach(res => months.add(res.date.substring(0, 7)));
    // Add current month if not present
    months.add(new Date().toISOString().substring(0, 7));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [reservations]);

  const monthlyStats = useMemo(() => {
    const stats: Record<string, { 
      count: number; 
      total: number;
      confirmedCount: number;
      confirmedTotal: number;
      pendingCount: number;
      pendingTotal: number;
    }> = {};
    
    reservations.forEach(res => {
      const month = res.date.substring(0, 7); // YYYY-MM
      if (!stats[month]) {
        stats[month] = { 
          count: 0, 
          total: 0,
          confirmedCount: 0,
          confirmedTotal: 0,
          pendingCount: 0,
          pendingTotal: 0
        };
      }
      stats[month].count += 1;
      stats[month].total += res.totalPrice;
      
      if (res.status === 'confirmed') {
        stats[month].confirmedCount += 1;
        stats[month].confirmedTotal += res.totalPrice;
      } else if (res.status === 'pending') {
        stats[month].pendingCount += 1;
        stats[month].pendingTotal += res.totalPrice;
      }
    });
    return stats;
  }, [reservations]);

  const staffStats = useMemo(() => {
    const stats: Record<string, { days: Set<string>; count: number }> = {};
    
    reservations.forEach(res => {
      // Only count confirmed reservations for performance/stats
      if (res.status === 'confirmed' && res.staffAssignments) {
        res.staffAssignments.forEach(assignment => {
          if (!stats[assignment.staffId]) {
            stats[assignment.staffId] = { days: new Set(), count: 0 };
          }
          stats[assignment.staffId].days.add(res.date);
          stats[assignment.staffId].count += 1;
        });
      }
    });
    
    return stats;
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
      const matchesMonth = res.date.startsWith(selectedStatsMonth);
      const matchesStatus = adminStatusFilter === 'all' || res.status === adminStatusFilter;
      return matchesMonth && matchesStatus;
    }).sort((a, b) => {
      if (adminSortOrder === 'createdAt') {
        return b.createdAt.localeCompare(a.createdAt);
      } else {
        return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
      }
    });
  }, [reservations, selectedStatsMonth, adminStatusFilter, adminSortOrder]);

  const sortedReservations = useMemo(() => {
    return [...reservations].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [reservations]);

  const handleCsvUpload = async () => {
    console.log('handleCsvUpload called');
    if (!csvInput.trim()) {
      setUploadStatus({ message: '입력창이 비어 있습니다. 데이터를 붙여넣어 주세요.', type: 'error' });
      return;
    }
    
    setUploadStatus({ message: '데이터 파싱 중...', type: 'info' });
    setIsUploading(true);
    
    try {
      console.log('Input length:', csvInput.length);
      const result = await uploadWeddingHallsFromCSV(csvInput);
      console.log('Upload result:', result);
      
      setUploadStatus({ 
        message: `업로드 성공! 총 ${result.successCount}건의 예식장이 등록되었습니다.`, 
        type: 'success' 
      });
      setCsvInput('');
    } catch (error: any) {
      console.error('Upload error details:', error);
      setUploadStatus({ 
        message: `오류 발생: ${error.message || '알 수 없는 오류'}`, 
        type: 'error' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearHalls = async () => {
    console.log('handleClearHalls called');
    
    // If not already in clearing state, set it
    if (!isClearing) {
      setIsClearing(true);
      // Auto-reset after 3 seconds if not confirmed
      setTimeout(() => setIsClearing(false), 3000);
      return;
    }
    
    setUploadStatus({ message: '데이터 전체 삭제 중...', type: 'info' });
    
    try {
      console.log('Starting clear process...');
      const count = await clearWeddingHalls();
      console.log('Clear successful, deleted:', count);
      setUploadStatus({ message: `삭제 완료! 총 ${count}건이 삭제되었습니다.`, type: 'success' });
    } catch (error: any) {
      console.error('Clear error details:', error);
      setUploadStatus({ message: `삭제 중 오류 발생: ${error.message || '알 수 없는 오류'}`, type: 'error' });
    } finally {
      setIsClearing(false);
    }
  };

  const handleAddStaff = async () => {
    if (!isAdminAuthenticated || !user || (user.email !== 'nealjin29@gmail.com' && user.email !== 'contact@mangobananawedding.com')) {
      alert('관리자 권한이 필요합니다.');
      return;
    }
    if (!newStaffName.trim()) return;
    setIsAddingStaff(true);
    try {
      await addDoc(collection(db, 'staff'), {
        name: newStaffName,
        role: newStaffRole,
        phone: newStaffPhone,
        createdAt: new Date().toISOString()
      });
      setNewStaffName('');
      setNewStaffRole('');
      setNewStaffPhone('');
      setUploadStatus({ message: '근무자 등록 완료', type: 'success' });
    } catch (error) {
      console.error('Add staff error:', error);
      setUploadStatus({ message: '근무자 등록 실패', type: 'error' });
    } finally {
      setIsAddingStaff(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!isAdminAuthenticated || !user || (user.email !== 'nealjin29@gmail.com' && user.email !== 'contact@mangobananawedding.com')) {
      alert('관리자 권한이 필요합니다.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'staff', id));
      setConfirmDeleteStaffId(null);
      setUploadStatus({ message: '근무자 삭제 완료', type: 'success' });
    } catch (error) {
      console.error('Delete staff error:', error);
      setUploadStatus({ message: '근무자 삭제 실패', type: 'error' });
    }
  };

  const handleAssignStaffAtIndex = async (reservationId: string, index: number, staffId: string, staffName: string) => {
    if (!isAdminAuthenticated || !user || (user.email !== 'nealjin29@gmail.com' && user.email !== 'contact@mangobananawedding.com')) {
      alert('관리자 권한이 필요합니다.');
      return;
    }
    try {
      const reservation = reservations.find(r => r.id === reservationId);
      if (!reservation) return;

      const currentAssignments = [...(reservation.staffAssignments || [])];
      
      // Ensure the array is long enough based on teamId
      const requiredCount = reservation.teamId === 'team-4' ? 4 : 2;
      while (currentAssignments.length < requiredCount) {
        currentAssignments.push({ staffId: '', staffName: '' });
      }

      currentAssignments[index] = { staffId, staffName };

      await updateDoc(doc(db, 'reservations', reservationId), {
        staffAssignments: currentAssignments
      });
      
      // Update local state for the detail modal
      if (selectedReservationForDetail && selectedReservationForDetail.id === reservationId) {
        setSelectedReservationForDetail(prev => prev ? { ...prev, staffAssignments: currentAssignments } : null);
      }
      
      setUploadStatus({ message: '전담 인원 배정 완료', type: 'success' });
    } catch (error) {
      console.error('Assign staff error:', error);
      setUploadStatus({ message: '배정 중 오류 발생', type: 'error' });
    }
  };

  const handleDeleteHall = async (id: string, name: string) => {
    console.log('handleDeleteHall called for:', name, id);
    
    // If not already in deleting state, set it
    if (deletingHallId !== id) {
      setDeletingHallId(id);
      // Auto-reset after 3 seconds
      setTimeout(() => setDeletingHallId(null), 3000);
      return;
    }
    
    try {
      console.log('Attempting to delete document:', id);
      setUploadStatus({ message: `'${name}' 삭제 중...`, type: 'info' });
      await deleteDoc(doc(db, 'weddingHalls', id));
      console.log('Delete successful');
      setUploadStatus({ message: `'${name}' 삭제 완료`, type: 'success' });
      setDeletingHallId(null);
    } catch (error: any) {
      console.error('Delete error details:', error);
      setUploadStatus({ message: `삭제 실패: ${error.message || '알 수 없는 오류'}`, type: 'error' });
      setDeletingHallId(null);
    }
  };

  const filteredAdminHalls = useMemo(() => {
    if (!adminHallSearch.trim()) return allWeddingHalls;
    const search = adminHallSearch.toLowerCase();
    return allWeddingHalls.filter(hall => {
      const name = (hall.name || '').toLowerCase();
      const province = (hall.province || '').toLowerCase();
      const city = (hall.city || '').toLowerCase();
      const address = (hall.address || '').toLowerCase();
      
      return name.includes(search) ||
             province.includes(search) ||
             city.includes(search) ||
             address.includes(search);
    });
  }, [allWeddingHalls, adminHallSearch]);

  const handleSampleUpload = async () => {
    const sampleData = `글래드 호텔 여의도	서울	영등포구	서울특별시 영등포구 의사당대로 16
신라호텔 다이너스티홀	서울	중구	서울특별시 중구 동호로 249
그랜드 하얏트 서울	서울	용산구	서울특별시 용산구 소월로 322`;
    setCsvInput(sampleData);
    alert('샘플 데이터가 입력창에 복사되었습니다. [데이터 업로드 시작] 버튼을 눌러주세요.');
  };

  const getReservationNumber = (id: string) => {
    const index = sortedReservations.findIndex(r => r.id === id);
    return index !== -1 ? index + 1 : 0;
  };

  const formatSubmissionTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch (e) {
      return '-';
    }
  };
  const filteredWeddingHalls = useMemo(() => {
    if (!weddingHallSearch.trim()) return [];
    const search = weddingHallSearch.toLowerCase();
    return allWeddingHalls.filter(hall => {
      const name = (hall.name || '').toLowerCase();
      const province = (hall.province || '').toLowerCase();
      const city = (hall.city || '').toLowerCase();
      
      return name.includes(search) ||
             province.includes(search) ||
             city.includes(search);
    }).slice(0, 5);
  }, [weddingHallSearch, allWeddingHalls]);

  // Calendar Logic
  const currentYear = currentCalendarDate.getFullYear();
  const currentMonth = currentCalendarDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDayOfMonth + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  const getReservationStatus = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Check if manually blocked
    if (blockedDates.some(bd => bd.date === dateStr)) return 'full';

    const dayReservations = reservations.filter(r => r.date === dateStr && r.status !== 'cancelled' && r.status !== 'rejected');
    
    const hasMain = dayReservations.some(r => !r.isWaitlist);
    const waitlistCount = dayReservations.filter(r => r.isWaitlist).length;

    if (!hasMain) return 'available';
    if (waitlistCount < 1) return 'waitlist';
    return 'full';
  };

  const isDateBooked = (date: Date) => {
    return getReservationStatus(date) !== 'available';
  };

  const isWeekend = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  const isPastDate = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleToggleBlockDate = async (dateStr: string) => {
    if (!isAdminAuthenticated || !user || (user.email !== 'nealjin29@gmail.com' && user.email !== 'contact@mangobananawedding.com')) {
      alert('관리자 권한이 필요합니다.');
      return;
    }
    
    const existing = blockedDates.find(bd => bd.date === dateStr);
    
    try {
      if (existing) {
        await deleteDoc(doc(db, 'blockedDates', existing.id!));
      } else {
        await addDoc(collection(db, 'blockedDates'), {
          date: dateStr,
          createdAt: new Date().toISOString(),
          reason: 'Admin blocked'
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'blockedDates');
    }
  };

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const isSideSelectionRequired = selectedTeamId === 'team-2' && !selectedSide;
  const isWeddingHallRequired = !selectedWeddingHall;
  const isFormIncomplete = isSideSelectionRequired || isWeddingHallRequired;
  const isReservationDisabled = isSubmitting || isFormIncomplete || getReservationStatus(selectedDate) === 'full';

  const handleReservationSubmit = async () => {
    if (!customerName || !customerPhone) {
      alert("성함과 연락처를 모두 입력해주세요.");
      return;
    }

    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      alert("휴대폰 번호 11자리를 모두 입력해주세요.");
      return;
    }

    if (!selectedWeddingHall) {
      alert("예식장을 선택해주세요.");
      return;
    }

    if (!tripodCheck) {
      alert("웨딩홀 삼각대 설치 가능 유무를 선택해주세요.");
      return;
    }

    if (tripodCheck === 'impossible') {
      alert("삼각대 설치가 불가능한 경우 예약 신청이 제한됩니다.");
      return;
    }
    
    if (isSideSelectionRequired) {
      alert("진행 측(신랑/신부)을 선택해주세요.");
      return;
    }

    if (isDirectTime && !customTime.trim()) {
      alert("예식 시간을 직접 입력해주세요.");
      return;
    }

    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      const resStatus = getReservationStatus(selectedDate);
      
      if (resStatus === 'full') {
        alert("해당 일자는 예약 및 줄서기가 모두 마감되었습니다.");
        setIsSubmitting(false);
        return;
      }

      const reservationData: any = {
        date: dateStr,
        time: isDirectTime ? customTime : `${selectedHour}:${selectedMinute}`,
        guestCount: 0,
        weddingHall: selectedWeddingHall?.name || '미지정',
        location: selectedWeddingHall?.province || '수원',
        teamId: selectedTeamId,
        teamName: selectedTeam?.name || '',
        settlementType: selectedSettlementType,
        customerName,
        customerPhone,
        tripodCheck,
        addOns: selectedAddOns,
        totalPrice,
        travelFee: 0,
        isWaitlist: resStatus === 'waitlist',
        createdAt: new Date().toISOString(),
        status: 'pending',
        uid: auth.currentUser?.uid || null,
        history: [{
          timestamp: new Date().toISOString(),
          status: 'pending',
          note: '예약 신청 접수'
        }]
      };

      if (selectedTeamId === 'team-2' && selectedSide) {
        reservationData.side = selectedSide;
      }

      console.log('Submitting reservation data:', reservationData);
      setIsLastSubmissionWaitlist(reservationData.isWaitlist);
      await addDoc(collection(db, 'reservations'), reservationData);
      console.log('Reservation submitted successfully');
      setSubmitSuccess(true);
      setShowPrecautions(false);
      setCustomerName('');
      setCustomerPhone('');
      setTripodCheck(null);
    } catch (error) {
      console.error("Error submitting reservation:", error);
      alert("예약 중 오류가 발생했습니다. 다시 시도해 주세요. (오류: " + (error instanceof Error ? error.message : "알 수 없는 오류") + ")");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateReservationStatus = async (id: string, status: 'confirmed' | 'cancelled' | 'pending' | 'rejected' | 'cancel_requested', note?: string) => {
    if (!isAdminAuthenticated || !user || (user.email !== 'nealjin29@gmail.com' && user.email !== 'contact@mangobananawedding.com')) {
      alert('관리자 권한이 필요합니다.');
      return;
    }
    try {
      const historyEntry: ReservationHistory = {
        timestamp: new Date().toISOString(),
        status,
        note: note || ""
      };
      await updateDoc(doc(db, 'reservations', id), { 
        status,
        history: arrayUnion(historyEntry)
      });
      if (selectedReservationForDetail && selectedReservationForDetail.id === id) {
        setSelectedReservationForDetail(prev => prev ? { ...prev, status, history: [...(prev.history || []), historyEntry] } : null);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      setUploadStatus({ message: '상태 변경 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  const deleteReservation = async (id: string) => {
    if (!isAdminAuthenticated || !user || (user.email !== 'nealjin29@gmail.com' && user.email !== 'contact@mangobananawedding.com')) {
      alert('관리자 권한이 필요합니다.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'reservations', id));
      setSelectedReservationForDetail(null);
      setConfirmDeleteId(null);
      setUploadStatus({ message: '예약 기록이 삭제되었습니다.', type: 'success' });
    } catch (error) {
      console.error("Error deleting reservation:", error);
      setUploadStatus({ message: '삭제 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !adminPassword) {
      setUploadStatus({ message: '아이디와 비밀번호를 모두 입력해 주세요.', type: 'error' });
      return;
    }

    try {
      // Map 'admin' ID to 'contact@mangobananawedding.com' for Firebase Auth
      const email = adminId === 'admin' ? 'contact@mangobananawedding.com' : adminId;
      
      await signInWithEmailAndPassword(auth, email, adminPassword);
      
      setIsAdminAuthenticated(true);
      setUploadStatus({ message: '관리자 로그인 성공', type: 'success' });
    } catch (error: any) {
      console.error("Admin Login Error:", error);
      let message = '로그인 중 오류가 발생했습니다.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = '아이디 또는 비밀번호가 틀렸습니다.';
      }
      setUploadStatus({ message, type: 'error' });
    }
  };

  const searchMyReservations = async () => {
    if (!lookupName || lookupPhone.replace(/\D/g, '').length < 10) {
      setUploadStatus({ message: '이름과 정확한 연락처를 입력해주세요.', type: 'error' });
      return;
    }
    
    setIsSearching(true);
    setHasSearched(true);
    try {
      const q = query(
        collection(db, 'reservations'), 
        where('customerName', '==', lookupName),
        where('customerPhone', '==', lookupPhone)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as Reservation[];
      setUserReservations(data);
    } catch (error) {
      console.error("Error searching reservations:", error);
      setUploadStatus({ message: '조회 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  // Automatically search when modal opens if lookup info is present
  useEffect(() => {
    if (showMyReservations && lookupName && lookupPhone.replace(/\D/g, '').length >= 10) {
      searchMyReservations();
    }
  }, [showMyReservations]);

  const requestCancellation = async (id: string) => {
    try {
      await updateReservationStatus(id, 'cancel_requested', '고객 취소 요청');
      // Update local state if needed
      setUserReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'cancel_requested' } : r));
      setConfirmCancelId(null);
      setUploadStatus({ message: '취소 요청이 접수되었습니다.', type: 'success' });
    } catch (error) {
      console.error("Error requesting cancellation:", error);
      setUploadStatus({ message: '취소 요청 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  const handleGoogleAdminLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user.email === 'nealjin29@gmail.com') {
        setIsAdminAuthenticated(true);
      } else {
        alert('관리자 권한이 없는 계정입니다.');
        await signOut(auth);
      }
    } catch (error) {
      console.error("Admin Login Error:", error);
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  if (view === 'admin') {
    if (!isAdminAuthenticated) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-3xl p-10 shadow-2xl"
          >
            <div className="flex flex-col items-center mb-8">
              <div className="h-16 w-16 bg-[#0a44b8]/10 rounded-2xl flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-[#0a44b8]" />
              </div>
              <h2 className="text-2xl font-black text-slate-900">관리자 로그인</h2>
              <p className="text-slate-500 text-sm mt-2">축의대 대행 서비스 관리 시스템</p>
            </div>
            <div className="space-y-6">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Admin ID</label>
                  <input 
                    type="text" 
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl py-4 px-6 focus:ring-2 focus:ring-[#0a44b8] transition-all"
                    placeholder="ID"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                  <input 
                    type="password" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl py-4 px-6 focus:ring-2 focus:ring-[#0a44b8] transition-all"
                    placeholder="•••••••"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-[#0a44b8] text-white py-4 rounded-xl font-bold shadow-lg shadow-[#0a44b8]/20 hover:bg-[#0a3a9c] transition-all"
                >
                  접속하기
                </button>
              </form>

              <button 
                type="button"
                onClick={() => setView('user')}
                className="w-full text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors pt-2"
              >
                사용자 페이지로 돌아가기
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#f8fafc] font-sans">
        {/* Admin Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-[#0a44b8] rounded-xl flex items-center justify-center text-white">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900">관리자 대시보드</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gift Table Agency Service</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Notification Bell */}
              <div className="relative">
                <button 
                  onClick={() => setShowAdminNotifications(!showAdminNotifications)}
                  className={`p-2 rounded-xl transition-all relative ${showAdminNotifications ? 'bg-[#0a44b8]/10 text-[#0a44b8]' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                  <Bell className="w-6 h-6" />
                  {adminNotifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white">
                      {adminNotifications.length}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showAdminNotifications && (
                    <>
                      <div 
                        className="fixed inset-0 z-[60]" 
                        onClick={() => setShowAdminNotifications(false)}
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[70] overflow-hidden"
                      >
                        <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <Bell className="w-4 h-4 text-[#0a44b8]" />
                            알림
                          </h4>
                          {adminNotifications.length > 0 && (
                            <button 
                              onClick={() => {
                                adminNotifications.forEach(n => markAsRead(n.id!, n.status));
                                setShowAdminNotifications(false);
                              }}
                              className="text-[10px] font-bold text-[#0a44b8] hover:underline"
                            >
                              모두 읽음
                            </button>
                          )}
                        </div>
                        <div className="max-h-96 overflow-y-auto custom-scrollbar">
                          {adminNotifications.length > 0 ? (
                            adminNotifications.map((notif, idx) => (
                              <div 
                                key={notif.id + idx} 
                                className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-all cursor-pointer"
                                onClick={() => {
                                  setSelectedReservationForDetail(notif);
                                  markAsRead(notif.id!, notif.status);
                                }}
                              >
                                <div className="flex gap-3">
                                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                                    notif.status === 'cancel_requested' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                                  }`}>
                                    {notif.status === 'cancel_requested' ? <XCircle className="w-4 h-4" /> : <CalendarIcon className="w-4 h-4" />}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-xs font-black text-slate-900 mb-0.5">
                                      {notif.status === 'cancel_requested' ? '취소 요청' : '새로운 예약'}
                                    </p>
                                    <p className="text-[10px] text-slate-500 line-clamp-1">
                                      {notif.customerName} · {notif.weddingHall}
                                    </p>
                                    <p className="text-[9px] text-slate-400 mt-1">
                                      {notif.date} {notif.time}
                                    </p>
                                  </div>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead(notif.id!, notif.status);
                                    }}
                                    className="p-1 hover:bg-slate-200 rounded text-slate-300 hover:text-slate-500"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-12 text-center">
                              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <BellOff className="w-6 h-6 text-slate-200" />
                              </div>
                              <p className="text-xs font-bold text-slate-400">새로운 알림이 없습니다</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => setView('user')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-50 font-bold text-sm transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                사용자 페이지
              </button>
              <button 
                onClick={() => {
                  setIsAdminAuthenticated(false);
                  setAdminPassword('');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-bold text-sm transition-all"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-10">
          {!user || (user.email !== 'nealjin29@gmail.com' && user.email !== 'contact@mangobananawedding.com') ? (
            <div className="mb-8 p-6 bg-orange-50 border border-orange-200 rounded-2xl flex items-center gap-4 text-orange-800">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-bold">관리자 권한이 확인되지 않았습니다.</p>
                <p className="text-sm">데이터를 보려면 관리자 계정으로 로그인해 주세요. 현재 비밀번호로만 접속된 상태입니다.</p>
              </div>
            </div>
          ) : null}

          {/* Monthly Stats Dashboard */}
          <div className="mb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Verified className="w-6 h-6 text-[#0a44b8]" />
                월간 실적 요약
              </h2>
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                <CalendarIcon className="w-4 h-4 text-slate-400 ml-3" />
                <select 
                  value={selectedStatsMonth}
                  onChange={(e) => setSelectedStatsMonth(e.target.value)}
                  className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 pr-8 py-2"
                >
                  {availableMonths.map(month => (
                    <option key={month} value={month}>{month.replace('-', '년 ')}월</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">전체 접수 현황</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-black text-slate-900">{monthlyStats[selectedStatsMonth]?.count || 0}건</p>
                    <p className="text-sm font-bold text-slate-500 mt-1">{(monthlyStats[selectedStatsMonth]?.total || 0).toLocaleString()}원</p>
                  </div>
                  <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Confirmed Card */}
              <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm bg-emerald-50/10">
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-3">확정 완료 (매출)</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-black text-emerald-600">{monthlyStats[selectedStatsMonth]?.confirmedCount || 0}건</p>
                    <p className="text-sm font-bold text-emerald-600 mt-1">{(monthlyStats[selectedStatsMonth]?.confirmedTotal || 0).toLocaleString()}원</p>
                  </div>
                  <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
              </div>

              {/* Pending Card */}
              <div className="bg-white p-6 rounded-3xl border border-orange-100 shadow-sm bg-orange-50/10">
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3">대기 중 (예상)</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-black text-orange-600">{monthlyStats[selectedStatsMonth]?.pendingCount || 0}건</p>
                    <p className="text-sm font-bold text-orange-600 mt-1">{(monthlyStats[selectedStatsMonth]?.pendingTotal || 0).toLocaleString()}원</p>
                  </div>
                  <div className="h-12 w-12 bg-orange-50 rounded-2xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-orange-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setAdminViewMode('list')}
                className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${adminViewMode === 'list' ? 'bg-white text-[#0a44b8] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                리스트 보기
              </button>
              <button 
                onClick={() => setAdminViewMode('calendar')}
                className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${adminViewMode === 'calendar' ? 'bg-white text-[#0a44b8] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                캘린더 보기
              </button>
              <button 
                onClick={() => setAdminViewMode('data')}
                className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${adminViewMode === 'data' ? 'bg-white text-[#0a44b8] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                데이터 관리
              </button>
              <button 
                onClick={() => setAdminViewMode('staff')}
                className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${adminViewMode === 'staff' ? 'bg-white text-[#0a44b8] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                근무자 관리
              </button>
            </div>

            {adminViewMode === 'list' && (
              <>
                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                  <button 
                    onClick={() => setAdminStatusFilter('all')}
                    className={`relative px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${adminStatusFilter === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    전체
                    {adminNotifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
                    )}
                  </button>
                  <button 
                    onClick={() => setAdminStatusFilter('pending')}
                    className={`relative px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${adminStatusFilter === 'pending' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    대기
                    {adminNotifications.some(n => n.status === 'pending') && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
                    )}
                  </button>
                  <button 
                    onClick={() => setAdminStatusFilter('confirmed')}
                    className={`relative px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${adminStatusFilter === 'confirmed' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    확정
                  </button>
                  <button 
                    onClick={() => setAdminStatusFilter('cancelled')}
                    className={`relative px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${adminStatusFilter === 'cancelled' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    취소
                  </button>
                  <button 
                    onClick={() => setAdminStatusFilter('cancel_requested')}
                    className={`relative px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${adminStatusFilter === 'cancel_requested' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    취소 요청
                    {adminNotifications.some(n => n.status === 'cancel_requested') && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                  <button 
                    onClick={() => setAdminSortOrder('createdAt')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${adminSortOrder === 'createdAt' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    접수순
                  </button>
                  <button 
                    onClick={() => setAdminSortOrder('reservation')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${adminSortOrder === 'reservation' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    예약순
                  </button>
                </div>
              </>
            )}
          </div>

          {adminViewMode === 'list' ? (
            <div className="space-y-10">
              {/* Section 1: Pending/Other Reservations */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-[#0a44b8] rounded-lg flex items-center justify-center text-white">
                      <FileText className="w-4 h-4" />
                    </div>
                    <h2 className="font-black text-slate-900">
                      {selectedStatsMonth.replace('-', '년 ')}월 {adminStatusFilter === 'all' ? '전체' : 
                       adminStatusFilter === 'pending' ? '대기' :
                       adminStatusFilter === 'confirmed' ? '확정' : 
                       adminStatusFilter === 'cancel_requested' ? '취소 요청' : '취소/거절'} 예약 현황
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <span className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    {filteredReservations.length}건 검색됨
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-8 py-4">No.</th>
                        <th className="px-8 py-4">접수 시각</th>
                        <th className="px-8 py-4">예약자 정보</th>
                        <th className="px-8 py-4">상품 구분</th>
                        <th className="px-8 py-4">예식 일시</th>
                        <th className="px-8 py-4">예식장</th>
                        <th className="px-8 py-4">결제 금액</th>
                        <th className="px-8 py-4">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredReservations.map((res) => (
                        <tr 
                          key={res.id} 
                          className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedReservationForDetail(res)}
                        >
                          <td className="px-8 py-6 text-xs font-black text-slate-300">#{getReservationNumber(res.id!)}</td>
                          <td className="px-8 py-6 text-xs font-bold text-slate-500">{formatSubmissionTime(res.createdAt)}</td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col gap-1">
                              <p className="font-bold text-slate-900">{res.customerName}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-slate-500">{res.customerPhone}</p>
                                {res.isWaitlist && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-black bg-orange-100 text-orange-600 border border-orange-200">
                                    줄서기
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${res.teamId === 'team-4' ? 'bg-blue-100 text-[#0a44b8]' : 'bg-slate-100 text-slate-600'}`}>
                              {res.teamId === 'team-4' ? '4인' : '2인'}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <p className="font-bold text-slate-900">{res.date}</p>
                            <p className="text-xs text-slate-500">{res.time}</p>
                          </td>
                          <td className="px-8 py-6 font-bold text-slate-900">{res.weddingHall || '미입력'}</td>
                          <td className="px-8 py-6 font-black text-slate-900">{res.totalPrice.toLocaleString()}원</td>
                          <td className="px-8 py-6" onClick={(e) => e.stopPropagation()}>
                            <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black border ${
                              res.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              res.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' :
                              res.status === 'cancel_requested' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                              res.status === 'rejected' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                              'bg-orange-50 text-orange-600 border-orange-100'
                            }`}>
                              {res.status === 'confirmed' ? '확정 완료' :
                               res.status === 'cancelled' ? '취소 완료' :
                               res.status === 'cancel_requested' ? '취소 요청' :
                               res.status === 'rejected' ? '거절됨' : '대기 중'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : adminViewMode === 'calendar' ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setCurrentCalendarDate(new Date(currentYear, currentMonth - 1, 1))}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="text-xl font-black text-slate-900">{currentYear}년 {currentMonth + 1}월</h3>
                  <button 
                    onClick={() => setCurrentCalendarDate(new Date(currentYear, currentMonth + 1, 1))}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                  <div key={day} className="bg-slate-50 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 42 }).map((_, i) => {
                  const day = i - firstDayOfMonth + 1;
                  const isCurrentMonth = day > 0 && day <= daysInMonth;
                  const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayReservations = reservations.filter(r => r.date === dateStr);

                  return (
                    <div 
                      key={i} 
                      className={`min-h-[120px] bg-white p-3 border-t border-l border-slate-100 flex flex-col ${!isCurrentMonth ? 'opacity-30' : ''} ${blockedDates.some(bd => bd.date === dateStr) ? 'bg-red-50/30' : ''}`}
                    >
                      {isCurrentMonth && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-bold ${i % 7 === 0 ? 'text-red-500' : i % 7 === 6 ? 'text-[#0a44b8]' : 'text-slate-400'}`}>
                              {day}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleBlockDate(dateStr);
                              }}
                              className={`p-1 rounded transition-all ${
                                blockedDates.some(bd => bd.date === dateStr)
                                ? 'text-red-500 hover:bg-red-100'
                                : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                              }`}
                              title={blockedDates.some(bd => bd.date === dateStr) ? '막기 해제' : '날짜 막기'}
                            >
                              <Lock className={`w-3 h-3 ${blockedDates.some(bd => bd.date === dateStr) ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                          <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar max-h-[80px]">
                            {dayReservations.map(res => (
                              <div 
                                key={res.id} 
                                onClick={() => setSelectedReservationForDetail(res)}
                                className={`text-[9px] p-1.5 rounded-lg border truncate font-bold cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                  res.isWaitlist ? 'bg-orange-100 border-orange-200 text-orange-800' :
                                  res.status === 'confirmed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                  res.status === 'pending' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                  'bg-slate-50 border-slate-100 text-slate-500'
                                }`}
                              >
                                {res.isWaitlist && <span className="mr-1">[줄서기]</span>}
                                {res.time} {res.customerName}
                              </div>
                            ))}
                          </div>
                          {blockedDates.some(bd => bd.date === dateStr) && (
                            <div className="mt-1 px-1.5 py-0.5 bg-red-500 rounded text-[7px] font-black text-white text-center uppercase tracking-tighter">
                              RESERVATION BLOCKED
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : adminViewMode === 'staff' ? (
            <div className="space-y-8">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center text-[#0a44b8]">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">근무자 신규 등록</h2>
                    <p className="text-sm text-slate-500">새로운 전담 인원을 시스템에 등록합니다.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">이름</label>
                    <input 
                      type="text"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="홍길동"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0a44b8] focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">직책/역할</label>
                    <input 
                      type="text"
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value)}
                      placeholder="팀장, 메인 스탭 등"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0a44b8] focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">연락처</label>
                    <input 
                      type="text"
                      value={newStaffPhone}
                      onChange={(e) => setNewStaffPhone(e.target.value)}
                      placeholder="010-0000-0000"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0a44b8] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 items-center">
                  {uploadStatus && adminViewMode === 'staff' && (
                    <div className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${
                      uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                      uploadStatus.type === 'error' ? 'bg-red-50 text-red-600' :
                      'bg-blue-50 text-[#0a44b8]'
                    }`}>
                      {uploadStatus.message}
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      if (!newStaffName.trim()) {
                        setUploadStatus({ message: '이름을 입력해 주세요.', type: 'error' });
                        return;
                      }
                      handleAddStaff();
                    }}
                    disabled={isAddingStaff}
                    className="flex items-center gap-2 px-8 py-4 rounded-xl bg-[#0a44b8] text-white font-bold hover:bg-[#083694] transition-all disabled:opacity-50"
                  >
                    {isAddingStaff ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <PlusCircle className="w-5 h-5" />
                    )}
                    근무자 등록하기
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-lg font-black text-slate-900">등록된 근무자 목록 ({staff.length}명)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-8 py-4">이름</th>
                        <th className="px-8 py-4">직책</th>
                        <th className="px-8 py-4">연락처</th>
                        <th className="px-8 py-4 text-center">참여 일수</th>
                        <th className="px-8 py-4 text-center">참여 건수</th>
                        <th className="px-8 py-4">등록일</th>
                        <th className="px-8 py-4 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {staff.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">
                            등록된 근무자가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        staff.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-6 font-bold text-slate-900">{s.name}</td>
                            <td className="px-8 py-6 text-sm text-slate-600">{s.role || '-'}</td>
                            <td className="px-8 py-6 text-sm text-slate-600">{s.phone || '-'}</td>
                            <td className="px-8 py-6 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#0a44b8]">
                                {staffStats[s.id]?.days.size || 0}일
                              </span>
                            </td>
                            <td className="px-8 py-6 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">
                                {staffStats[s.id]?.count || 0}건
                              </span>
                            </td>
                            <td className="px-8 py-6 text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                            <td className="px-8 py-6 text-right">
                              {confirmDeleteStaffId === s.id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => handleDeleteStaff(s.id, s.name)}
                                    className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-all"
                                  >
                                    삭제
                                  </button>
                                  <button 
                                    onClick={() => setConfirmDeleteStaffId(null)}
                                    className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300 transition-all"
                                  >
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setConfirmDeleteStaffId(s.id)}
                                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black text-slate-900">예식장 데이터 업로드</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSampleUpload}
                      className="text-xs font-bold text-[#0a44b8] hover:underline px-3 py-1 rounded-lg bg-blue-50 transition-all"
                    >
                      샘플 데이터 넣기
                    </button>
                    <button 
                      onClick={handleClearHalls}
                      disabled={isClearing}
                      className="text-xs font-bold text-red-500 hover:text-red-600 px-3 py-1 rounded-lg bg-red-50 transition-all disabled:opacity-50"
                    >
                      {isClearing ? '삭제 중...' : '전체 데이터 삭제'}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mb-6">
                  엑셀에서 데이터를 복사해서 그대로 붙여넣으세요. (탭 구분 또는 콤마 구분 모두 지원합니다.)<br/>
                  <span className="text-xs text-slate-400">형식: 예식장명 [탭] 도 [탭] 시/군/구 [탭] 주소</span>
                </p>
                
                <textarea 
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder="글래드 호텔 여의도	서울	영등포구"
                  className="w-full h-64 p-4 rounded-2xl border border-slate-200 bg-slate-50 font-mono text-xs focus:outline-none focus:border-[#0a44b8] focus:bg-white transition-all mb-4"
                />

                {uploadStatus && (
                  <div className={`mb-4 p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${
                    uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    uploadStatus.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' :
                    'bg-blue-50 text-[#0a44b8] border border-blue-100'
                  }`}>
                    {uploadStatus.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    {uploadStatus.message}
                    <button onClick={() => setUploadStatus(null)} className="ml-auto opacity-50 hover:opacity-100">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                <div className="flex justify-end gap-4 items-center">
                  {uploadStatus && adminViewMode === 'data' && (
                    <div className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${
                      uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                      uploadStatus.type === 'error' ? 'bg-red-50 text-red-600' :
                      'bg-blue-50 text-[#0a44b8]'
                    }`}>
                      {uploadStatus.message}
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      if (!csvInput.trim()) {
                        setUploadStatus({ message: '데이터를 입력해 주세요.', type: 'error' });
                        return;
                      }
                      handleCsvUpload();
                    }}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-8 py-4 rounded-xl bg-[#0a44b8] text-white font-bold hover:bg-[#083694] transition-all disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        업로드 중...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-5 h-5" />
                        데이터 업로드 시작
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h3 className="text-xl font-black text-slate-900">현재 등록된 예식장 ({allWeddingHalls.length}건)</h3>
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      value={adminHallSearch}
                      onChange={(e) => setAdminHallSearch(e.target.value)}
                      placeholder="예식장 이름, 지역 검색..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#0a44b8] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {filteredAdminHalls.slice(0, 60).map(hall => (
                    <div key={hall.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-start justify-between group">
                      <div>
                        <p className="font-bold text-slate-900">{hall.name}</p>
                        <p className="text-[10px] text-slate-500">{hall.province} {hall.city}</p>
                        {hall.address && <p className="text-[9px] text-slate-400 mt-1 truncate max-w-[150px]">{hall.address}</p>}
                      </div>
                      <button 
                        onClick={() => handleDeleteHall(hall.id, hall.name)}
                        className={`p-2 rounded-lg transition-all flex items-center gap-1 ${
                          deletingHallId === hall.id 
                            ? 'bg-red-500 text-white px-3' 
                            : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                        title={deletingHallId === hall.id ? "한 번 더 눌러 삭제" : "삭제"}
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingHallId === hall.id && <span className="text-[10px] font-bold">진짜 삭제?</span>}
                      </button>
                    </div>
                  ))}
                  {filteredAdminHalls.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 font-medium">
                      검색 결과가 없습니다.
                    </div>
                  )}
                  {filteredAdminHalls.length > 60 && (
                    <div className="col-span-full p-4 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">
                      외 {filteredAdminHalls.length - 60}건 더 있음 (검색어를 입력하여 좁혀보세요)
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Pending Confirmation Modal */}
        <AnimatePresence>
          {selectedReservationForDetail && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 md:p-6"
              onClick={() => setSelectedReservationForDetail(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-4xl bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white ${
                      selectedReservationForDetail.status === 'confirmed' ? 'bg-emerald-500' :
                      selectedReservationForDetail.status === 'cancelled' ? 'bg-red-500' :
                      selectedReservationForDetail.status === 'cancel_requested' ? 'bg-purple-500' :
                      'bg-orange-500'
                    }`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-slate-900">예약 상세 정보</h3>
                        {selectedReservationForDetail.isWaitlist && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-black rounded-full border border-orange-200 uppercase tracking-tighter">
                            줄서기
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reservation ID: {selectedReservationForDetail.id}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedReservationForDetail(null)}
                    className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Left Column: Info */}
                    <div className="space-y-8">
                      <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">고객 및 예식 정보</h4>
                        <div className="bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500">예약자</span>
                            <span className="font-black text-slate-900">{selectedReservationForDetail.customerName}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500">연락처</span>
                            <span className="font-black text-slate-900">{selectedReservationForDetail.customerPhone}</span>
                          </div>
                          <div className="h-px bg-slate-200" />
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500">예식 일시</span>
                            <div className="flex items-center gap-2">
                              {(() => {
                                const target = new Date(selectedReservationForDetail.date);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                target.setHours(0, 0, 0, 0);
                                const diffTime = target.getTime() - today.getTime();
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                const dDayStr = diffDays === 0 ? 'D-DAY' : diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;
                                return (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                    diffDays === 0 ? 'bg-red-500 text-white border-red-600' :
                                    diffDays > 0 && diffDays <= 7 ? 'bg-orange-100 text-orange-600 border-orange-200' :
                                    diffDays > 0 ? 'bg-[#0a44b8] text-white border-[#0a44b8]' :
                                    'bg-slate-100 text-slate-400 border-slate-200'
                                  }`}>
                                    {dDayStr}
                                  </span>
                                );
                              })()}
                              <span className="font-black text-slate-900">{selectedReservationForDetail.date} {selectedReservationForDetail.time}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500">예식장</span>
                            <span className="font-black text-slate-900">{selectedReservationForDetail.weddingHall}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500">지역</span>
                            <span className="font-black text-slate-900">{selectedReservationForDetail.location}</span>
                          </div>
                          <div className="h-px bg-slate-200" />
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500">삼각대 설치 가능</span>
                            <span className={`font-black ${
                              selectedReservationForDetail.tripodCheck === 'possible' ? 'text-emerald-600' :
                              selectedReservationForDetail.tripodCheck === 'impossible' ? 'text-red-600' :
                              'text-orange-600'
                            }`}>
                              {selectedReservationForDetail.tripodCheck === 'possible' ? '가능' :
                               selectedReservationForDetail.tripodCheck === 'impossible' ? '불가능' :
                               '확인 전'}
                            </span>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">상품 및 결제</h4>
                        <div className="bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500">선택 팀</span>
                            <span className="font-black text-[#0a44b8]">{selectedReservationForDetail.teamName}</span>
                          </div>
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-bold text-slate-500">추가 옵션</span>
                            <div className="text-right">
                              {selectedReservationForDetail.addOns.length > 0 ? (
                                selectedReservationForDetail.addOns.map((addon, i) => (
                                  <p key={i} className="text-xs font-bold text-slate-700">{addon}</p>
                                ))
                              ) : (
                                <span className="text-xs font-bold text-slate-400">없음</span>
                              )}
                            </div>
                          </div>
                          <div className="h-px bg-slate-200" />
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500">총 결제 금액</span>
                            <span className="text-lg font-black text-slate-900">{selectedReservationForDetail.totalPrice.toLocaleString()}원</span>
                          </div>
                        </div>
                      </section>
                    </div>

                    {/* Right Column: Management */}
                    <div className="space-y-8">
                      <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">전담 근무자 배정</h4>
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                          {Array.from({ length: selectedReservationForDetail.teamId === 'team-4' ? 4 : 2 }).map((_, i) => {
                            const assignment = selectedReservationForDetail.staffAssignments?.[i];
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <span className="text-xs font-black text-slate-300 w-4">{i + 1}</span>
                                <select 
                                  value={assignment?.staffId || ''}
                                  onChange={(e) => {
                                    const s = staff.find(st => st.id === e.target.value);
                                    if (s) handleAssignStaffAtIndex(selectedReservationForDetail.id!, i, s.id, s.name);
                                  }}
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-[#0a44b8] transition-all"
                                >
                                  <option value="">근무자 선택</option>
                                  {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">예약 상태 관리</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => updateReservationStatus(selectedReservationForDetail.id!, 'pending')}
                            className={`py-3 rounded-xl text-sm font-bold transition-all ${selectedReservationForDetail.status === 'pending' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                          >
                            대기 처리
                          </button>
                          <button 
                            onClick={() => updateReservationStatus(selectedReservationForDetail.id!, 'confirmed')}
                            className={`py-3 rounded-xl text-sm font-bold transition-all ${selectedReservationForDetail.status === 'confirmed' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                          >
                            예약 확정
                          </button>
                          <button 
                            onClick={() => updateReservationStatus(selectedReservationForDetail.id!, 'cancelled')}
                            className={`py-3 rounded-xl text-sm font-bold transition-all ${selectedReservationForDetail.status === 'cancelled' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                          >
                            예약 취소
                          </button>
                          <button 
                            onClick={() => updateReservationStatus(selectedReservationForDetail.id!, 'rejected')}
                            className={`py-3 rounded-xl text-sm font-bold transition-all ${selectedReservationForDetail.status === 'rejected' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            예약 거절
                          </button>
                        </div>
                        {selectedReservationForDetail.status === 'cancel_requested' && (
                          <div className="mt-4 p-4 bg-purple-50 border border-purple-100 rounded-2xl">
                            <p className="text-xs font-bold text-purple-700 mb-3 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" />
                              고객이 예약을 취소해달라고 요청했습니다.
                            </p>
                            <button 
                              onClick={() => updateReservationStatus(selectedReservationForDetail.id!, 'cancelled', '고객 요청에 의한 취소 승인')}
                              className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-black hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
                            >
                              취소 요청 승인하기
                            </button>
                          </div>
                        )}
                      </section>

                      <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">변경 이력</h4>
                        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 max-h-48 overflow-y-auto space-y-4">
                          {(selectedReservationForDetail.history || []).length > 0 ? (
                            selectedReservationForDetail.history?.map((h, i) => (
                              <div key={i} className="flex gap-3 text-[11px]">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                                <div>
                                  <p className="font-bold text-slate-900">
                                    상태 변경: <span className="text-[#0a44b8]">{h.status}</span>
                                  </p>
                                  {h.note && <p className="text-slate-500 mt-0.5">{h.note}</p>}
                                  <p className="text-slate-400 mt-0.5">{new Date(h.timestamp).toLocaleString()}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs font-bold text-slate-400 text-center py-4">변경 이력이 없습니다.</p>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  {confirmDeleteId === selectedReservationForDetail.id ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-red-600">정말 영구 삭제하시겠습니까?</span>
                      <button 
                        onClick={() => deleteReservation(selectedReservationForDetail.id!)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-all"
                      >
                        확인
                      </button>
                      <button 
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-300 transition-all"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmDeleteId(selectedReservationForDetail.id!)}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl text-red-500 font-bold hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      기록 영구 삭제
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedReservationForDetail(null)}
                    className="px-10 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all"
                  >
                    닫기
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending Confirmation Modal */}
        <AnimatePresence>
          {pendingConfirmReservationId && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6"
              onClick={() => setPendingConfirmReservationId(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mb-6">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">대기 현황으로 복귀하시겠습니까?</h3>
                  <p className="text-slate-500 text-sm mb-8">
                    해당 예약을 확정 상태에서 취소하고 다시 대기 목록으로 이동합니다. 인원 배정 정보는 유지되지만, 고객에게는 대기 상태로 표시될 수 있습니다.
                  </p>
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <button 
                      onClick={() => setPendingConfirmReservationId(null)}
                      className="py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                    >
                      취소
                    </button>
                    <button 
                      onClick={() => {
                        if (pendingConfirmReservationId) {
                          updateReservationStatus(pendingConfirmReservationId, 'pending');
                        }
                        setPendingConfirmReservationId(null);
                      }}
                      className="py-4 bg-[#0a44b8] text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors"
                    >
                      복귀하기
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-900 font-sans">
      {/* Success Overlay */}
      <AnimatePresence>
        {submitSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-3xl p-10 text-center shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">
                {isLastSubmissionWaitlist ? '줄서기 신청 완료!' : '예약 신청 완료!'}
              </h3>
              <p className="text-slate-500 mb-8">
                {isLastSubmissionWaitlist 
                  ? '줄서기 신청이 정상적으로 접수되었습니다. 예약 취소 발생 시 순차적으로 연락드리겠습니다.'
                  : '예약 신청이 정상적으로 접수되었습니다. 24시간 내로 예약금을 이체하실 계좌 정보를 안내해 드리겠습니다.'
                }
                <br />
                <span className="text-xs mt-2 block text-orange-600 font-medium">
                  * {isLastSubmissionWaitlist ? '3회 이상 연락 부재 시 다음 순번으로 기회가 넘어갑니다.' : '24시간 이내 안내가 오지 않으면 [망고바나나웨딩] 카카오톡으로 문의주세요.'}
                </span>
              </p>
              <button 
                onClick={() => setSubmitSuccess(false)}
                className="w-full rounded-xl bg-[#0a44b8] py-4 font-bold text-white shadow-lg shadow-[#0a44b8]/20 transition-all hover:bg-[#0a3a9c]"
              >
                확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Info Modal */}
      <AnimatePresence>
        {showPrecautions && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-3xl p-10 shadow-2xl"
            >
              <h3 className="text-2xl font-black text-slate-900 mb-6">예약자 정보 입력</h3>
              
              <div className="space-y-6 mb-8">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700">예약자 성함</label>
                    <span className="text-red-500 text-[10px] font-bold">*필수</span>
                  </div>
                  <p className="text-[10px] text-[#0a44b8] font-bold mb-1">반드시 본명을 기재해 주세요.</p>
                  <input 
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="성함을 입력해 주세요"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-4 px-4 font-bold focus:border-[#0a44b8] focus:bg-white focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700">연락처</label>
                    <span className="text-red-500 text-[10px] font-bold">*필수</span>
                  </div>
                  <p className="text-[10px] text-[#0a44b8] font-bold mb-1">휴대폰 번호 11자리를 모두 입력해 주세요.</p>
                  <input 
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))}
                    placeholder="010-0000-0000"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-4 px-4 font-bold focus:border-[#0a44b8] focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700">웨딩홀 카메라 삼각대 설치 가능 유무</label>
                    <span className="text-red-500 text-[10px] font-bold">*필수</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'possible', label: '가능합니다' },
                      { id: 'not_checked', label: '아직 확인하지 못했습니다' },
                      { id: 'impossible', label: '불가능합니다' }
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTripodCheck(option.id as any)}
                        className={`w-full rounded-xl border py-3 px-4 text-sm font-bold transition-all flex items-center justify-between ${
                          tripodCheck === option.id
                            ? 'border-[#0a44b8] bg-[#0a44b8]/5 text-[#0a44b8]'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {option.label}
                        {tripodCheck === option.id && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                  {tripodCheck === 'impossible' && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[11px] font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2"
                    >
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      삼각대 설치가 불가능한 경우 전문적인 촬영 및 안내가 어려워 예약 신청이 제한됩니다. 웨딩홀 측에 다시 한번 확인 부탁드립니다.
                    </motion.p>
                  )}
                </div>
                
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                  <p className="text-xs text-orange-700 leading-relaxed font-medium">
                    <Info className="w-3 h-3 inline-block mr-1 mb-0.5" />
                    {isDateBooked(selectedDate) ? (
                      "줄서기 신청하기를 하는 경우에는 예약이 취소된 경우 바로 연락을 드리고 있습니다. 3회 연락(전화, 문자)을 드리고 회신이 없으면 다음 줄서기 신청자에게 기회가 돌아갑니다."
                    ) : (
                      <>만약 24시간 이내 예약금 입금 안내가 오지 않으면 <strong>[망고바나나웨딩]</strong> 카카오톡으로 문의를 주세요.</>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowPrecautions(false);
                    setTripodCheck(null);
                  }}
                  className="flex-1 rounded-xl bg-slate-100 py-4 font-bold text-slate-500 hover:bg-slate-200 transition-all"
                >
                  취소
                </button>
                <button 
                  onClick={handleReservationSubmit}
                  disabled={isSubmitting || !customerName || customerPhone.replace(/\D/g, '').length !== 11 || !tripodCheck || tripodCheck === 'impossible' || (isDirectTime && !customTime.trim()) || !selectedWeddingHall}
                  className="flex-2 rounded-xl bg-[#0a44b8] py-4 font-bold text-white shadow-lg shadow-[#0a44b8]/20 transition-all hover:bg-[#0a3a9c] disabled:opacity-50"
                >
                  {isSubmitting ? '처리 중...' : (isDateBooked(selectedDate) ? '줄서기 신청' : '신청 완료')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100">
              <Logo className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-[#0a44b8]">망고바나나웨딩</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Mango Banana Wedding</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            <button 
              onClick={() => setView('user')}
              className={`${view === 'user' ? 'text-[#0a44b8]' : 'text-slate-600 hover:text-[#0a44b8]'} transition-colors`}
            >
              서비스 예약
            </button>
            <button 
              onClick={() => setView('intro')}
              className={`${view === 'intro' ? 'text-[#0a44b8]' : 'text-slate-600 hover:text-[#0a44b8]'} transition-colors`}
            >
              서비스 소개
            </button>
            <a className="hover:text-[#0a44b8] transition-colors text-slate-600" href="#">포트폴리오</a>
            <a className="hover:text-[#0a44b8] transition-colors text-slate-600" href="#">고객센터</a>
          </nav>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setShowMyReservations(true);
                setHasSearched(false);
                setUserReservations([]);
                setLookupName('');
                setLookupPhone('');
              }}
              className="px-4 py-2 rounded-xl bg-[#0a44b8] text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              내 예약 조회
            </button>
            {isAdminAuthenticated && user && (
              <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900">{user.displayName || '관리자'}</p>
                  <button 
                    onClick={handleLogout}
                    className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                  >
                    로그아웃
                  </button>
                </div>
                <div 
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0a44b8]/10 border border-[#0a44b8]/20 overflow-hidden"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserCircle className="w-6 h-6 text-[#0a44b8]" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        {view === 'intro' ? (
          <div className="space-y-20 py-10">
            {/* Hero Section */}
            <section className="text-center space-y-8 max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-block px-4 py-1.5 rounded-full bg-[#0a44b8]/10 text-[#0a44b8] text-xs font-black tracking-widest uppercase"
              >
                Professional Wedding Management
              </motion.div>
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl md:text-6xl font-black leading-tight text-slate-900 tracking-tighter"
              >
                가장 소중한 날,<br />
                <span className="text-[#0a44b8]">가장 투명하고 안전하게</span>
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl text-slate-500 leading-relaxed"
              >
                복잡하고 정신없는 결혼식 당일 축의대,<br />
                이제 전문가에게 맡기고 온전히 축복에만 집중하세요.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="pt-4"
              >
                <button 
                  onClick={() => setView('user')}
                  className="px-10 py-5 bg-[#0a44b8] text-white rounded-2xl font-black text-lg shadow-xl shadow-[#0a44b8]/20 hover:bg-[#0a3a9c] transition-all hover:scale-105 active:scale-95"
                >
                  지금 바로 예약하기
                </button>
              </motion.div>
            </section>

            {/* Why Us Section */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: "전문 2인 1팀 체제",
                  desc: "단순 알바가 아닌, 수백 건의 예식 경험을 가진 전문 매니저 2인이 한 팀으로 투입되어 완벽한 호흡을 자랑합니다.",
                  icon: <Users className="w-8 h-8" />,
                  color: "bg-blue-50 text-blue-600"
                },
                {
                  title: "실시간 투명성 보장",
                  desc: "전 과정 영상 녹화는 물론, 웨딩홀 허가 시 유튜브 라이브 스트리밍을 통해 실시간으로 상황을 확인할 수 있습니다.",
                  icon: <Video className="w-8 h-8" />,
                  color: "bg-orange-50 text-orange-600"
                },
                {
                  title: "디지털 장부 시스템",
                  desc: "수기 장부의 오류를 방지하기 위해 실시간으로 엑셀 장부를 작성하며, 예식 종료 즉시 데이터를 전송해 드립니다.",
                  icon: <FileText className="w-8 h-8" />,
                  color: "bg-emerald-50 text-emerald-600"
                }
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + (idx * 0.1) }}
                  className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
                >
                  <div className={`w-16 h-16 ${item.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 mb-4">{item.title}</h4>
                  <p className="text-slate-500 leading-relaxed text-sm">{item.desc}</p>
                </motion.div>
              ))}
            </section>

            {/* Hooking Section */}
            <section className="bg-slate-900 rounded-[3rem] p-12 md:p-20 text-white overflow-hidden relative">
              <div 
                className="absolute inset-0 z-0 opacity-20 bg-cover bg-center"
                style={{ 
                  backgroundImage: 'url("https://picsum.photos/seed/wedding-ceremony/1920/1080")',
                  filter: 'grayscale(50%)'
                }}
              />
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#0a44b8] opacity-20 blur-[100px] -mr-20 -mt-20"></div>
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                  <h3 className="text-[34px] font-black leading-tight">
                    부모님께는 <span className="text-[#0a44b8]">여유</span>를,<br />
                    신랑 신부님께는 <span className="text-[#0a44b8]">확신</span>을 드립니다.
                  </h3>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="h-6 w-6 rounded-full bg-[#0a44b8] flex items-center justify-center shrink-0 mt-1">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-slate-300">귀한 손님을 맞이하는 일, 더 이상 친척들에게 미안해하며 부탁하지 마세요.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="h-6 w-6 rounded-full bg-[#0a44b8] flex items-center justify-center shrink-0 mt-1">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-slate-300">단 1원의 오차도 허용하지 않는 투명한 실시간 정산 시스템을 경험하세요.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="h-6 w-6 rounded-full bg-[#0a44b8] flex items-center justify-center shrink-0 mt-1">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-slate-300">예식이 끝남과 동시에 전달되는 디지털 명부로 감사의 마음을 더 빠르게 전하세요.</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="h-12 w-12 rounded-full bg-[#0a44b8] flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold">안심 운영 시스템</p>
                      <p className="text-xs text-slate-400">망고바나나웨딩만의 약속</p>
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-8">
                    "저희는 단순한 대행이 아닙니다. 신뢰를 대행합니다. 예식의 시작부터 끝까지 모든 과정을 투명하게 기록하고 관리합니다."
                  </p>
                  <div className="flex items-center justify-between pt-6 border-t border-white/10">
                    <div className="flex -space-x-2">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-8 w-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Process Section */}
            <section className="space-y-12">
              <div className="text-center">
                <h3 className="text-3xl font-black text-slate-900">서비스 진행 프로세스</h3>
                <p className="text-slate-500 mt-4">체계적인 시스템으로 빈틈없이 관리합니다.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { step: "01", title: "예약 및 상담", desc: "날짜 확인 후 예약 신청" },
                  { step: "02", title: "사전 정보 확인", desc: "예식 1주 전 최종 정보 취합" },
                  { step: "03", title: "현장 서비스", desc: "예식 당일 전문 팀 투입" },
                  { step: "04", title: "정산 및 인계", desc: "즉시 정산 및 데이터 전송" }
                ].map((item, idx) => (
                  <div key={idx} className="relative p-8 bg-slate-50 rounded-3xl border border-slate-100">
                    <span className="text-4xl font-black text-[#0a44b8]/10 absolute top-4 right-6">{item.step}</span>
                    <h4 className="font-bold text-slate-900 mb-2">{item.title}</h4>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Final CTA */}
            <section className="text-center py-10">
              <h3 className="text-2xl font-bold text-slate-900 mb-8">지금 바로 망고바나나웨딩과 함께하세요.</h3>
              <button 
                onClick={() => setView('user')}
                className="px-12 py-5 bg-[#0a44b8] text-white rounded-2xl font-black text-xl shadow-2xl shadow-[#0a44b8]/30 hover:bg-[#0a3a9c] transition-all"
              >
                예약 가능 날짜 확인하기
              </button>
            </section>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Main Form Section */}
          <div className="lg:col-span-8 space-y-12">
            {/* Header Intro */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-4xl font-black leading-tight tracking-tight mb-4">전문 축의대 서비스 예약</h2>
              <p className="text-lg text-slate-500">품격 있는 결혼식을 위해 망고바나나웨딩 전문 팀이 함께합니다. 감사합니다.</p>
            </motion.section>

            {/* 1. Calendar Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xl font-bold">
                  <CalendarIcon className="w-6 h-6 text-[#0a44b8]" />
                  01. 예식 날짜 선택
                </h3>
                <div className="flex gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-200"></span> 예약마감</div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-400"></span> 줄서기 가능</div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0a44b8]"></span> 예약가능</div>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                  <div className="mb-4 flex items-center justify-between px-2">
                    <button onClick={handlePrevMonth} className="rounded-lg p-2 hover:bg-slate-100"><ChevronLeft className="w-5 h-5" /></button>
                    <span className="text-lg font-bold">{currentYear}년 {currentMonth + 1}월</span>
                    <button onClick={handleNextMonth} className="rounded-lg p-2 hover:bg-slate-100"><ChevronRight className="w-5 h-5" /></button>
                  </div>
                  <div className="grid grid-cols-7 text-center text-sm">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                      <div key={day} className={`py-3 font-bold ${idx === 0 || idx === 6 ? 'text-red-500' : ''}`}>
                        {day}
                      </div>
                    ))}
                    {calendarDays.map((day, idx) => {
                      const dateObj = day ? new Date(currentYear, currentMonth, day) : null;
                      const resStatus = dateObj ? getReservationStatus(dateObj) : 'available';
                      const weekend = day ? isWeekend(day) : false;
                      const past = day ? isPastDate(day) : false;
                      const isSelected = day && 
                        selectedDate.getDate() === day && 
                        selectedDate.getMonth() === currentMonth && 
                        selectedDate.getFullYear() === currentYear;
                      
                      return (
                        <button 
                          key={idx}
                          disabled={!day || past || resStatus === 'full'}
                          onClick={() => day && setSelectedDate(new Date(currentYear, currentMonth, day))}
                          className={`relative py-4 rounded-xl transition-all ${
                            !day ? 'text-transparent cursor-default' : 
                            past ? 'text-slate-300 cursor-not-allowed' :
                            isSelected ? 'bg-[#0a44b8] text-white font-bold shadow-lg shadow-[#0a44b8]/20' :
                            resStatus === 'full' ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                            resStatus === 'waitlist' ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100' :
                            weekend ? 'text-red-500 hover:bg-red-50' :
                            'text-slate-900 hover:bg-slate-50'
                          } ${day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear() ? 'ring-2 ring-inset ring-[#0a44b8]/20' : ''}`}
                        >
                          <span className="relative z-10">{day}</span>
                          {day && !past && (
                            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                              {resStatus === 'full' ? (
                                <span className="h-1 w-1 rounded-full bg-slate-400"></span>
                              ) : resStatus === 'waitlist' ? (
                                <span className="h-1 w-1 rounded-full bg-orange-400"></span>
                              ) : (
                                <span className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[#0a44b8]'}`}></span>
                              )}
                            </div>
                          )}
                          {day && !past && resStatus === 'full' && (
                            <span className="absolute top-1 right-1 text-[7px] font-black text-slate-400">마감</span>
                          )}
                          {day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear() && (
                            <span className="absolute top-1 left-1 text-[6px] font-bold text-[#0a44b8]">TODAY</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="w-full md:w-64 space-y-4 rounded-xl bg-slate-50 p-6">
                  <h4 className="font-bold text-sm text-slate-600 uppercase">선택된 날짜</h4>
                  <div className="text-2xl font-black text-[#0a44b8]">
                    {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({['일','월','화','수','목','금','토'][selectedDate.getDay()]})
                  </div>
                  {(() => {
                    const status = getReservationStatus(selectedDate);
                    if (status === 'full') {
                      return (
                        <div className="space-y-2">
                          <p className="text-sm text-slate-400 font-bold">해당 일자는 예약 및 줄서기가 모두 마감되었습니다.</p>
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                            다른 날짜를 선택해 주시기 바랍니다.
                          </p>
                        </div>
                      );
                    }
                    if (status === 'waitlist') {
                      return (
                        <div className="space-y-2">
                          <p className="text-sm text-orange-500 font-bold">해당 일자는 이미 예약이 마감되었습니다. 줄서기 신청이 가능합니다.</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">
                            줄서기 신청 시 예약이 취소되면 바로 연락을 드리며, 3회 연락(전화, 문자) 후 회신이 없으면 다음 대기자에게 기회가 넘어갑니다.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <p className="text-sm text-slate-500">현재 예약 가능한 상태입니다. 해당 일자는 인기가 많으니 예약을 서둘러주세요.</p>
                    );
                  })()}
                </div>
              </div>
            </section>

            {/* 2. Reservation Time Selection */}
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="flex items-center gap-2 text-xl font-bold mb-8">
                <Clock className="w-6 h-6 text-[#0a44b8]" />
                02. 예약시간 설정
              </h3>
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700">예식 시간 선택</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'].map((time) => {
                    const [h, m] = time.split(':');
                    const isSelected = !isDirectTime && selectedHour === h && selectedMinute === m;
                    return (
                      <button
                        key={time}
                        onClick={() => {
                          setIsDirectTime(false);
                          setSelectedHour(h);
                          setSelectedMinute(m);
                        }}
                        className={`py-3 px-4 rounded-xl border-2 font-bold transition-all ${
                          isSelected 
                          ? 'border-[#0a44b8] bg-[#0a44b8] text-white shadow-md' 
                          : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-[#0a44b8]/30'
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                  {/* Direct Input Field */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="직접 입력"
                      value={customTime}
                      onChange={(e) => {
                        const formatted = formatTimeInput(e.target.value);
                        setCustomTime(formatted);
                        setIsDirectTime(true);
                      }}
                      onFocus={() => setIsDirectTime(true)}
                      maxLength={5}
                      className={`w-full py-3 px-4 rounded-xl border-2 font-bold transition-all text-center outline-none ${
                        isDirectTime 
                        ? 'border-[#0a44b8] bg-black text-white shadow-md' 
                        : 'border-slate-100 bg-black text-white hover:border-[#0a44b8]/30'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Team Selection */}
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="flex items-center gap-2 text-xl font-bold mb-8">
                <Users className="w-6 h-6 text-[#0a44b8]" />
                03. 팀 구성 선택
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {TEAM_OPTIONS.map(team => (
                  <div 
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all ${
                      selectedTeamId === team.id 
                      ? 'border-[#0a44b8] bg-[#0a44b8]/5 shadow-xl shadow-[#0a44b8]/5' 
                      : 'border-slate-100 hover:border-[#0a44b8]/30'
                    }`}
                  >
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                      selectedTeamId === team.id ? 'bg-[#0a44b8] text-white' : 'bg-slate-100'
                    }`}>
                      {team.icon}
                    </div>
                    <h4 className="text-lg font-extrabold mb-1">{team.name}</h4>
                    <p className="text-sm text-slate-500 mb-6 whitespace-pre-line">{team.description}</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-black ${selectedTeamId === team.id ? 'text-[#0a44b8]' : ''}`}>
                        {team.price.toLocaleString()}
                      </span>
                      <span className="text-sm font-bold text-slate-500">원</span>
                    </div>
                    <div className={`absolute right-6 top-6 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      selectedTeamId === team.id ? 'bg-[#0a44b8] border-[#0a44b8]' : 'border-slate-200'
                    }`}>
                      {selectedTeamId === team.id && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Selection Options */}
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="flex items-center gap-2 text-xl font-bold mb-8">
                <PlusCircle className="w-6 h-6 text-[#0a44b8]" />
                04. 선택 옵션
              </h3>
              
              <div className="space-y-8">
                {/* Wedding Hall Search */}
                <div className="space-y-4">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-bold text-slate-700">예식장 검색</label>
                    <span className="text-red-500 font-bold text-xs">*필수</span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Search className="w-5 h-5" />
                    </div>
                    <input 
                      type="text"
                      placeholder="예식장 명칭 또는 지역을 입력하세요"
                      value={weddingHallSearch}
                      onChange={(e) => {
                        setWeddingHallSearch(e.target.value);
                        setShowWeddingHallDropdown(true);
                      }}
                      onFocus={() => setShowWeddingHallDropdown(true)}
                      onBlur={() => setTimeout(() => setShowWeddingHallDropdown(false), 200)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 font-medium focus:border-[#0a44b8] focus:bg-white focus:outline-none transition-all"
                    />
                    
                    {/* Search Results */}
                    <AnimatePresence>
                      {showWeddingHallDropdown && weddingHallSearch.trim().length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                        >
                          {filteredWeddingHalls.length > 0 ? (
                            filteredWeddingHalls.map((hall, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setSelectedWeddingHall(hall);
                                  setWeddingHallSearch(hall.name);
                                  setShowWeddingHallDropdown(false);
                                }}
                                className="flex w-full items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                              >
                                <div className="text-left">
                                  <p className="font-bold text-slate-900">{hall.name}</p>
                                  <p className="text-xs text-slate-500">{hall.address}</p>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-500">{hall.province} {hall.city}</span>
                              </button>
                            ))
                          ) : (
                            <div className="p-8 text-center">
                              <p className="text-sm font-bold text-slate-400">검색 결과가 없습니다.</p>
                              <p className="text-[10px] text-slate-300 mt-1">정확한 명칭이나 지역명을 입력해 보세요.</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    * 찾으시는 예식장이 없으시다면, '미정'을 검색하여 선택해주세요.
                  </p>
                  {selectedWeddingHall && (
                    <div className="flex items-center gap-2 rounded-xl bg-[#0a44b8]/5 p-4 border border-[#0a44b8]/10">
                      <MapPin className="w-5 h-5 text-[#0a44b8]" />
                      <div>
                        <p className="text-sm font-bold text-[#0a44b8]">{selectedWeddingHall.name}</p>
                        <p className="text-xs text-slate-500">{selectedWeddingHall.address}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Conditional Options for Team-2 Side Selection */}
                {selectedTeamId === 'team-2' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-8 pt-4 border-t border-slate-100"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-1">
                        <label className="text-sm font-bold text-slate-700">진행 측 선택</label>
                        <span className="text-red-500 font-bold text-xs">*필수</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setSelectedSide('groom')}
                          className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 font-bold transition-all ${
                            selectedSide === 'groom'
                            ? 'border-[#0a44b8] bg-[#0a44b8] text-white'
                            : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-[#0a44b8]/30'
                          }`}
                        >
                          신랑 측
                        </button>
                        <button
                          onClick={() => setSelectedSide('bride')}
                          className={`flex items-center justify-center gap-2 rounded-xl border-2 py-4 font-bold transition-all ${
                            selectedSide === 'bride'
                            ? 'border-[#0a44b8] bg-[#0a44b8] text-white'
                            : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-[#0a44b8]/30'
                          }`}
                        >
                          신부 측
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Settlement Type Selection */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-bold text-slate-700">정산 방식 선택</label>
                    <span className="text-red-500 font-bold text-xs">*필수</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {SETTLEMENT_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setSelectedSettlementType(type.id)}
                        className={`flex flex-col p-4 rounded-xl border-2 text-left transition-all ${
                          selectedSettlementType === type.id
                          ? 'border-[#0a44b8] bg-[#0a44b8]/5'
                          : 'border-slate-100 bg-slate-50 hover:border-[#0a44b8]/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-bold ${selectedSettlementType === type.id ? 'text-[#0a44b8]' : 'text-slate-700'}`}>
                            {type.name}
                          </span>
                          <div className="flex items-center gap-2">
                            {type.icon && (
                              <div className={`flex items-center gap-1.5 ${selectedSettlementType === type.id ? 'text-[#0a44b8]' : 'text-slate-400'} opacity-80`}>
                                {type.label && <span className="text-[10px] font-black uppercase tracking-tighter">{type.label}</span>}
                                {type.icon}
                              </div>
                            )}
                            {type.price > 0 && (
                              <span className="text-xs font-bold text-orange-500">+{type.price.toLocaleString()}원</span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{type.description}</p>
                        {(type.id === 'B' || type.id === 'C') && (
                          <p className="text-[10px] text-orange-500 font-bold mt-1">
                            * 기준 인원 초과시 2,000원 / 1명 당 추가
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4">
            <div className="sticky top-28 space-y-6">
              <motion.div 
                layout
                className="rounded-3xl border border-slate-200 bg-slate-900 p-8 text-white shadow-2xl"
              >
                <h3 className="text-xl font-bold mb-8">예약 요약</h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-slate-400">선택 상품</span>
                    <span className="font-bold">{selectedTeam?.name.split(' ')[0]} {selectedTeam?.name.split(' ')[1]}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-slate-400">일시</span>
                    <span className="font-bold">
                      {selectedDate.getFullYear().toString().slice(-2)}.{String(selectedDate.getMonth() + 1).padStart(2, '0')}.{String(selectedDate.getDate()).padStart(2, '0')} {isDirectTime ? (customTime || '직접 입력') : `${selectedHour}:${selectedMinute}`}
                    </span>
                  </div>
                  {selectedSide && (
                    <div className="flex justify-between border-b border-white/10 pb-4">
                      <span className="text-slate-400">진행 측</span>
                      <span className="font-bold">{selectedSide === 'groom' ? '신랑 측' : '신부 측'}</span>
                    </div>
                  )}
                  {selectedWeddingHall && (
                    <div className="flex justify-between border-b border-white/10 pb-4">
                      <span className="text-slate-400">예식장</span>
                      <span className="font-bold truncate max-w-[150px] text-right">{selectedWeddingHall.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-slate-400">정산 방식</span>
                    <span className="font-bold">{selectedSettlementType}타입</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-slate-400">기준 인원</span>
                    <span className="font-bold">{selectedTeamId === 'team-2' ? '200명' : '300명'}</span>
                  </div>
                  {(selectedSettlementType === 'B' || selectedSettlementType === 'C') && (
                    <div className="flex justify-end -mt-3 mb-2">
                      <span className="text-[10px] text-orange-400 font-bold">
                        * 기준 인원 초과시 2,000원 / 1명 당
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">기본 서비스 비용</span>
                    <span>{selectedTeam?.price.toLocaleString()}원</span>
                  </div>
                  {settlementSurcharge > 0 && (
                    <div className="flex justify-between text-orange-400">
                      <span className="text-slate-400">정산 옵션 비용</span>
                      <span>+ {settlementSurcharge.toLocaleString()}원</span>
                    </div>
                  )}
                </div>
                <div className="mt-10 pt-6 border-t border-white/20">
                  <div className="flex items-end justify-between mb-8">
                    <span className="text-lg font-bold">총 합계</span>
                    <div className="text-right">
                      <p className="text-3xl font-black text-white">{totalPrice.toLocaleString()}원</p>
                    </div>
                  </div>
                  <div 
                    className="relative"
                    onMouseEnter={() => setShowDisabledTooltip(true)}
                    onMouseLeave={() => setShowDisabledTooltip(false)}
                  >
                    <AnimatePresence>
                      {showDisabledTooltip && isFormIncomplete && (
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="absolute right-full mr-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white shadow-xl z-50 pointer-events-none"
                        >
                          필수 선택사항을 모두 입력해주세요
                          <div className="absolute left-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-l-red-500" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button 
                      onClick={() => {
                        if (isReservationDisabled) {
                          if (getReservationStatus(selectedDate) === 'full') {
                            alert("해당 날짜는 예약이 마감되었습니다.");
                          } else if (isFormIncomplete) {
                            alert("필수 선택사항(팀 선택, 예식장, 진행 측 등)을 모두 완료해주세요.");
                          }
                          return;
                        }
                        setShowPrecautions(true);
                      }}
                      className={`w-full rounded-2xl py-5 text-lg font-black shadow-xl transition-all flex items-center justify-center gap-2 ${
                        isReservationDisabled 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-white text-slate-900 hover:scale-[1.02] active:scale-[0.98]'
                      }`}
                    >
                      {isSubmitting ? (
                        <span className="text-sm text-slate-400">처리 중...</span>
                      ) : (
                        getReservationStatus(selectedDate) === 'full' ? '예약 마감' :
                        getReservationStatus(selectedDate) === 'waitlist' ? '줄서기 신청하기' : '예약 요청하기'
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Trust Badges */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-6 text-center border border-slate-200">
                  <Verified className="w-6 h-6 text-[#0a44b8] mb-2" />
                  <p className="text-xs font-bold">투명한 신뢰</p>
                  <p className="text-[10px] text-slate-500">투명한 정산 시스템</p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-6 text-center border border-slate-200">
                  <ShieldCheck className="w-6 h-6 text-[#0a44b8] mb-2" />
                  <p className="text-xs font-bold">안심 운영</p>
                  <p className="text-[10px] text-slate-500">전 과정 녹화 및 공유</p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#0a44b8]/5 p-6 border border-[#0a44b8]/10">
                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-[#0a44b8]/20 flex items-center justify-center">
                    <Headset className="w-5 h-5 text-[#0a44b8]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">전문 상담사가 필요하신가요?</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">복잡한 커스텀 견적이 필요하시다면 실시간 카톡 상담을 이용해 보세요.</p>
                    <button className="mt-3 text-xs font-bold text-[#0a44b8] underline">1:1 상담 바로가기</button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row justify-between gap-10">
            <div className="max-w-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-10 w-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                  <Logo className="w-8 h-8" />
                </div>
                <span className="text-lg font-black tracking-tight text-[#0a44b8]">망고바나나웨딩</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed w-[388px]">
                망고바나나웨딩은 전문적인 예식 운영 관리를 통해 신랑 신부님의 가장 행복한 순간을 가장 안전하고 효율적으로 지켜드립니다.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-10">
              <div className="space-y-4">
                <h5 className="font-bold text-sm uppercase tracking-wider">서비스</h5>
                <ul className="text-sm text-slate-500 space-y-2">
                  <li>
                    <button 
                      onClick={() => setView('intro')}
                      className="hover:text-[#0a44b8]"
                    >
                      서비스 소개
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => setShowTermsModal(true)}
                      className="hover:text-[#0a44b8]"
                    >
                      이용 약관
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => setShowRefundModal(true)}
                      className="hover:text-[#0a44b8]"
                    >
                      환불 규정
                    </button>
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h5 className="font-bold text-sm uppercase tracking-wider">문의</h5>
                <ul className="text-sm text-slate-500 space-y-2">
                  <li>contact@mangobananawedding.com</li>
                  <li>카카오톡 @망고바나나웨딩</li>
                </ul>
              </div>
              <div className="space-y-4 col-span-2 md:col-span-1">
                <h5 className="font-bold text-sm uppercase tracking-wider">SNS</h5>
                <div className="flex gap-4">
                  <a className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-[#0a44b8] hover:text-white transition-colors" href="#">
                    <Share2 className="w-5 h-5" />
                  </a>
                  <a className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-[#0a44b8] hover:text-white transition-colors" href="#">
                    <Instagram className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              © 2026 Mango Banana Wedding. All rights reserved. 
              <button 
                onClick={() => setView('admin')}
                className="ml-1 cursor-default hover:text-slate-500 transition-colors"
              >
                Professional Wedding Management Service.
              </button>
            </p>
          </div>
        </div>
      </footer>

      {/* Refund Policy Modal */}
      <AnimatePresence>
        {showRefundModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6"
            onClick={() => setShowRefundModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">환불 및 위약금 규정</h3>
                <button 
                  onClick={() => setShowRefundModal(false)}
                  className="p-2 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-8">
                  <section>
                    <h4 className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-4">
                      <div className="w-1.5 h-6 bg-[#0a44b8] rounded-full" />
                      1. 계약금 및 잔금 납부 규정
                    </h4>
                    <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="font-bold text-slate-900 mb-1">계약금</p>
                        <p>예약 신청 후 '예약 가능' 안내를 받은 날로부터 24시간 이내에 납부하셔야 예약이 최종 확정됩니다. (미입금 시 예약 신청은 자동 취소됩니다.)</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="font-bold text-slate-900 mb-1">잔금</p>
                        <p>예식일 기준 7일 전까지 납부 완료해주셔야 합니다. 잔금 미납 시 서비스 제공이 거부될 수 있으며, 이는 고객 귀책사유에 의한 취소로 간주됩니다.</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h4 className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-4">
                      <div className="w-1.5 h-6 bg-[#0a44b8] rounded-full" />
                      2. 고객 사정에 의한 취소 및 환불 (위약금 규정)
                    </h4>
                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                      고객의 단순 변심, 노쇼(No-show), 웨딩홀 계약 취소 등 고객 측 사정으로 인한 취소 시, 취소 시점에 따라 다음과 같은 위약금이 발생합니다. 모든 위약금은 '총 서비스 금액'을 기준으로 계산됩니다.
                    </p>
                    
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-4 font-bold text-slate-700">취소 시점 (예식일 기준)</th>
                            <th className="px-4 py-4 font-bold text-slate-700">환불 및 위약금 규정</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="px-4 py-4 text-slate-600">계약일로부터 7일 이내</td>
                            <td className="px-4 py-4 font-medium text-slate-900">계약금 100% 환불<br/><span className="text-[10px] text-slate-400">(단, 예식일이 30일 이내 남았을 경우 제외)</span></td>
                          </tr>
                          <tr>
                            <td className="px-4 py-4 text-slate-600">계약일 7일 이후 ~ 예식 61일 전</td>
                            <td className="px-4 py-4 font-medium text-red-500">계약금 환불 불가<br/><span className="text-[10px] text-slate-400">(계약금 전액 위약금 처리)</span></td>
                          </tr>
                          <tr>
                            <td className="px-4 py-4 text-slate-600">예식 60일 전 ~ 31일 전</td>
                            <td className="px-4 py-4 font-medium text-red-500">총 서비스 금액의 30% 위약금 발생<br/><span className="text-[10px] text-slate-400">(이미 납부한 금액에서 차감 후 환불)</span></td>
                          </tr>
                          <tr>
                            <td className="px-4 py-4 text-slate-600">예식 30일 전 ~ 8일 전</td>
                            <td className="px-4 py-4 font-medium text-red-500">총 서비스 금액의 50% 위약금 발생<br/><span className="text-[10px] text-slate-400">(이미 납부한 금액에서 차감 후 환불 또는 추가 청구)</span></td>
                          </tr>
                          <tr>
                            <td className="px-4 py-4 text-slate-600 bg-red-50/30">예식 7일 전 ~ 당일 (노쇼 포함)</td>
                            <td className="px-4 py-4 font-bold text-red-600 bg-red-50/30">총 서비스 금액의 100% 위약금 발생<br/><span className="text-[10px] text-slate-400">(환불 불가 및 전액 납부 의무)</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setShowRefundModal(false)}
                  className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-colors"
                >
                  확인했습니다
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terms of Service Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6"
            onClick={() => setShowTermsModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">이용 약관</h3>
                <button 
                  onClick={() => setShowTermsModal(false)}
                  className="p-2 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-8 text-sm text-slate-600 leading-relaxed">
                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제1조 (목적)</h4>
                    <p>본 약관은 '망고바나나웨딩'(이하 "회사")이 운영하는 축의대 대행 서비스(이하 "서비스")를 이용함에 있어, 회사와 이용자(이하 "고객")의 권리, 의무 및 책임 사항, 서비스 이용 절차를 규정함을 목적으로 합니다.</p>
                  </section>

                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제2조 (용어의 정의)</h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>"서비스"라 함은 회사가 고객의 결혼식 당일 축의대 운영 전반(축의금 접수, 정산, 명부 작성, 영상 기록 등)을 대행하는 서비스를 말합니다.</li>
                      <li>"고객"이라 함은 본 약관에 동의하고 회사에 서비스를 신청하여 이용하는 자를 말합니다.</li>
                      <li>"지정 인수자"라 함은 고객이 예식 종료 후 회사가 수령한 축의금, 명부 등을 인계받도록 미리 지정한 자를 말합니다.</li>
                    </ol>
                  </section>

                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제3조 (약관의 명시 및 개정)</h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>회사는 본 약관의 내용을 고객이 쉽게 알 수 있도록 홈페이지 초기 화면 또는 예약 신청 화면에 게시합니다.</li>
                      <li>회사는 관계 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 적용 일자 및 개정 사유를 명시하여 적용 일자 7일 전부터 공지합니다.</li>
                    </ol>
                  </section>

                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제4조 (서비스 신청 및 계약 성립)</h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>고객은 홈페이지 또는 회사가 지정한 채널을 통해 예식 정보(날짜, 시간, 장소, 하객 수 등) 및 원하는 서비스 옵션(정산 방식 A/B/C 등)을 입력하여 서비스를 신청합니다.</li>
                      <li>회사는 신청 내용을 검토 후 예약 가능 여부를 고객에게 통보합니다.</li>
                      <li>고객이 회사의 안내에 따라 계약금을 납부한 시점에 서비스 이용 계약이 최종 성립된 것으로 봅니다.</li>
                    </ol>
                  </section>

                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제5조 (서비스의 내용 및 제공)</h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>회사는 고객이 선택한 상품(한 측 전담 또는 양가 패키지) 및 옵션에 따라 예식 당일 2인 1팀으로 서비스를 제공합니다.</li>
                      <li>서비스의 구체적인 내용은 다음과 같습니다.
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-500">
                          <li>예식 시작 1시간~1시간 10분 전 도착 및 축의대 환경 세팅</li>
                          <li>하객 방명록 작성 안내 및 축의금 접수, 식권 배부 및 수량 관리</li>
                          <li>고객이 선택한 정산 방식(Type A: 즉시 밀봉, Type B: 금액 확인 후 밀봉, Type C: 개봉 후 권종별 정리)에 따른 축의금 처리</li>
                          <li>실시간 엑셀 장부 작성 및 예식 종료 후 전송</li>
                          <li>화환 사진 촬영 및 전송, 현장 세심 케어(혼주 장갑 착용 안내 등)</li>
                          <li>예식 전체 과정 영상 촬영(카메라 2~4대) 및 유튜브 라이브 스트리밍 제공 (단, 웨딩홀 허가 시)</li>
                          <li>지정 인수자에게 축의금 및 명부 대면 인계</li>
                        </ul>
                      </li>
                    </ol>
                  </section>

                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제6조 (요금 및 결제 방법)</h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>서비스 요금은 홈페이지에 명시된 상품별 기본 요금에 고객이 선택한 옵션(정산 방식 Type C 추가 요금, 인원 초과 추가 요금, 출장비 등)을 합산하여 결정됩니다.</li>
                      <li>결제는 계약금과 잔금으로 나누어 진행되며, 지정된 기한(계약금은 예약 가능 안내 후 24시간 이내, 잔금은 예식 7일 전)까지 회사 지정 계좌로 입금해야 합니다.</li>
                      <li>초과 인원 발생 시 추가 요금은 예식 당일 현장에서 정산하거나 예식 후 1주일 이내 납부해야 합니다.</li>
                    </ol>
                  </section>

                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제7조 (환불 및 위약금 규정)</h4>
                    <p className="mb-4">고객 사정에 의한 취소 시, 취소 시점에 따라 다음과 같은 위약금이 발생합니다. 모든 위약금은 총 서비스 금액을 기준으로 계산됩니다.</p>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-3 py-3 font-bold text-slate-700">취소 시점 (예식일 기준)</th>
                            <th className="px-3 py-3 font-bold text-slate-700">환불 및 위약금 규정</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="px-3 py-3">계약일로부터 7일 이내</td>
                            <td className="px-3 py-3">계약금 100% 환불 (단, 예식일이 30일 이내 남았을 경우 제외)</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-3">계약일 7일 이후 ~ 예식 61일 전</td>
                            <td className="px-3 py-3">계약금 환불 불가 (계약금 전액 위약금 처리)</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-3">예식 60일 전 ~ 31일 전</td>
                            <td className="px-3 py-3">총 서비스 금액의 30% 위약금 발생</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-3">예식 30일 전 ~ 8일 전</td>
                            <td className="px-3 py-3">총 서비스 금액의 50% 위약금 발생</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-3">예식 7일 전 ~ 당일 (노쇼 포함)</td>
                            <td className="px-3 py-3">총 서비스 금액의 100% 위약금 발생</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제8조 (날짜 및 시간 변경)</h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>예식일 및 시간 변경은 예식 31일 전까지, 회사의 스케줄이 가능한 경우에 한해 1회 무상 변경이 가능합니다.</li>
                      <li>예식 30일 이내 변경 요청 또는 스케줄 불가로 인한 취소는 제7조의 취소 규정에 따라 위약금이 발생합니다.</li>
                    </ol>
                  </section>

                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제9조 (고객의 의무 및 사전 협조 사항)</h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>고객은 서비스 신청 시 정확한 정보를 제공해야 하며, 변경 사항 발생 시 즉시 회사에 통보해야 합니다. 정보 허위 기재로 인한 불이익은 고객에게 있습니다.</li>
                      <li>고객은 예식 1주일 전까지 최종 하객 수, 선택한 정산 방식(A/B/C), 지정 인수자 및 유튜브 라이브 링크 공유 대상자의 성함과 연락처를 회사에 제공해야 합니다.</li>
                      <li className="font-bold text-slate-900">[가장 중요] 고객은 예식 전 웨딩홀 측에 삼각대 설치 및 영상 촬영 허가를 직접 받아야 합니다. 웨딩홀의 규제로 인해 촬영이 불가능해질 경우, 이는 고객의 책임이며 서비스는 촬영을 제외하고 정상 진행됩니다. (촬영 미이행에 대한 환불은 불가합니다.)</li>
                      <li>고객은 예식 종료 후 지정 인수자가 현장에 상주하여 회사의 인계 작업에 차질이 없도록 해야 합니다.</li>
                    </ol>
                  </section>

                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제10조 (회사의 의무 및 분쟁 해결)</h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>회사는 본 약관이 정하는 바에 따라 성실하게 서비스를 제공합니다.</li>
                      <li>회사는 서비스 제공 중 회사의 명백한 과실로 인해 축의금 분실, 도난, 명부 오류 등이 발생한 경우, 촬영된 영상을 근거로 피해 금액을 산정하여 배상합니다. 단, 회사가 수령하기 전 또는 지정 인수자에게 인계한 후 발생한 사고에 대해서는 책임을 지지 않습니다.</li>
                      <li>회사의 귀책 사유(천재지변, 사고, 질병 등 부득이한 사정)로 인해 서비스 제공이 불가능할 경우, 납부하신 금액 전액(계약금+잔금) 환불 및 계약금의 배액을 보상합니다.</li>
                    </ol>
                  </section>

                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제11조 (영상 및 데이터 처리)</h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>회사는 서비스의 투명성과 증빙을 위해 예식 전체 과정을 촬영하며, 고객이 원할 경우 유튜브 라이브 스트리밍을 제공합니다.</li>
                      <li>촬영된 영상은 예식 후 고객에게 클라우드 링크 형태로 제공되며, 제공 후 회사는 해당 영상을 안전하게 파기합니다.</li>
                      <li>회사는 고객 및 하객의 개인정보(성명, 연락처 등)를 개인정보보호법에 따라 엄격히 관리하며, 서비스 제공 목적 이외의 용도로 사용하지 않습니다.</li>
                    </ol>
                  </section>

                  <section>
                    <h4 className="text-base font-bold text-slate-900 mb-3">제12조 (관할 법원)</h4>
                    <p>본 약관과 관련하여 회사와 고객 간에 발생한 분쟁에 관한 소송은 회사의 소재지를 관할하는 법원을 전용 관할 법원으로 합니다.</p>
                  </section>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* My Reservations Modal (User) */}
      <AnimatePresence>
        {showMyReservations && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6"
            onClick={() => setShowMyReservations(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-900">내 예약 조회</h3>
                <button onClick={() => setShowMyReservations(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                {!hasSearched || userReservations.length === 0 ? (
                  <div className="space-y-4">
                    <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">예약자 성함</label>
                        <input 
                          type="text"
                          value={lookupName}
                          onChange={(e) => setLookupName(e.target.value)}
                          placeholder="성함을 입력해주세요"
                          className="w-full bg-white border-none rounded-xl py-4 px-6 focus:ring-2 focus:ring-[#0a44b8] transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">연락처</label>
                        <input 
                          type="tel"
                          value={lookupPhone}
                          onChange={(e) => setLookupPhone(formatPhoneNumber(e.target.value))}
                          placeholder="010-0000-0000"
                          className="w-full bg-white border-none rounded-xl py-4 px-6 focus:ring-2 focus:ring-[#0a44b8] transition-all"
                        />
                      </div>
                      <button 
                        onClick={searchMyReservations}
                        disabled={isSearching}
                        className="w-full bg-[#0a44b8] text-white py-4 rounded-xl font-bold shadow-lg shadow-[#0a44b8]/20 hover:bg-[#0a3a9c] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSearching ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Search className="w-5 h-5" />
                        )}
                        예약 조회하기
                      </button>
                    </div>

                    {hasSearched && userReservations.length === 0 && (
                      <div className="text-center py-8 space-y-4">
                        <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                          <AlertCircle className="w-8 h-8 text-red-400" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-bold text-slate-600">입력하신 정보로 예약 내역을 찾을 수 없습니다.</p>
                          <p className="text-xs text-slate-400">성함과 연락처가 정확한지 다시 확인해주세요.</p>
                        </div>
                        <div className="pt-4">
                          <a 
                            href="https://pf.kakao.com/_xxxxxx" // Placeholder KakaoTalk link
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#FEE500] text-[#3c1e1e] font-bold rounded-xl hover:bg-[#FADA0A] transition-all text-sm"
                          >
                            <MessageCircle className="w-5 h-5" />
                            카카오톡 상담하기
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {userReservations.length > 0 && (
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-400">조회된 예약 {userReservations.length}건</p>
                      <button 
                        onClick={() => {
                          setHasSearched(false);
                          setUserReservations([]);
                          setLookupName('');
                          setLookupPhone('');
                        }}
                        className="text-xs font-bold text-[#0a44b8] hover:underline"
                      >
                        다시 조회하기
                      </button>
                    </div>
                    {userReservations.map(res => (
                      <div key={res.id} className="p-6 rounded-2xl border border-slate-100 bg-slate-50 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-slate-400 mb-1">{res.date} {res.time}</p>
                            <h4 className="font-black text-slate-900">{res.weddingHall}</h4>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                            res.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' :
                            res.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                            res.status === 'cancel_requested' ? 'bg-purple-100 text-purple-600' :
                            'bg-orange-100 text-orange-600'
                          }`}>
                            {res.status === 'confirmed' ? '예약 확정' : 
                             res.status === 'cancelled' ? '취소 완료' : 
                             res.status === 'cancel_requested' ? '취소 요청 중' : '예약 대기'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                          <p className="text-xs font-bold text-slate-500">{res.teamName}</p>
                          {res.status !== 'cancelled' && res.status !== 'rejected' && res.status !== 'cancel_requested' && (
                            <div className="flex items-center gap-2">
                              {confirmCancelId === res.id ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-red-500">정말 취소하시겠습니까?</span>
                                  <button 
                                    onClick={() => requestCancellation(res.id!)}
                                    className="px-2 py-0.5 bg-red-500 text-white rounded text-[10px] font-bold"
                                  >
                                    확인
                                  </button>
                                  <button 
                                    onClick={() => setConfirmCancelId(null)}
                                    className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                                  >
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setConfirmCancelId(res.id!)}
                                  className="text-xs font-bold text-red-500 hover:underline"
                                >
                                  취소 요청하기
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
