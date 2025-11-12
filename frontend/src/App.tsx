import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type YesNo = 'Yes' | 'No';

type Student = {
  Name: string;
  MobileNo: string;
  District: string;
  State: string;
  Paid: YesNo;
  Attempted: YesNo;
  Approved: YesNo;
  RetakeAllowed: YesNo;
};

type NewStudentFormState = {
  Name: string;
  MobileNo: string;
  District: string;
  State: string;
  Paid: YesNo;
};

type ToastTone = 'success' | 'error';

type ToastState = {
  message: string;
  tone: ToastTone;
};

type ViewState = 'search' | 'student' | 'new';

// Use environment variable for production backend URL, or default to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001';

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
});

const labels: Record<keyof Student, string> = {
  Name: 'Name',
  MobileNo: 'Mobile Number',
  District: 'District',
  State: 'State',
  Paid: 'Fee Paid',
  Attempted: 'Test Attempted',
  Approved: 'Approved',
  RetakeAllowed: 'Retake Allowed',
};

const toastMessages = {
  approve: '✅ Approved for test.',
  retake: '🔁 Retake test allowed successfully.',
  newStudent: '✅ Student added successfully.',
};

export default function App() {
  const [view, setView] = useState<ViewState>('search');
  const [mobileQuery, setMobileQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newStudentForm, setNewStudentForm] = useState<NewStudentFormState>(createDefaultFormValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string, tone: ToastTone = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  };

  const resetToSearch = () => {
    setView('search');
    setStudent(null);
    setActionLoading(null);
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
        // Parse error response from backend
        let errorMessage = 'Could not update student. Please check your connection and credentials.';
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
      setMobileQuery(data.student.MobileNo);
      showToast(toastMessage);
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
    };

    if (
      !trimmedPayload.Name ||
      !trimmedPayload.MobileNo ||
      !trimmedPayload.District ||
      !trimmedPayload.State
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
      setMobileQuery(data.student.MobileNo);
      setView('student');
      showToast(toastMessages.newStudent);
      setNewStudentForm(createDefaultFormValues());
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

  return (
    <div className="min-h-screen bg-softBackground flex items-center justify-center py-6 relative">
      {/* Logo in top left corner */}
      <div className="absolute top-4 left-4 z-10">
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

      <div className="mx-auto w-full max-w-5xl px-4">
        <header className="text-center mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-primaryRed">Exam Verification</p>
          <h1 className="mt-2 text-3xl font-semibold text-primaryText md:text-4xl">Invigilator Console</h1>
          <p className="mt-2 max-w-xl text-sm text-secondaryText mx-auto">
            Verify student eligibility, capture approvals, and manage retakes instantly before the offline test
            session begins.
          </p>
        </header>

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
                {displayFields.map((key) => (
                  <div key={key} className="rounded-2xl border border-borderGray bg-beigePanel px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondaryText inline-flex items-center gap-2">
                      {labels[key]}
                      {(key === 'Paid' || key === 'Attempted') && getStatusDot(key, student[key] as YesNo)}
                    </p>
                    <p className="mt-1 text-base font-medium text-primaryText">{student[key] || '—'}</p>
                  </div>
                ))}
              </div>

              {actionButtons.length > 0 && (
                <div className="mt-5 flex flex-col gap-3">
                  {actionButtons.map((action) => {
                    const loadingMatch = actionLoading === action.id;
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
                  <h2 className="mt-1 text-2xl font-semibold text-primaryText">Create & Approve</h2>
                  <p className="text-sm text-secondaryText">
                    No record found. Add the student and approve them instantly.
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

                {/* Mobile Number */}
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-secondaryText">Mobile Number</span>
                  <input
                    value={newStudentForm.MobileNo}
                    onChange={(event) =>
                      setNewStudentForm((prev) => ({
                        ...prev,
                        MobileNo: event.target.value,
                      }))
                    }
                    placeholder="Enter mobile number"
                    className="w-full rounded-2xl border border-borderGray bg-beigePanel px-4 py-3 text-base text-primaryText outline-none transition focus:border-primaryRed focus:bg-white focus:ring-2 focus:ring-primaryRed/30"
                    inputMode="numeric"
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

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primaryRed px-6 py-3 text-lg font-semibold text-white transition hover:bg-primaryRedHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaryRed disabled:cursor-not-allowed disabled:bg-primaryRed/70"
                >
                  {isSubmitting ? 'Adding Student…' : 'Add Student'}
                </button>
              </form>
            </section>
          )}
        </main>
      </div>

      {toast && (
        <div className="fixed inset-x-4 top-6 z-50 mx-auto flex max-w-sm justify-center sm:inset-x-auto sm:right-6 sm:mx-0">
          <div
            className={`w-full rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur ${
              toast.tone === 'success'
                ? 'border-successGreen/40 bg-white/90 text-primaryText'
                : 'border-primaryRedHover/40 bg-white/90 text-primaryRed'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}


