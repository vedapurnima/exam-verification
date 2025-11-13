import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type YesNo = 'Yes' | 'No';

type Student = {
  Name: string;
  MobileNo: string;
  District: string;
  State: string;
  Paid: YesNo;
  FeeAmount?: string;
  Attempted: YesNo;
  Approved: YesNo;
  RetakeAllowed: YesNo;
  LastApprovedAt?: string;
  CreatedAt?: string;
};

type NewStudentFormState = {
  Name: string;
  MobileNo: string;
  District: string;
  State: string;
  Paid: YesNo;
  FeeAmount: string;
};

type ToastTone = 'success' | 'error' | 'cooldown';

type ToastState = {
  message: string;
  tone: ToastTone;
};

type ViewState = 'search' | 'student' | 'new' | 'success' | 'analytics';
type SuccessType = 'approve' | 'retake';
type DashboardView = 'verification' | 'analytics';
type UserCategoryFilter = 'all' | 'new' | 'existing' | 'retaken';

// Use environment variable for production backend URL, or default to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001';
const SESSION_STORAGE_KEY = 'examVerificationSession';

const STATE_DISTRICT_MAP: Record<string, string[]> = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Chittoor', 'Kurnool'],
  'Arunachal Pradesh': ['Itanagar', 'Tawang', 'Ziro', 'Pasighat'],
  'Assam': ['Guwahati', 'Dibrugarh', 'Silchar', 'Tezpur'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga'],
  'Chhattisgarh': ['Raipur', 'Bilaspur', 'Durg', 'Korba'],
  'Goa': ['North Goa', 'South Goa'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'],
  'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Karnal', 'Hisar'],
  'Himachal Pradesh': ['Shimla', 'Mandi', 'Kangra', 'Solan'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Hazaribagh'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad'],
  'Manipur': ['Imphal', 'Churachandpur', 'Thoubal'],
  'Meghalaya': ['Shillong', 'Tura', 'Jowai'],
  'Mizoram': ['Aizawl', 'Lunglei', 'Champhai'],
  'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur'],
  'Punjab': ['Amritsar', 'Ludhiana', 'Jalandhar', 'Patiala'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  'Sikkim': ['Gangtok', 'Namchi', 'Gyalshing'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
  'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Noida'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Nainital', 'Rishikesh'],
  'West Bengal': ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur', 'Asansol'],
  'Andaman and Nicobar Islands': ['Port Blair', 'Havelock', 'Nicobar'],
  'Chandigarh': ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Silvassa'],
  'Delhi': ['New Delhi', 'Dwarka', 'Rohini', 'Karol Bagh'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Baramulla', 'Anantnag'],
  'Ladakh': ['Leh', 'Kargil'],
  'Lakshadweep': ['Kavaratti', 'Agatti'],
  'Puducherry': ['Puducherry', 'Karaikal', 'Mahe'],
};

const STATES = Object.keys(STATE_DISTRICT_MAP).sort();

const createDefaultFormValues = (): NewStudentFormState => ({
  Name: '',
  MobileNo: '',
  District: '',
  State: '',
  Paid: 'Yes', // Always Yes for new students
  FeeAmount: '', // Amount paid by student
});

const labels: Record<keyof Student, string> = {
  Name: 'Name',
  MobileNo: 'Mobile Number',
  District: 'District',
  State: 'State',
  Paid: 'Fee Paid',
  FeeAmount: 'Amount Paid',
  Attempted: 'Test Attempted',
  Approved: 'Approved',
  RetakeAllowed: 'Retake Allowed',
  LastApprovedAt: 'Last Approved At',
  CreatedAt: 'Created At',
};

const toastMessages = {
  approve: '✅ Approved for test.',
  retake: '🔁 Retake test allowed successfully.',
  newStudent: '✅ Student added successfully.',
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMobile, setAuthMobile] = useState<string | null>(null);
  const [loginStep, setLoginStep] = useState<'mobile' | 'otp'>('mobile');
  const [loginMobileInput, setLoginMobileInput] = useState('');
  const [loginOtpInput, setLoginOtpInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [view, setView] = useState<ViewState>('search');
  const [mobileQuery, setMobileQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newStudentForm, setNewStudentForm] = useState<NewStudentFormState>(createDefaultFormValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [successType, setSuccessType] = useState<SuccessType | null>(null);
  const [dashboardView, setDashboardView] = useState<DashboardView>('verification');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<UserCategoryFilter>('all');
  const [nameSearch, setNameSearch] = useState('');

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!storedSession) {
      return;
    }
    try {
      const parsed = JSON.parse(storedSession) as { loggedIn?: boolean; mobile?: string };
      if (parsed?.loggedIn) {
        setIsAuthenticated(true);
        setAuthMobile(parsed.mobile ?? null);
      }
    } catch (error) {
      console.error('Failed to parse session. Clearing stored session.', error);
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!showProfileMenu) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const showToast = (message: string, tone: ToastTone = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  };

  const getToastContainerClass = (tone: ToastTone) => {
    if (tone === 'cooldown') {
      return 'fixed inset-x-0 bottom-12 z-50 flex justify-center px-4';
    }
    return 'fixed inset-x-4 top-6 z-50 mx-auto flex max-w-sm justify-center sm:inset-x-auto sm:right-6 sm:mx-0';
  };

  const getToastBodyClass = (tone: ToastTone) => {
    if (tone === 'cooldown') {
      return 'animate-fade-in w-full max-w-xs rounded-2xl border border-primaryRed/70 bg-[#FFF3E1] px-4 py-3 text-sm font-semibold text-primaryRed shadow-lg transition-opacity duration-300';
    }
    return `animate-fade-in w-full rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur ${
      tone === 'success'
        ? 'border-successGreen/40 bg-white/90 text-primaryText'
        : 'border-primaryRedHover/40 bg-white/90 text-primaryRed'
    }`;
  };

  const resetToSearch = () => {
    setView('search');
    setStudent(null);
    setActionLoading(null);
    setSuccessType(null);
    setMobileQuery('');
    setShowTooltip(false);
  };

  const handleSendOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMobile = loginMobileInput.trim();

    if (!/^\d{10}$/.test(trimmedMobile)) {
      setLoginError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoginError('');
    setLoginStep('otp');
    setLoginOtpInput('');
    showToast('OTP sent. Use 1234 to login.', 'success');
  };

  const handleVerifyOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loginOtpInput.trim() !== '1234') {
      setLoginError('Invalid OTP. Please try again.');
      return;
    }

    const trimmedMobile = loginMobileInput.trim();
    if (!/^\d{10}$/.test(trimmedMobile)) {
      setLoginError('Please enter a valid 10-digit mobile number.');
      setLoginStep('mobile');
      return;
    }
    const sessionDetails = { loggedIn: true, mobile: trimmedMobile };

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionDetails));
    }

    setAuthMobile(trimmedMobile);
    setIsAuthenticated(true);
    setLoginError('');
    setLoginStep('mobile');
    setLoginMobileInput('');
    setLoginOtpInput('');
    setShowProfileMenu(false);
    setIsSearching(false);
    resetToSearch();
    setNewStudentForm(createDefaultFormValues());
    showToast('Login successful.', 'success');
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    setShowProfileMenu(false);
    setIsAuthenticated(false);
    setAuthMobile(null);
    setLoginStep('mobile');
    setLoginMobileInput('');
    setLoginOtpInput('');
    setLoginError('');
    resetToSearch();
    setNewStudentForm(createDefaultFormValues());
    setIsSearching(false);
    showToast('✅ Logged out successfully.');
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mobileQuery.trim()) {
      showToast('Please enter a mobile number to search.', 'error');
      return;
    }

    setIsSearching(true);
    setView('search');
    setStudent(null);
    setSuccessType(null);

    try {
      const response = await fetch(`${API_BASE_URL}/student?mobileNo=${encodeURIComponent(mobileQuery.trim())}`);

      if (response.ok) {
        const data = (await response.json()) as { student: Student };
        setStudent(data.student);
        setView('student');
        setNewStudentForm(createDefaultFormValues());
      } else if (response.status === 404) {
        const data = (await response.json()) as { message?: string; found?: boolean; error?: string };
        // Only show new student form if it's a genuine "not found", not a sheet error
        if (data.found === false || data.message?.includes('Student not found')) {
          setView('new');
          setNewStudentForm({
            ...createDefaultFormValues(),
            MobileNo: mobileQuery.trim(),
          });
        } else {
          // Sheet not found error
          showToast(data.message || 'Google Sheet not found. Please check configuration.', 'error');
        }
      } else {
        // Parse error response from backend
        let errorMessage = 'Could not connect to Google Sheets. Please check your connection and credentials.';
        try {
          const errorData = (await response.json()) as { message?: string; details?: string; error?: string };
          errorMessage = errorData.message || errorData.details || errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use default message
        }
        showToast(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Network error:', error);
      showToast('Unable to reach the server. Check your backend connection.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAction = async (updates: Partial<Student>, toastMessage: string, actionId: string) => {
    if (!student) {
      return;
    }

    setActionLoading(actionId);

    try {
      const response = await fetch(`${API_BASE_URL}/student/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mobileNo: student.MobileNo,
          updates,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Could not update student. Please check your connection and credentials.';
        try {
          const errorData = (await response.json()) as { message?: string; details?: string; error?: string };
          errorMessage = errorData.message || errorData.details || errorData.error || errorMessage;

          if (
            response.status === 409 &&
            errorMessage.toLowerCase().includes('retake not allowed within 12 hours')
          ) {
            showToast('Recently Attempted', 'cooldown');
            return;
          }
        } catch {
          // Ignore JSON parse errors and use default message
        }

        showToast(errorMessage, 'error');
        return;
      }

      const data = (await response.json()) as { student: Student };
      setStudent(data.student);
      showToast(toastMessage);
      
      // Determine success type and show success screen
      const isRetake = actionId === 'retake';
      setSuccessType(isRetake ? 'retake' : 'approve');
      setMobileQuery(''); // Clear mobile query for fresh search
      setView('success');
    } catch (error) {
      console.error('Network error:', error);
      showToast('Unable to reach the server. Check your backend connection.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPayload = {
      Name: newStudentForm.Name.trim(),
      MobileNo: newStudentForm.MobileNo.trim(),
      District: newStudentForm.District.trim(),
      State: newStudentForm.State.trim(),
      Paid: 'Yes', // Always Yes for new students
      FeeAmount: newStudentForm.FeeAmount.trim(),
    };

    if (
      !trimmedPayload.Name ||
      !trimmedPayload.MobileNo ||
      !trimmedPayload.District ||
      !trimmedPayload.State ||
      !trimmedPayload.FeeAmount
    ) {
      showToast('All fields are required to add a new student.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trimmedPayload),
      });

      if (!response.ok) {
        // Parse error response from backend
        let errorMessage = 'Could not add student. Please check your connection and credentials.';
        try {
          const errorData = (await response.json()) as { message?: string; details?: string; error?: string };
          errorMessage = errorData.message || errorData.details || errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use default message
        }
        showToast(errorMessage, 'error');
        return;
      }

      const data = (await response.json()) as { student: Student };
      setStudent(data.student);
      showToast(toastMessages.newStudent);
      setNewStudentForm(createDefaultFormValues());
      
      // Show success screen for new student
      setSuccessType('approve');
      setMobileQuery(''); // Clear mobile query for fresh search
      setView('success');
    } catch (error) {
      console.error('Network error:', error);
      showToast('Unable to reach the server. Check your backend connection.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionButtons = student
    ? [
        {
          id: 'approveUnpaid',
          shouldRender: student.Paid === 'No' && student.Attempted === 'No',
          label: 'Approve for Test',
          updates: { Paid: 'Yes', Attempted: 'Yes' } satisfies Partial<Student>,
          toast: toastMessages.approve,
        },
        {
          id: 'approvePaid',
          shouldRender: student.Paid === 'Yes' && student.Attempted === 'No',
          label: 'Approve for Test',
          updates: { Attempted: 'Yes' } satisfies Partial<Student>,
          toast: toastMessages.approve,
        },
        {
          id: 'retake',
          shouldRender: student.Attempted === 'Yes',
          label: 'Retake Test',
          updates: { RetakeAllowed: 'Yes' } satisfies Partial<Student>,
          toast: toastMessages.retake,
        },
      ].filter((button) => button.shouldRender)
    : [];

  const availableDistricts = newStudentForm.State ? STATE_DISTRICT_MAP[newStudentForm.State] || [] : [];

  const handleStateChange = (state: string) => {
    setNewStudentForm((prev) => ({
      ...prev,
      State: state,
      District: '', // Reset district when state changes
    }));
  };

  const displayFields = ['Name', 'MobileNo', 'State', 'District', 'Paid', 'Attempted'] as Array<keyof Student>;

  const getStatusDot = (field: 'Paid' | 'Attempted', value: YesNo) => {
    if (field === 'Paid') {
      return (
        <span
          className={`inline-block w-3 h-3 rounded-full ${
            value === 'Yes' ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      );
    } else if (field === 'Attempted') {
      return (
        <span
          className={`inline-block w-3 h-3 rounded-full ${
            value === 'Yes' ? 'bg-blue-500' : 'bg-gray-400'
          }`}
        />
      );
    }
    return null;
  };

  // Analytics helper functions
  const maskMobileNumber = (mobile: string): string => {
    if (!mobile || mobile.length < 4) return mobile;
    const firstTwo = mobile.substring(0, 2);
    const lastTwo = mobile.substring(mobile.length - 2);
    return `${firstTwo}******${lastTwo}`;
  };

  const fetchAllStudents = async () => {
    setIsLoadingAnalytics(true);
    try {
      const response = await fetch(`${API_BASE_URL}/students`);
      if (!response.ok) {
        showToast('Failed to fetch analytics data.', 'error');
        return;
      }
      const data = (await response.json()) as { students: Student[] };
      setAllStudents(data.students);
    } catch (error) {
      console.error('Error fetching students:', error);
      showToast('Unable to reach the server. Check your backend connection.', 'error');
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const calculateStats = (students: Student[]) => {
    // Students passed to this function are already filtered to Attempted = Yes
    // and filtered by date range on LastApprovedAt (if date range is selected)
    const total = students.length;
    
    // Classify based on CreatedAt and RetakeAllowed
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;
    
    let newUsers = 0;
    let existing = 0;
    let retaken = 0;
    
    students.forEach((student) => {
      const createdAt = student.CreatedAt ? new Date(student.CreatedAt) : null;
      
      if (!createdAt) {
        // If no CreatedAt, can't classify - skip
        return;
      }
      
      if (fromDate && toDate) {
        // Both dates provided
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        
        if (createdAt >= fromDate && createdAt <= to) {
          // Created within date range = New User
          newUsers++;
        } else if (createdAt < fromDate) {
          // Created before date range
          if (student.RetakeAllowed === 'Yes') {
            retaken++;
          } else {
            existing++;
          }
        }
      } else if (fromDate) {
        // Only fromDate provided
        if (createdAt < fromDate) {
          // Created before date range
          if (student.RetakeAllowed === 'Yes') {
            retaken++;
          } else {
            existing++;
          }
        } else {
          // Created on or after fromDate = New User
          newUsers++;
        }
      } else {
        // No date range - classify all attempted users
        if (student.RetakeAllowed === 'Yes') {
          retaken++;
        } else {
          // Without date range, we can't distinguish new vs existing
          // So we'll count them as existing
          existing++;
        }
      }
    });
    
    return { total, newUsers, existing, retaken };
  };

  const inDateRange = (dateStr: string | undefined, fromDate: string, toDate: string): boolean => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    
    if (fromDate && date < new Date(fromDate)) return false;
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (date > to) return false;
    }
    return true;
  };

  const filterStudents = (students: Student[]): Student[] => {
    // Step 1: Only include users with Attempted = Yes
    let filtered = students.filter((student) => student.Attempted === 'Yes');

    // Step 2: Filter by date range on LastApprovedAt (if date range is selected)
    if (dateFrom || dateTo) {
      filtered = filtered.filter((student) => {
        return inDateRange(student.LastApprovedAt, dateFrom, dateTo);
      });
    }

    // Step 3: Filter by category using CreatedAt logic
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((student) => {
        const createdAt = student.CreatedAt ? new Date(student.CreatedAt) : null;

        if (categoryFilter === 'new') {
          // New Users: CreatedAt within date range AND LastApprovedAt within date range
          if (!createdAt) return false;
          if (dateFrom && dateTo) {
            const from = new Date(dateFrom);
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            return createdAt >= from && createdAt <= to && inDateRange(student.LastApprovedAt, dateFrom, dateTo);
          }
          // If no date range, can't determine "new" - return false
          return false;
        }
        
        if (categoryFilter === 'existing') {
          // Existing Users: CreatedAt before date range AND LastApprovedAt within date range
          if (!createdAt || !dateFrom) return false;
          const from = new Date(dateFrom);
          return createdAt < from && inDateRange(student.LastApprovedAt, dateFrom, dateTo || dateFrom);
        }
        
        if (categoryFilter === 'retaken') {
          // Retaken Users: CreatedAt before date range AND RetakeAllowed = Yes AND LastApprovedAt within date range
          if (!createdAt || !dateFrom) return false;
          const from = new Date(dateFrom);
          return (
            createdAt < from &&
            student.RetakeAllowed === 'Yes' &&
            inDateRange(student.LastApprovedAt, dateFrom, dateTo || dateFrom)
          );
        }
        
        return true;
      });
    }

    // Step 4: Filter by name search (case-insensitive, partial match)
    if (nameSearch.trim()) {
      const searchTerm = nameSearch.trim().toLowerCase();
      filtered = filtered.filter((student) => {
        const studentName = (student.Name || '').toLowerCase();
        return studentName.includes(searchTerm);
      });
    }

    return filtered;
  };

  useEffect(() => {
    if (dashboardView === 'analytics' && isAuthenticated) {
      fetchAllStudents();
    }
  }, [dashboardView, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-softBackground px-4 py-10">
        <div className="fixed top-4 left-4 z-10">
          <img
            src="/nxtwave-logo.png"
            alt="NxtWave Institute of Advanced Technologies"
            className="h-14 w-auto object-contain max-w-[240px]"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))' }}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </div>

        <section className="w-full max-w-md rounded-3xl border border-borderGray bg-cardBg p-8 shadow-card">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-primaryRed">Secure Access</p>
            <h1 className="mt-3 text-3xl font-semibold text-primaryText">Login to Exam Verification</h1>
            <p className="mt-2 text-sm text-secondaryText">
              Authenticate with your registered number to manage invigilation duties.
            </p>
          </div>

          {loginStep === 'mobile' ? (
            <form className="mt-8 space-y-5" onSubmit={handleSendOtp}>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-secondaryText">Enter Mobile No.</span>
                <input
                  value={loginMobileInput}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, '').slice(0, 10);
                    setLoginMobileInput(value);
                    setLoginError('');
                  }}
                  placeholder="e.g., 9876543210"
                  className="w-full rounded-2xl border border-borderGray bg-beigePanel px-4 py-3 text-base text-primaryText outline-none transition focus:border-primaryRed focus:bg-white focus:ring-2 focus:ring-primaryRed/30"
                  inputMode="numeric"
                  maxLength={10}
                  autoFocus
                />
              </label>

              {loginError && <p className="text-sm font-medium text-primaryRed">{loginError}</p>}

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primaryRed px-6 py-3 text-lg font-semibold text-white shadow-md transition hover:bg-primaryRedHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaryRed"
              >
                Send OTP
              </button>
            </form>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleVerifyOtp}>
              <div className="rounded-2xl border border-borderGray bg-beigePanel px-4 py-3 text-sm text-primaryText">
                OTP sent to <span className="font-semibold">{loginMobileInput}</span>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-secondaryText">Enter OTP</span>
                <input
                  value={loginOtpInput}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, '').slice(0, 4);
                    setLoginOtpInput(value);
                    setLoginError('');
                  }}
                  placeholder="1234"
                  className="w-full rounded-2xl border border-borderGray bg-beigePanel px-4 py-3 text-base text-primaryText outline-none transition focus:border-primaryRed focus:bg-white focus:ring-2 focus:ring-primaryRed/30"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                />
              </label>

              <p className="text-xs italic text-secondaryText">Use demo OTP: 1234 for testing.</p>

              {loginError && <p className="text-sm font-medium text-primaryRed">{loginError}</p>}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setLoginStep('mobile');
                    setLoginOtpInput('');
                    setLoginError('');
                  }}
                  className="rounded-full border border-borderGray bg-white px-6 py-3 text-sm font-semibold text-secondaryText transition hover:border-primaryRed hover:text-primaryRed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaryRed"
                >
                  Edit Mobile
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-primaryRed px-6 py-3 text-lg font-semibold text-white shadow-md transition hover:bg-primaryRedHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaryRed"
                >
                  Verify OTP
                </button>
              </div>
            </form>
          )}
        </section>

        {toast && (
          <div className={getToastContainerClass(toast.tone)}>
            <div className={getToastBodyClass(toast.tone)}>{toast.message}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-softBackground flex items-center justify-center py-6 relative">
      {/* Logo in top left corner - Fixed position */}
      {isAuthenticated && (
        <div className="fixed top-4 left-4 z-10">
          <img
            src="/nxtwave-logo.png"
            alt="NxtWave Institute of Advanced Technologies"
            className="h-14 w-auto object-contain max-w-[280px]"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
            }}
            onError={(e) => {
              // Fallback if image not found
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Profile Icon and Analytics Button - Fixed top right, visible on all pages except login */}
      {isAuthenticated && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
          {/* Analytics Dashboard Button */}
          <button
            type="button"
            onClick={() => {
              if (dashboardView === 'analytics') {
                setDashboardView('verification');
                setView('search');
              } else {
                setDashboardView('analytics');
                fetchAllStudents();
              }
            }}
            className="rounded-full bg-primaryRed px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-primaryRedHover"
          >
            📊 {dashboardView === 'analytics' ? 'Verification Dashboard' : 'Analytics Dashboard'}
          </button>

          {/* Profile Icon */}
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowProfileMenu((previous) => !previous)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-borderGray bg-beigePanel text-primaryRed shadow-md transition-all duration-200 hover:scale-105 hover:text-primaryRedHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaryRed sm:h-10 sm:w-10"
              aria-label="Open profile menu"
            >
              <svg
                className="h-4 w-4 sm:h-5 sm:w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-12 w-[120px] rounded-lg border border-borderGray bg-beigePanel p-2 shadow-md sm:w-40">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-primaryRed transition-colors hover:bg-softBackground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaryRed"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                    />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl px-4">
        <header className="text-center mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-primaryRed">Exam Verification</p>
          <h1 className="mt-2 text-3xl font-semibold text-primaryText md:text-4xl">Invigilator Console</h1>
          <p className="mt-2 max-w-xl text-sm text-secondaryText mx-auto">
            Verify student eligibility, capture approvals, and manage retakes instantly before the offline test
            session begins.
          </p>
        </header>

        {dashboardView === 'analytics' ? (
          <main className="w-full max-w-7xl mx-auto">
            {isLoadingAnalytics ? (
              <div className="text-center py-12">
                <p className="text-secondaryText">Loading analytics data...</p>
              </div>
            ) : (
              <>
                {/* Summary Boxes */}
                {(() => {
                  const filteredStudents = filterStudents(allStudents);
                  const stats = calculateStats(filteredStudents);
                  return (
                    <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 md:grid-cols-4">
                      <div className="rounded-xl border border-borderGray bg-beigePanel p-4 shadow-md">
                        <p className="text-3xl font-bold text-primaryRed">{stats.total}</p>
                        <p className="text-sm font-medium text-primaryText mt-1">Total Users (Attempted)</p>
                      </div>
                      <div className="rounded-xl border border-borderGray bg-beigePanel p-4 shadow-md">
                        <p className="text-3xl font-bold text-primaryRed">{stats.newUsers}</p>
                        <p className="text-sm font-medium text-primaryText mt-1">New Users</p>
                      </div>
                      <div className="rounded-xl border border-borderGray bg-beigePanel p-4 shadow-md">
                        <p className="text-3xl font-bold text-primaryRed">{stats.existing}</p>
                        <p className="text-sm font-medium text-primaryText mt-1">Existing Users</p>
                      </div>
                      <div className="rounded-xl border border-borderGray bg-beigePanel p-4 shadow-md">
                        <p className="text-3xl font-bold text-primaryRed">{stats.retaken}</p>
                        <p className="text-sm font-medium text-primaryText mt-1">Retaken Users</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Unified Filters and Data Section */}
                <section className="mt-6 rounded-2xl border border-borderGray bg-beigePanel p-6 shadow-md">
                  {/* Filters Section */}
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-primaryText mb-4">Filters</h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 items-end">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-secondaryText">Date From</label>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="w-full rounded-2xl border border-borderGray bg-cardBg px-4 py-2 text-base text-primaryText outline-none transition focus:border-primaryRed focus:bg-white focus:ring-2 focus:ring-primaryRed/30"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-secondaryText">Date To</label>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="w-full rounded-2xl border border-borderGray bg-cardBg px-4 py-2 text-base text-primaryText outline-none transition focus:border-primaryRed focus:bg-white focus:ring-2 focus:ring-primaryRed/30"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-secondaryText">Category</label>
                        <select
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value as UserCategoryFilter)}
                          className="w-full rounded-2xl border border-borderGray bg-cardBg px-4 py-2 text-base text-primaryText outline-none transition focus:border-primaryRed focus:bg-white focus:ring-2 focus:ring-primaryRed/30"
                        >
                          <option value="all">All</option>
                          <option value="new">New Users</option>
                          <option value="existing">Existing Users</option>
                          <option value="retaken">Retaken Users</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Search by Name */}
                    <div className="mt-4">
                      <div className="relative max-w-md">
                        <input
                          type="text"
                          value={nameSearch}
                          onChange={(e) => setNameSearch(e.target.value)}
                          placeholder="Search by Name"
                          className="w-full rounded-full border border-borderGray bg-cardBg px-4 py-2 pr-10 text-base text-primaryText placeholder-gray-500 shadow-sm outline-none transition focus:border-primaryRed focus:ring-2 focus:ring-primaryRed/30"
                        />
                        {nameSearch && (
                          <button
                            type="button"
                            onClick={() => setNameSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-primaryRed hover:text-primaryRedHover transition-colors"
                            aria-label="Clear search"
                          >
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter Data Button */}
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          // Trigger re-render by updating state (filters are already reactive)
                          // This button provides visual confirmation of filter application
                        }}
                        className="rounded-lg bg-primaryRed px-4 py-2 text-sm font-medium text-white transition hover:bg-primaryRedHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaryRed"
                      >
                        Filter Data
                      </button>
                    </div>
                  </div>

                  {/* Count Summary */}
                  {(() => {
                    const filteredStudents = filterStudents(allStudents);
                    const filteredCount = filteredStudents.length;
                    const hasFilters = dateFrom || dateTo || categoryFilter !== 'all' || nameSearch.trim();
                    
                    return (
                      <div className="mb-4">
                        <span className="inline-flex items-center rounded-full bg-cardBg px-3 py-1 text-sm font-medium text-primaryRed">
                          🔢 Showing {filteredCount} {filteredCount === 1 ? 'student' : 'students'} {hasFilters ? '(Filtered Results)' : '(All Records)'}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Data Table */}
                  <div>
                    <h2 className="text-xl font-semibold text-primaryText mb-4">Filtered Data</h2>
                    {filterStudents(allStudents).length === 0 ? (
                      <p className="text-center py-8 text-secondaryText">No students found matching the filters.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-borderGray">
                              <th className="px-4 py-3 text-left text-sm font-semibold text-primaryText">Name</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-primaryText">Mobile No</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-primaryText">Amount Paid</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-primaryText">Last Approved At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filterStudents(allStudents).map((student, idx) => (
                              <tr
                                key={`${student.MobileNo}-${idx}`}
                                className={`border-b border-borderGray transition-colors hover:bg-cardBg/60 ${
                                  idx % 2 === 0 ? 'bg-cardBg/40' : ''
                                }`}
                              >
                                <td className="px-4 py-3 text-sm text-primaryText">{student.Name || '—'}</td>
                                <td className="px-4 py-3 text-sm text-primaryText">
                                  {maskMobileNumber(student.MobileNo || '')}
                                </td>
                                <td className="px-4 py-3 text-sm text-primaryText">
                                  {student.FeeAmount || '—'}
                                </td>
                                <td className="px-4 py-3 text-sm text-primaryText">
                                  {student.LastApprovedAt
                                    ? new Date(student.LastApprovedAt).toLocaleString('en-IN', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </main>
        ) : (
          <main className="w-full max-w-xl mx-auto">
          {view === 'search' && (
            <section className="rounded-3xl border border-borderGray bg-cardBg p-6 shadow-card">
              <h2 className="text-xl font-semibold text-primaryText">Find a Student</h2>
              <p className="mt-2 text-sm text-secondaryText">
                Enter the registered mobile number to pull live details from the exam sheet.
              </p>
              <form className="mt-5 space-y-4" onSubmit={handleSearch}>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-secondaryText">Enter Student Mobile Number</span>
                  <input
                    value={mobileQuery}
                    onChange={(event) => setMobileQuery(event.target.value)}
                    placeholder="e.g., 9876543210"
                    className="w-full rounded-2xl border border-borderGray bg-beigePanel px-4 py-3 text-base text-primaryText outline-none transition focus:border-primaryRed focus:bg-white focus:ring-2 focus:ring-primaryRed/30"
                    inputMode="numeric"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primaryRed px-6 py-3 text-lg font-semibold text-white shadow-inner transition hover:bg-primaryRedHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaryRed disabled:cursor-not-allowed disabled:bg-primaryRed/70"
                >
                  {isSearching ? 'Searching...' : 'Search Student'}
                </button>
              </form>
            </section>
          )}

          {view === 'student' && student && (
            <section className="rounded-3xl border border-borderGray bg-cardBg p-6 shadow-card relative">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondaryText">Student</p>
                    <button
                      type="button"
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                      onClick={() => setShowTooltip(!showTooltip)}
                      className="text-secondaryText hover:text-primaryRed transition-colors"
                      aria-label="Show legend"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </button>
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold text-primaryText">{student.Name}</h2>
                  <p className="text-sm text-secondaryText">Mobile: {student.MobileNo}</p>
                </div>
                <button
                  type="button"
                  onClick={resetToSearch}
                  className="self-start rounded-xl border border-borderGray px-4 py-2 text-sm font-medium text-secondaryText transition hover:border-primaryRed hover:text-primaryRed"
                >
                  Search another
                </button>
              </div>

              {showTooltip && (
                <div className="absolute top-16 right-6 z-50 rounded-2xl border border-borderGray bg-beigePanel px-4 py-3 shadow-lg transition-opacity duration-200 ease-in-out">
                  <p className="text-sm font-semibold text-primaryText mb-2">Legend:</p>
                  <div className="space-y-1 text-sm text-primaryText">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                      <span>Fee Paid (Yes)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                      <span>Test Attempted (Yes)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-gray-400" />
                      <span>Pending / No</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {displayFields.map((key) => {
                  // Special handling for Paid field - only show "Yes" if FeeAmount exists
                  if (key === 'Paid') {
                    const hasFeeAmount = student.FeeAmount && student.FeeAmount.trim() !== '';
                    const paidValue = hasFeeAmount ? 'Yes' : (student[key] || '—');
                    
                    return (
                      <div key={key} className="rounded-2xl border border-borderGray bg-beigePanel px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-secondaryText inline-flex items-center gap-2">
                              {labels[key]}
                              {hasFeeAmount && getStatusDot(key, 'Yes' as YesNo)}
                            </p>
                            <p className="mt-1 text-base font-medium text-primaryText">{paidValue}</p>
                          </div>
                          {hasFeeAmount && (
                            <div className="ml-4 text-right">
                              <p className="text-xs font-semibold uppercase tracking-wide text-secondaryText">Amount</p>
                              <p className="mt-1 text-base font-semibold text-primaryRed">₹{student.FeeAmount}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  
                  // Default rendering for other fields
                  return (
                    <div key={key} className="rounded-2xl border border-borderGray bg-beigePanel px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-secondaryText inline-flex items-center gap-2">
                        {labels[key]}
                        {(key === 'Paid' || key === 'Attempted') && getStatusDot(key, student[key] as YesNo)}
                      </p>
                      <p className="mt-1 text-base font-medium text-primaryText">{student[key] || '—'}</p>
                    </div>
                  );
                })}
              </div>

              {actionButtons.length > 0 && (
                <div className="mt-5 flex flex-col gap-3">
                  {actionButtons.map((action) => {
                    const loadingMatch = actionLoading === action.id;
            if (action.id === 'retake') {
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleAction(action.updates, action.toast, action.id)}
                  disabled={Boolean(actionLoading)}
                  className="self-end text-sm font-medium text-primaryRed transition hover:text-primaryRedHover hover:underline focus-visible:outline-none disabled:cursor-not-allowed disabled:text-primaryRed/50"
                >
                  {loadingMatch ? 'Updating…' : 'Retake Test →'}
                </button>
              );
            }

            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleAction(action.updates, action.toast, action.id)}
                disabled={Boolean(actionLoading)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primaryRed px-6 py-2 text-lg font-semibold text-white shadow-md transition hover:bg-primaryRedHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaryRed disabled:cursor-not-allowed disabled:bg-primaryRed/70"
              >
                {loadingMatch ? 'Updating…' : action.label}
              </button>
            );
                  })}
                </div>
              )}
            </section>
          )}

          {view === 'new' && (
            <section className="rounded-3xl border border-borderGray bg-cardBg p-6 shadow-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondaryText">New Student</p>
                  <h2 className="mt-1 text-2xl font-semibold text-primaryText">Add Student</h2>
                  <p className="text-sm text-secondaryText">
                    Mobile: {newStudentForm.MobileNo || 'Not provided'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetToSearch}
                  className="self-start rounded-xl border border-borderGray px-4 py-2 text-sm font-medium text-secondaryText transition hover:border-primaryRed hover:text-primaryRed"
                >
                  Back
                </button>
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleAddStudent}>
                {/* Name */}
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-secondaryText">Name</span>
                  <input
                    value={newStudentForm.Name}
                    onChange={(event) =>
                      setNewStudentForm((prev) => ({
                        ...prev,
                        Name: event.target.value,
                      }))
                    }
                    placeholder="Enter full name"
                    className="w-full rounded-2xl border border-borderGray bg-beigePanel px-4 py-3 text-base text-primaryText outline-none transition focus:border-primaryRed focus:bg-white focus:ring-2 focus:ring-primaryRed/30"
                    inputMode="text"
                  />
                </label>

                {/* State Dropdown */}
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-secondaryText">State</span>
                  <select
                    value={newStudentForm.State}
                    onChange={(event) => handleStateChange(event.target.value)}
                    className="w-full rounded-2xl border border-borderGray bg-beigePanel px-4 py-3 text-base text-primaryText outline-none transition focus:border-primaryRed focus:bg-white focus:ring-2 focus:ring-primaryRed/30"
                  >
                    <option value="">Select State</option>
                    {STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>

                {/* District Dropdown */}
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-secondaryText">District</span>
                  <select
                    value={newStudentForm.District}
                    onChange={(event) =>
                      setNewStudentForm((prev) => ({
                        ...prev,
                        District: event.target.value,
                      }))
                    }
                    disabled={!newStudentForm.State}
                    className="w-full rounded-2xl border border-borderGray bg-beigePanel px-4 py-3 text-base text-primaryText outline-none transition focus:border-primaryRed focus:bg-white focus:ring-2 focus:ring-primaryRed/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {newStudentForm.State ? 'Select District' : 'Select a state first'}
                    </option>
                    {availableDistricts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Amount Paid */}
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-secondaryText">Amount Paid</span>
                  <input
                    type="number"
                    value={newStudentForm.FeeAmount}
                    onChange={(event) =>
                      setNewStudentForm((prev) => ({
                        ...prev,
                        FeeAmount: event.target.value,
                      }))
                    }
                    placeholder="Enter fee amount"
                    required
                    min="0"
                    step="0.01"
                    className="w-full rounded-2xl border border-borderGray bg-beigePanel px-4 py-3 text-base text-primaryText outline-none transition focus:border-primaryRed focus:bg-white focus:ring-2 focus:ring-primaryRed/30"
                    inputMode="decimal"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-primaryRed px-6 py-2 text-lg font-semibold text-white shadow-md transition hover:bg-primaryRedHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaryRed disabled:cursor-not-allowed disabled:bg-primaryRed/70"
                >
                  {isSubmitting ? 'Adding Student…' : 'Add Student & Approve'}
                </button>
              </form>
            </section>
          )}

          {view === 'success' && successType && (
            <div className="flex flex-col items-center justify-center text-center animate-fade-in py-8">
              {/* Large Green Tick Icon */}
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
                <svg
                  className="h-12 w-12"
                  style={{ color: '#22C55E' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              {/* Congratulations Heading */}
              <h2 className="mb-3 text-3xl font-bold text-primaryRed">Congratulations!</h2>

              {/* Success Message */}
              <p className="text-lg text-secondaryText mb-8">
                {successType === 'approve'
                  ? 'Student successfully approved for the test.'
                  : 'Student successfully scheduled for retake.'}
              </p>

              {/* Search Bar Below Success Message */}
              <div className="mt-6 w-full max-w-md">
                <form onSubmit={handleSearch} className="space-y-4">
                  <label className="flex flex-col gap-2">
                    <input
                      value={mobileQuery}
                      onChange={(event) => setMobileQuery(event.target.value)}
                      placeholder="Enter Mobile No."
                      className="w-full rounded-full border border-borderGray bg-beigePanel px-4 py-3 text-base text-primaryText outline-none transition focus:border-primaryRed focus:ring-2 focus:ring-primaryRed/30"
                      inputMode="numeric"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-primaryRed px-6 py-2 text-lg font-semibold text-white shadow-md transition hover:bg-primaryRedHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaryRed disabled:cursor-not-allowed disabled:bg-primaryRed/70"
                  >
                    {isSearching ? 'Searching...' : 'Search Student'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
        )}
      </div>

      {toast && (
        <div className={getToastContainerClass(toast.tone)}>
          <div className={getToastBodyClass(toast.tone)}>{toast.message}</div>
        </div>
      )}
    </div>
  );
}


