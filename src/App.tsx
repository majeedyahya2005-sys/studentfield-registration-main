import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  Filter,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UploadCloud,
  UserRound,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Registration = {
  id: string;
  full_name: string;
  registration_number: string;
  phone: string;
  email: string;
  program: string;
  year_of_study: string;
  department: string;
  academic_supervisor: string | null;
  host_organisation: string;
  placement_location: string;
  start_date: string;
  end_date: string;
  field_supervisor: string | null;
  emergency_name: string;
  emergency_phone: string;
  emergency_relation: string | null;
  notes: string | null;
  acceptance_letter_name: string | null;
  acceptance_letter_size: number | null;
  acceptance_letter_type: string | null;
  review_status: Status;
  reviewer_response: string | null;
  acceptance_message: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type StatusResult = {
  full_name: string;
  registration_number: string;
  email: string;
  host_organisation: string;
  placement_location: string;
  start_date: string;
  end_date: string;
  review_status: Status;
  reviewer_response: string | null;
  acceptance_message: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

type Status = 'pending' | 'approved' | 'needs_changes' | 'rejected';
type View = 'submit' | 'status' | 'review';
type FormValues = Omit<Registration, 'id' | 'acceptance_letter_name' | 'acceptance_letter_size' | 'acceptance_letter_type' | 'review_status' | 'reviewer_response' | 'acceptance_message' | 'rejection_reason' | 'reviewed_at' | 'created_at' | 'updated_at'>;

const initialForm: FormValues = {
  full_name: '', registration_number: '', phone: '', email: '', program: '', year_of_study: '', department: '', academic_supervisor: '',
  host_organisation: '', placement_location: '', start_date: '', end_date: '', field_supervisor: '', emergency_name: '', emergency_phone: '', emergency_relation: '', notes: '',
};

const statusCopy: Record<Status, { label: string; className: string }> = {
  pending: { label: 'Awaiting review', className: 'status-pending' },
  approved: { label: 'Approved', className: 'status-approved' },
  needs_changes: { label: 'Changes requested', className: 'status-changes' },
  rejected: { label: 'Not approved', className: 'status-rejected' },
};

const ownerApi = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/owner-review`;
const ownerHeaders = () => ({
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
});

function App() {
  const [view, setView] = useState<View>('submit');
  const [form, setForm] = useState<FormValues>(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [selected, setSelected] = useState<Registration | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [response, setResponse] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const [ownerPassword, setOwnerPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [statusEmail, setStatusEmail] = useState('');
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null);
  const [statusNotFound, setStatusNotFound] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadRegistrations = async () => {
    setLoadingReviews(true);
    try {
      const res = await fetch(ownerApi, { method: 'POST', headers: ownerHeaders(), body: JSON.stringify({ action: 'list', password: ownerPassword }) });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRegistrations((json.data ?? []) as Registration[]);
    } catch {
      setNotice({ type: 'error', message: 'We could not load the review queue right now.' });
    }
    setLoadingReviews(false);
  };

  useEffect(() => {
    if (view === 'review' && unlocked) void loadRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, unlocked]);

  const filteredRegistrations = useMemo(() => registrations.filter((item) => {
    const text = `${item.full_name} ${item.registration_number} ${item.host_organisation} ${item.email}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (statusFilter === 'all' || item.review_status === statusFilter);
  }), [registrations, query, statusFilter]);

  const metrics = useMemo(() => ({
    total: registrations.length,
    pending: registrations.filter((item) => item.review_status === 'pending').length,
    approved: registrations.filter((item) => item.review_status === 'approved').length,
  }), [registrations]);

  const updateField = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) return;
    const accepted = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
    if (!accepted.includes(nextFile.type) || nextFile.size > 10 * 1024 * 1024) {
      setNotice({ type: 'error', message: 'Choose a PDF, Word document, or image under 10 MB.' });
      event.target.value = '';
      return;
    }
    setNotice(null);
    setFile(nextFile);
  };

  const submitRegistration = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!file) {
      setNotice({ type: 'error', message: 'Please attach your application letter before submitting.' });
      return;
    }
    if (form.end_date < form.start_date) {
      setNotice({ type: 'error', message: 'Your end date must be after your start date.' });
      return;
    }
    setSubmitting(true);
    const { data: newId, error } = await supabase.rpc('submit_registration', {
      p_full_name: form.full_name,
      p_registration_number: form.registration_number,
      p_phone: form.phone,
      p_email: form.email,
      p_program: form.program,
      p_year_of_study: form.year_of_study,
      p_department: form.department,
      p_academic_supervisor: form.academic_supervisor || null,
      p_host_organisation: form.host_organisation,
      p_placement_location: form.placement_location,
      p_start_date: form.start_date,
      p_end_date: form.end_date,
      p_field_supervisor: form.field_supervisor || null,
      p_emergency_name: form.emergency_name,
      p_emergency_phone: form.emergency_phone,
      p_emergency_relation: form.emergency_relation || null,
      p_notes: form.notes || null,
    });
    if (error || !newId) {
      setNotice({ type: 'error', message: 'Your application could not be saved. Please check the form and try again.' });
      setSubmitting(false);
      return;
    }

    const path = `${newId}/${file.name}`;
    const upload = await supabase.storage.from('acceptance-letters').upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) {
      setNotice({ type: 'error', message: 'The application letter could not be uploaded. Please try again with a different file.' });
      setSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase.rpc('owner_attach_letter', { p_id: newId, p_path: path, p_name: file.name, p_size: file.size, p_type: file.type });
    if (updateError) {
      setNotice({ type: 'error', message: 'Your form was saved, but the attachment details could not be completed.' });
    } else {
      setNotice({ type: 'success', message: 'Your field attachment request has been submitted for review.' });
      setForm(initialForm);
      setFile(null);
      const input = document.getElementById('acceptance-letter') as HTMLInputElement | null;
      if (input) input.value = '';
    }
    setSubmitting(false);
  };

  const unlockReview = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setUnlocking(true);
    try {
      const res = await fetch(ownerApi, { method: 'POST', headers: ownerHeaders(), body: JSON.stringify({ action: 'list', password: ownerPassword }) });
      if (res.status === 401) {
        setNotice({ type: 'error', message: 'That password is not correct.' });
      } else if (!res.ok) {
        setNotice({ type: 'error', message: 'We could not verify the password right now.' });
      } else {
        const json = await res.json();
        setRegistrations((json.data ?? []) as Registration[]);
        setUnlocked(true);
      }
    } catch {
      setNotice({ type: 'error', message: 'We could not reach the review service right now.' });
    }
    setUnlocking(false);
  };

  const lockReview = () => {
    setUnlocked(false);
    setOwnerPassword('');
    setRegistrations([]);
    setSelected(null);
    setNotice(null);
  };

  const openRegistration = (item: Registration) => {
    setSelected(item);
    setResponse(item.reviewer_response ?? '');
    setNotice(null);
  };

  const saveResponse = async () => {
    if (!selected) return;
    setSavingReview(true);
    try {
      const res = await fetch(ownerApi, { method: 'POST', headers: ownerHeaders(), body: JSON.stringify({
        action: 'update',
        password: ownerPassword,
        id: selected.id,
        status: selected.review_status,
        response,
        acceptance_message: selected.acceptance_message,
        rejection_reason: selected.rejection_reason,
        host_organisation: selected.host_organisation,
        placement_location: selected.placement_location,
        start_date: selected.start_date,
        end_date: selected.end_date,
      }) });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const updated = json.data as Registration;
      setSelected(updated);
      setRegistrations((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice({ type: 'success', message: 'The review response has been saved.' });
    } catch {
      setNotice({ type: 'error', message: 'The review response could not be saved.' });
    }
    setSavingReview(false);
  };

  const setSelectedStatus = (status: Status) => {
    if (selected) setSelected({ ...selected, review_status: status });
  };

  const setSelectedField = (name: keyof Registration, value: string) => {
    if (selected) setSelected({ ...selected, [name]: value });
  };

  const downloadLetter = async () => {
    if (!selected) return;
    try {
      const res = await fetch(ownerApi, { method: 'POST', headers: ownerHeaders(), body: JSON.stringify({ action: 'letter', password: ownerPassword, id: selected.id }) });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (!json.url) {
        setNotice({ type: 'error', message: 'We could not open this application letter right now.' });
        return;
      }
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch {
      setNotice({ type: 'error', message: 'We could not open this application letter right now.' });
    }
  };

  const checkStatus = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = statusEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatusNotice({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    setStatusNotice(null);
    setStatusLoading(true);
    setStatusResult(null);
    setStatusNotFound(false);
    try {
      const { data, error } = await supabase.rpc('student_check_status', { p_email: trimmed });
      if (error) throw error;
      if (data && data.length > 0) {
        setStatusResult(data[0] as StatusResult);
      } else {
        setStatusNotFound(true);
      }
    } catch {
      setStatusNotice({ type: 'error', message: 'We could not check your status right now. Please try again.' });
    }
    setStatusLoading(false);
  };

  const resetStatus = () => {
    setStatusResult(null);
    setStatusNotFound(false);
    setStatusNotice(null);
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="government-banner"><img src="/image%20copy.png" alt="Ministry of Information, Technology and Communication Zanzibar" /></div>
        <div className="topbar">
          <div className="brand"><strong>Student Field System</strong><span>Placement management portal</span></div>
          <nav className="main-nav" aria-label="Main navigation">
            <button className={view === 'submit' ? 'nav-link active' : 'nav-link'} onClick={() => { setView('submit'); setNotice(null); }}><FileText size={17} /> Submit request</button>
            <button className={view === 'status' ? 'nav-link active' : 'nav-link'} onClick={() => { setView('status'); setNotice(null); resetStatus(); }}><Search size={17} /> Application status</button>
            <button className={view === 'review' ? 'nav-link active' : 'nav-link'} onClick={() => { setView('review'); setNotice(null); }}><ClipboardCheck size={17} /> Review responses</button>
          </nav>
          <div className="office-status"><span className="pulse-dot" /> Office hours <b>08:00–16:30</b></div>
        </div>
      </header>

      {view === 'submit' ? (
        <main className="page-wrap">
          <section className="hero-row">
            <div><p className="eyebrow">Field attachment clearance</p><h1>Make your next placement count.</h1><p className="hero-copy">Submit your placement details and application letter in one place. The fieldwork office will review your request and send a response here.</p></div>
            <div className="hero-card"><div className="hero-card-icon"><ShieldCheck size={22} /></div><div><strong>One secure record</strong><p>Your letter is stored with your application and only opened by the review team.</p></div></div>
          </section>

          <div className="progress-bar"><div className="progress-step active"><span>01</span><div><b>Your details</b><small>Tell us who you are</small></div></div><div className="progress-line" /><div className="progress-step active"><span>02</span><div><b>Placement</b><small>Where you will go</small></div></div><div className="progress-line" /><div className="progress-step"><span>03</span><div><b>Review</b><small>We respond here</small></div></div></div>

          <form className="form-layout" onSubmit={submitRegistration}>
            <div className="form-main">
              <FormSection icon={<UserRound size={18} />} title="Applicant details" description="Use the same details that appear on your student record.">
                <div className="field-grid two"><Field label="Full name" name="full_name" value={form.full_name} onChange={updateField} placeholder="e.g. Amara Okafor" required /><Field label="Registration number" name="registration_number" value={form.registration_number} onChange={updateField} placeholder="e.g. EDU/24/0182" required /></div>
                <div className="field-grid three"><Field label="Phone number" name="phone" value={form.phone} onChange={updateField} placeholder="+234 800 000 0000" required /><Field label="Email address" type="email" name="email" value={form.email} onChange={updateField} placeholder="you@university.edu" required /><SelectField label="Year of study" name="year_of_study" value={form.year_of_study} onChange={updateField} options={['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Postgraduate']} required /></div>
                <div className="field-grid two"><Field label="Programme" name="program" value={form.program} onChange={updateField} placeholder="e.g. B.Ed. Science Education" required /><Field label="Department" name="department" value={form.department} onChange={updateField} placeholder="e.g. Curriculum Studies" required /></div>
                <Field label="Academic supervisor" name="academic_supervisor" value={form.academic_supervisor ?? ''} onChange={updateField} placeholder="Name of your academic supervisor" />
              </FormSection>

              <FormSection icon={<MapPin size={18} />} title="Placement details" description="Help us understand the organisation and dates for your attachment.">
                <div className="field-grid two"><Field label="Host organisation" name="host_organisation" value={form.host_organisation} onChange={updateField} placeholder="e.g. Greenfield Secondary School" required /><Field label="Placement location" name="placement_location" value={form.placement_location} onChange={updateField} placeholder="City, state / region" required /></div>
                <div className="field-grid three"><Field label="Start date" type="date" name="start_date" value={form.start_date} onChange={updateField} required /><Field label="End date" type="date" name="end_date" value={form.end_date} onChange={updateField} required /><Field label="On-site supervisor" name="field_supervisor" value={form.field_supervisor ?? ''} onChange={updateField} placeholder="Name, if known" /></div>
              </FormSection>

              <FormSection icon={<ShieldCheck size={18} />} title="Emergency contact" description="Someone the university can reach if support is needed during your placement.">
                <div className="field-grid three"><Field label="Contact name" name="emergency_name" value={form.emergency_name} onChange={updateField} placeholder="Full name" required /><Field label="Phone number" name="emergency_phone" value={form.emergency_phone} onChange={updateField} placeholder="+234 800 000 0000" required /><Field label="Relationship" name="emergency_relation" value={form.emergency_relation ?? ''} onChange={updateField} placeholder="e.g. Parent" /></div>
                <label className="field-label">Additional note <span>Optional</span><textarea name="notes" value={form.notes ?? ''} onChange={updateField} rows={3} placeholder="Anything the fieldwork office should know?" /></label>
              </FormSection>
            </div>

            <aside className="form-side">
              <div className="upload-card"><div className="card-heading"><div className="icon-box mint"><Paperclip size={18} /></div><div><h2>Application letter</h2><p>Required before we can review your request.</p></div></div><label className={file ? 'dropzone has-file' : 'dropzone'} htmlFor="acceptance-letter"><input id="acceptance-letter" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFile} /><div className="upload-symbol">{file ? <CheckCircle2 size={24} /> : <UploadCloud size={24} />}</div>{file ? <><strong>{file.name}</strong><small>{formatBytes(file.size)} · Ready to upload</small></> : <><strong>Choose a file</strong><small>PDF, Word or image · max 10 MB</small></>}</label>{file && <button type="button" className="remove-file" onClick={() => { setFile(null); const input = document.getElementById('acceptance-letter') as HTMLInputElement | null; if (input) input.value = ''; }}>Remove attachment <XCircle size={14} /></button>}<div className="privacy-note"><ShieldCheck size={15} /><span>Your document is kept private and is only available to the fieldwork review team.</span></div></div>
              <div className="side-note"><CalendarDays size={18} /><div><strong>What happens next?</strong><p>We usually respond within 2–3 working days. Check the application status page to see your response.</p></div></div>
              {notice && <Notice notice={notice} />}
              <button className="submit-button" type="submit" disabled={submitting}>{submitting ? <Loader2 className="spin" size={18} /> : <Send size={17} />}{submitting ? 'Submitting request…' : 'Submit for review'}<ArrowRight size={17} /></button>
              <p className="required-note">By submitting, you confirm that the information provided is accurate.</p>
            </aside>
          </form>
        </main>
      ) : view === 'status' ? (
        <main className="page-wrap status-page">
          <section className="hero-row">
            <div>
              <p className="eyebrow">Track your application</p>
              <h1>Check your application status</h1>
              <p className="hero-copy">Enter the email address you used when submitting your field placement request to see its current status.</p>
            </div>
          </section>

          <div className="status-search-card">
            <form onSubmit={checkStatus} className="status-search-form">
              <div className="status-search-row">
                <div className="search-field status-search-field">
                  <Search size={18} />
                  <input
                    type="email"
                    value={statusEmail}
                    onChange={(event) => setStatusEmail(event.target.value)}
                    placeholder="Enter your registered email address"
                    required
                    autoFocus
                  />
                </div>
                <button className="submit-button status-check-btn" type="submit" disabled={statusLoading}>
                  {statusLoading ? <Loader2 className="spin" size={18} /> : <Search size={17} />}
                  {statusLoading ? 'Checking…' : 'Check status'}
                </button>
              </div>
            </form>
            {statusNotice && <Notice notice={statusNotice} />}
          </div>

          {statusLoading && (
            <div className="status-loading-card">
              <Loader2 className="spin" size={32} />
              <p>Looking up your application…</p>
            </div>
          )}

          {statusNotFound && !statusLoading && (
            <div className="status-result-card status-not-found">
              <div className="status-result-icon not-found"><Search size={28} /></div>
              <h2>No application found</h2>
              <p>No application was found for this email address. Please make sure you entered the same email used during registration.</p>
              <button className="status-check-again" onClick={() => { resetStatus(); setStatusEmail(''); }}>
                <RefreshCw size={16} /> Try a different email
              </button>
            </div>
          )}

          {statusResult && !statusLoading && (
            <div className={`status-result-card status-${statusResult.review_status}`}>
              <div className="status-result-header">
                <div className={`status-result-icon ${statusResult.review_status}`}>
                  {statusResult.review_status === 'approved' ? <CheckCircle2 size={28} /> : statusResult.review_status === 'rejected' ? <XCircle size={28} /> : statusResult.review_status === 'needs_changes' ? <MessageSquareText size={28} /> : <Clock3 size={28} />}
                </div>
                <div className="status-result-title">
                  <h2>{statusResult.full_name}</h2>
                  <span>{statusResult.registration_number}</span>
                </div>
                <span className={`status-pill ${statusCopy[statusResult.review_status].className}`}>{statusCopy[statusResult.review_status].label}</span>
              </div>

              {statusResult.review_status === 'approved' && (
                <p className="status-message approved">Your field placement application has been accepted.</p>
              )}
              {statusResult.review_status === 'rejected' && (
                <p className="status-message rejected">Your field placement application has not been accepted.</p>
              )}
              {statusResult.review_status === 'needs_changes' && (
                <p className="status-message changes">Your application needs changes before it can be approved.</p>
              )}
              {statusResult.review_status === 'pending' && (
                <p className="status-message pending">Your application is still under review. Please wait for the final decision.</p>
              )}

              <div className="status-detail-grid">
                {statusResult.host_organisation && (
                  <div className="status-detail-item">
                    <Building2 size={18} />
                    <div><span>Organisation</span><strong>{statusResult.host_organisation}</strong></div>
                  </div>
                )}
                {statusResult.placement_location && (
                  <div className="status-detail-item">
                    <MapPin size={18} />
                    <div><span>Location</span><strong>{statusResult.placement_location}</strong></div>
                  </div>
                )}
                {statusResult.start_date && (
                  <div className="status-detail-item">
                    <CalendarDays size={18} />
                    <div><span>Start date</span><strong>{formatShortDate(statusResult.start_date)}</strong></div>
                  </div>
                )}
                {statusResult.end_date && (
                  <div className="status-detail-item">
                    <CalendarRange size={18} />
                    <div><span>End date</span><strong>{formatShortDate(statusResult.end_date)}</strong></div>
                  </div>
                )}
              </div>

              {statusResult.review_status === 'approved' && statusResult.acceptance_message && (
                <div className="status-note-box approved">
                  <CheckCircle2 size={18} />
                  <div><strong>Acceptance message</strong><p>{statusResult.acceptance_message}</p></div>
                </div>
              )}
              {statusResult.review_status === 'rejected' && statusResult.rejection_reason && (
                <div className="status-note-box rejected">
                  <XCircle size={18} />
                  <div><strong>Reason</strong><p>{statusResult.rejection_reason}</p></div>
                </div>
              )}
              {statusResult.review_status === 'needs_changes' && statusResult.reviewer_response && (
                <div className="status-note-box changes">
                  <MessageSquareText size={18} />
                  <div><strong>Response from the field office</strong><p>{statusResult.reviewer_response}</p></div>
                </div>
              )}
              {statusResult.review_status === 'approved' && statusResult.reviewer_response && (
                <div className="status-note-box approved">
                  <MessageSquareText size={18} />
                  <div><strong>Message from the field office</strong><p>{statusResult.reviewer_response}</p></div>
                </div>
              )}

              <div className="status-meta">
                <span>Submitted {formatDate(statusResult.created_at)}</span>
                <span>Last updated {formatDate(statusResult.updated_at)}</span>
              </div>

              <button className="status-check-again" onClick={checkStatus} disabled={statusLoading}>
                <RefreshCw size={16} /> Check again
              </button>
            </div>
          )}
        </main>
      ) : (
        <main className="page-wrap review-page">
          {!unlocked ? (
            <section className="lock-gate">
              <div className="lock-card">
                <div className="lock-icon"><Lock size={26} /></div>
                <h1>Owner access only</h1>
                <p>Enter the owner password to view submitted requests and send responses.</p>
                <form onSubmit={unlockReview}>
                  <input type="password" value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} placeholder="Owner password" autoFocus required />
                  {notice && <Notice notice={notice} />}
                  <button type="submit" disabled={unlocking || !ownerPassword}>{unlocking ? <Loader2 className="spin" size={17} /> : <Lock size={16} />}{unlocking ? 'Verifying…' : 'Unlock review area'}</button>
                </form>
              </div>
            </section>
          ) : (
            <>
              <section className="review-header"><div><p className="eyebrow">Field office</p><h1>Review responses</h1><p className="hero-copy">Keep applications moving and send clear next steps back to students.</p></div><div className="review-top-actions"><div className="review-date"><Bell size={17} /> Queue updated just now</div><button className="lock-button" onClick={lockReview}><LogOut size={15} /> Lock</button></div></section>
              <section className="metric-grid"><Metric icon={<LayoutDashboard size={19} />} label="All requests" value={metrics.total} tone="blue" /><Metric icon={<Clock3 size={19} />} label="Awaiting review" value={metrics.pending} tone="gold" /><Metric icon={<CheckCircle2 size={19} />} label="Approved" value={metrics.approved} tone="green" /></section>
              <div className="review-toolbar"><div className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, number, email or organisation" /></div><div className="filter-field"><Filter size={16} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | Status)}><option value="all">All statuses</option><option value="pending">Awaiting review</option><option value="approved">Approved</option><option value="needs_changes">Changes requested</option><option value="rejected">Not approved</option></select></div></div>
              <div className="review-layout"><section className="request-list"><div className="list-heading"><strong>{filteredRegistrations.length} requests</strong><span>Most recent first</span></div>{loadingReviews ? <div className="empty-state"><Loader2 className="spin" size={24} /><p>Loading review queue…</p></div> : filteredRegistrations.length === 0 ? <div className="empty-state"><ClipboardCheck size={28} /><p>No requests match your filters.</p><small>New submissions will appear here automatically.</small></div> : filteredRegistrations.map((item) => <button className={selected?.id === item.id ? 'request-item selected' : 'request-item'} key={item.id} onClick={() => openRegistration(item)}><div className="avatar">{initials(item.full_name)}</div><div className="request-summary"><strong>{item.full_name}</strong><span>{item.registration_number} · {item.host_organisation}</span><small>{formatDate(item.created_at)}</small></div><span className={`status-pill ${statusCopy[item.review_status].className}`}>{statusCopy[item.review_status].label}</span></button>)}</section><section className="detail-panel">{selected ? <ReviewDetail registration={selected} response={response} setResponse={setResponse} setStatus={setSelectedStatus} setField={setSelectedField} saveResponse={saveResponse} saving={savingReview} downloadLetter={downloadLetter} notice={notice} /> : <div className="detail-empty"><div className="detail-empty-icon"><MessageSquareText size={26} /></div><h2>Select a request</h2><p>Choose an application from the left to review its details and send a response.</p></div>}</section></div>
            </>
          )}
        </main>
      )}
      <footer className="footer"><span>Student Field System</span><span>Questions? Contact your department coordinator</span></footer>
    </div>
  );
}

function FormSection({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) { return <section className="form-section"><div className="section-heading"><div className="icon-box"><span>{icon}</span></div><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>; }
function Field({ label, name, value, onChange, placeholder, type = 'text', required = false }: { label: string; name: string; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; placeholder?: string; type?: string; required?: boolean }) { return <label className="field-label">{label}{required && <b>*</b>}<input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} /></label>; }
function SelectField({ label, name, value, onChange, options, required = false }: { label: string; name: string; value: string; onChange: (event: ChangeEvent<HTMLSelectElement>) => void; options: string[]; required?: boolean }) { return <label className="field-label">{label}{required && <b>*</b>}<select name={name} value={value} onChange={onChange} required={required}><option value="">Select year</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function Notice({ notice }: { notice: { type: 'success' | 'error'; message: string } }) { return <div className={`notice ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={17} /> : <XCircle size={17} />}</span>{notice.message}</div>; }
function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>; }

function ReviewDetail({ registration, response, setResponse, setStatus, setField, saveResponse, saving, downloadLetter, notice }: {
  registration: Registration;
  response: string;
  setResponse: (value: string) => void;
  setStatus: (status: Status) => void;
  setField: (name: keyof Registration, value: string) => void;
  saveResponse: () => void;
  saving: boolean;
  downloadLetter: () => void;
  notice: { type: 'success' | 'error'; message: string } | null;
}) {
  return (
    <div className="detail-content">
      <div className="detail-top">
        <button className="back-button"><ChevronLeft size={16} /> All requests</button>
        <span className={`status-pill ${statusCopy[registration.review_status].className}`}>{statusCopy[registration.review_status].label}</span>
      </div>
      <div className="detail-title">
        <div className="avatar large">{initials(registration.full_name)}</div>
        <div><h2>{registration.full_name}</h2><p>{registration.registration_number} · Submitted {formatDate(registration.created_at)}</p></div>
      </div>

      <div className="detail-block">
        <h3>Placement overview</h3>
        <div className="detail-grid">
          <DetailItem label="Programme" value={registration.program} />
          <DetailItem label="Department" value={registration.department} />
          <DetailItem label="Email" value={registration.email} />
          <DetailItem label="Academic supervisor" value={registration.academic_supervisor || 'Not provided'} />
        </div>
      </div>

      <div className="detail-block">
        <h3>Contact details</h3>
        <div className="detail-grid">
          <DetailItem label="Phone" value={registration.phone} />
          <DetailItem label="Emergency contact" value={`${registration.emergency_name} · ${registration.emergency_phone}`} />
          <DetailItem label="Relationship" value={registration.emergency_relation || 'Not provided'} />
        </div>
      </div>

      <div className="attachment-row">
        <div className="attachment-icon"><FileCheck2 size={19} /></div>
        <div><strong>{registration.acceptance_letter_name || 'Application letter'}</strong><span>{registration.acceptance_letter_size ? formatBytes(registration.acceptance_letter_size) : 'Attachment'} · Private document</span></div>
        <button onClick={downloadLetter}><Download size={16} /> Open</button>
      </div>

      {registration.notes && <div className="student-note"><MessageSquareText size={16} /><div><strong>Student note</strong><p>{registration.notes}</p></div></div>}

      <div className="response-box">
        <div className="response-heading">
          <div>
            <h3>Application management</h3>
            <p>Update placement details, set the status, and write a response the student will see.</p>
          </div>
          <select value={registration.review_status} onChange={(event) => setStatus(event.target.value as Status)}>
            <option value="pending">Awaiting review</option>
            <option value="approved">Approved</option>
            <option value="needs_changes">Changes requested</option>
            <option value="rejected">Not approved</option>
          </select>
        </div>

        <div className="admin-edit-grid">
          <label className="field-label">Host organisation<input value={registration.host_organisation} onChange={(event) => setField('host_organisation', event.target.value)} /></label>
          <label className="field-label">Placement location<input value={registration.placement_location} onChange={(event) => setField('placement_location', event.target.value)} /></label>
          <label className="field-label">Start date<input type="date" value={registration.start_date} onChange={(event) => setField('start_date', event.target.value)} /></label>
          <label className="field-label">End date<input type="date" value={registration.end_date} onChange={(event) => setField('end_date', event.target.value)} /></label>
        </div>

        <label className="field-label admin-message-field">Response to student<textarea value={response} onChange={(event) => setResponse(event.target.value)} rows={3} placeholder="Write your response to the student…" /></label>

        {registration.review_status === 'approved' && (
          <label className="field-label admin-message-field">Acceptance message<span>Shown to the student when they check their status</span><textarea value={registration.acceptance_message ?? ''} onChange={(event) => setField('acceptance_message', event.target.value)} rows={3} placeholder="Write a message the student will see when their application is accepted…" /></label>
        )}
        {registration.review_status === 'rejected' && (
          <label className="field-label admin-message-field">Rejection reason<span>Shown to the student when they check their status</span><textarea value={registration.rejection_reason ?? ''} onChange={(event) => setField('rejection_reason', event.target.value)} rows={3} placeholder="Explain why the application was not accepted…" /></label>
        )}

        {notice && <Notice notice={notice} />}
        <button className="save-button" onClick={saveResponse} disabled={saving}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />}{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function initials(name: string) { return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }
function formatDate(date: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date)); }
function formatShortDate(date: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`)); }
function formatBytes(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`; }

export default App;
