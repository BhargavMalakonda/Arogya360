import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import SecondaryButton from '../components/SecondaryButton';
import PrimaryButton from '../components/PrimaryButton';
import EmergencyBanner from '../components/EmergencyBanner';
import DoctorSummaryPanel from '../components/DoctorSummaryPanel';
import { jsPDF } from 'jspdf';

// ── Risk level display config — UNCHANGED ────────────────────────────────────
const RISK_CONFIG = {
  'ESI-1': {
    label: 'Emergency',
    description: 'Seek immediate emergency care',
    textClass: 'text-esi-emergency',
    badgeBg: 'bg-esi-emergency text-white',
    iconBg: 'rgba(220,38,38,0.10)',
    iconBorder: 'rgba(220,38,38,0.25)',
    iconColor: '#B91C1C',
    pillBg: 'rgba(220,38,38,0.08)',
    pillText: '#B91C1C',
    pillBorder: 'rgba(220,38,38,0.22)',
    cardBg: 'rgba(254,242,242,0.80)',
    cardBorder: 'rgba(220,38,38,0.18)',
    isEmergency: true,
  },
  'ESI-2': {
    label: 'High Risk',
    description: 'Seek urgent medical attention today',
    textClass: 'text-esi-emergency',
    badgeBg: 'bg-esi-emergency text-white',
    iconBg: 'rgba(220,38,38,0.10)',
    iconBorder: 'rgba(220,38,38,0.25)',
    iconColor: '#B91C1C',
    pillBg: 'rgba(220,38,38,0.08)',
    pillText: '#B91C1C',
    pillBorder: 'rgba(220,38,38,0.22)',
    cardBg: 'rgba(254,242,242,0.80)',
    cardBorder: 'rgba(220,38,38,0.18)',
    isEmergency: true,
  },
  'ESI-3': {
    label: 'Moderate Risk',
    description: 'See a doctor within 24–48 hours',
    textClass: 'text-esi-warning',
    badgeBg: 'bg-esi-warning text-white',
    iconBg: 'rgba(245,158,11,0.10)',
    iconBorder: 'rgba(245,158,11,0.28)',
    iconColor: '#B45309',
    pillBg: 'rgba(245,158,11,0.08)',
    pillText: '#B45309',
    pillBorder: 'rgba(245,158,11,0.22)',
    cardBg: 'rgba(255,251,235,0.80)',
    cardBorder: 'rgba(245,158,11,0.18)',
    isEmergency: false,
  },
  'ESI-4': {
    label: 'Low Risk',
    description: 'Monitor at home; visit a clinic if symptoms worsen',
    textClass: 'text-esi-success',
    badgeBg: 'bg-esi-success text-white',
    iconBg: 'rgba(22,163,74,0.10)',
    iconBorder: 'rgba(22,163,74,0.28)',
    iconColor: '#15803D',
    pillBg: 'rgba(22,163,74,0.08)',
    pillText: '#15803D',
    pillBorder: 'rgba(22,163,74,0.22)',
    cardBg: 'rgba(240,253,244,0.85)',
    cardBorder: 'rgba(22,163,74,0.18)',
    isEmergency: false,
  },
  'ESI-5': {
    label: 'Non-Urgent',
    description: 'Self-care and preventive measures are sufficient',
    textClass: 'text-esi-success',
    badgeBg: 'bg-esi-success text-white',
    iconBg: 'rgba(22,163,74,0.10)',
    iconBorder: 'rgba(22,163,74,0.28)',
    iconColor: '#15803D',
    pillBg: 'rgba(22,163,74,0.08)',
    pillText: '#15803D',
    pillBorder: 'rgba(22,163,74,0.22)',
    cardBg: 'rgba(240,253,244,0.85)',
    cardBorder: 'rgba(22,163,74,0.18)',
    isEmergency: false,
  },
};

const DEFAULT_RISK = {
  label: 'Assessment Complete',
  description: 'Review your results below',
  textClass: 'text-on-surface',
  badgeBg: 'bg-gray-400 text-white',
  iconBg: 'rgba(100,116,139,0.10)',
  iconBorder: 'rgba(100,116,139,0.25)',
  iconColor: '#475569',
  pillBg: 'rgba(100,116,139,0.08)',
  pillText: '#475569',
  pillBorder: 'rgba(100,116,139,0.20)',
  cardBg: 'rgba(248,250,252,0.88)',
  cardBorder: 'rgba(148,163,184,0.22)',
  isEmergency: false,
};

// ── WhatsApp share helper — UNCHANGED ─────────────────────────────────────────
function buildShareText(assessment) {
  const risk = RISK_CONFIG[assessment.risk_level] || DEFAULT_RISK;
  return (
    `Arogya360 Health Assessment\n` +
    `Risk Level: ${risk.label} (${assessment.risk_level})\n` +
    `Likely Pattern: ${assessment.condition_pattern}\n` +
    `\nRecommendations:\n` +
    (assessment.recommendations || []).map((r) => `• ${r}`).join('\n') +
    `\n\nStay safe. If symptoms worsen, seek medical care immediately.`
  );
}

// ── Shared glass card ─────────────────────────────────────────────────────────
const GlassCard = ({ children, className = '', style = {} }) => (
  <div
    style={{
      background: 'rgba(255,255,255,0.86)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      border: '1px solid rgba(255,255,255,0.92)',
      borderRadius: '20px',
      boxShadow: '0 6px 28px rgba(88,86,214,0.07), 0 2px 8px rgba(30,31,59,0.04)',
      ...style,
    }}
    className={className}
  >
    {children}
  </div>
);

// ── Icon circle container — 44px to match reference ─────────────────────────
const IconCircle = ({ children, bg, border, color }) => (
  <div
    className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
    style={{ background: bg, border: `1.5px solid ${border}`, color }}
  >
    {children}
  </div>
);

// ── Section card row (icon + title + content) ─────────────────────────────────
const SectionCard = ({ icon, iconBg, iconBorder, iconColor, title, children }) => (
  <GlassCard className="flex items-start gap-4 px-6 py-5 md:px-7 md:py-6">
    <IconCircle bg={iconBg} border={iconBorder} color={iconColor}>
      {icon}
    </IconCircle>
    <div className="flex-1 min-w-0">
      <h2 className="text-[16px] font-bold text-on-surface font-display mb-1.5 leading-tight">
        {title}
      </h2>
      {children}
    </div>
  </GlassCard>
);

// ── Inline SVG icons — decorative, aria-hidden ───────────────────────────────
const IconShield = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
  </svg>
);
const IconSymptoms = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5" aria-hidden="true">
    <rect x="3" y="3" width="14" height="14" rx="3"/>
    <path d="M7 10h6M10 7v6" strokeLinecap="round"/>
  </svg>
);
const IconCondition = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5" aria-hidden="true">
    <circle cx="10" cy="10" r="7"/>
    <path d="M7.5 8.5C7.5 7.1 8.6 6 10 6s2.5 1.1 2.5 2.5c0 1.8-2.5 3-2.5 4.5M10 15.5v.5" strokeLinecap="round"/>
  </svg>
);
const IconRec = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5" aria-hidden="true">
    <path d="M4 4h12v2H4zM4 8h12M4 12h8" strokeLinecap="round"/>
    <rect x="3" y="3" width="14" height="14" rx="2"/>
  </svg>
);
const IconPrevention = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path d="M10 2a6 6 0 00-3.819 10.602c.414.388.819.81.819 1.324V15a1 1 0 001 1h4a1 1 0 001-1v-1.074c0-.514.405-.936.819-1.324A6 6 0 0010 2zM8 16.5v.5a2 2 0 104 0v-.5H8z"/>
  </svg>
);
const IconFollowUp = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
  </svg>
);
const IconGov = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
  </svg>
);
const IconHome = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4" aria-hidden="true">
    <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" strokeLinejoin="round"/>
    <path d="M7 18V12h6v6" strokeLinejoin="round"/>
  </svg>
);
const IconHistory = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4" aria-hidden="true">
    <circle cx="10" cy="10" r="7"/>
    <path d="M10 6v4l2.5 2.5" strokeLinecap="round"/>
  </svg>
);
const IconLocation = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4" aria-hidden="true">
    <path d="M10 2C7.24 2 5 4.24 5 7c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5z" strokeLinejoin="round"/>
    <circle cx="10" cy="7" r="2"/>
  </svg>
);
const IconArrowRight = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────
const Result = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Firestore fetch — UNCHANGED ───────────────────────────────────────────
  useEffect(() => {
    if (!assessmentId || !user) return;
    const fetchAssessment = async () => {
      try {
        const docRef = doc(db, 'assessments', assessmentId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          setError('Assessment not found.');
        } else {
          const data = snap.data();
          if (data.uid !== user.uid) {
            setError('You do not have permission to view this assessment.');
          } else {
            setAssessment(data);
          }
        }
      } catch (err) {
        setError('Failed to load assessment. Please try again.');
        console.error('[Result] Firestore fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAssessment();
  }, [assessmentId, user]);

  // ── WhatsApp share — UNCHANGED ────────────────────────────────────────────
  const handleWhatsAppShare = async () => {
    if (!assessment) return;
    const text = buildShareText(assessment);
    if (navigator.share) {
      try { await navigator.share({ title: 'Arogya360 Assessment', text }); } catch { /* cancelled */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    }
  };

  // ── PDF download — UNCHANGED ──────────────────────────────────────────────
  const handleDownloadPDF = () => {
    if (!assessment) return;
    const riskConfig = RISK_CONFIG[assessment.risk_level] || DEFAULT_RISK;
    const toDate = (val) => val?.toDate ? val.toDate() : val ? new Date(val) : null;
    const fmt = (val) => {
      const d = toDate(val);
      return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    };
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = 20;
    const checkPage = (needed = 10) => { if (y + needed > 275) { pdf.addPage(); y = 20; } };
    const addWrappedText = (text, x, fontSize = 10, style = 'normal') => {
      pdf.setFontSize(fontSize); pdf.setFont('helvetica', style);
      const lines = pdf.splitTextToSize(String(text ?? ''), contentW - (x - margin));
      lines.forEach((line) => { checkPage(6); pdf.text(line, x, y); y += 5.5; });
    };
    const addSection = (title) => {
      checkPage(14); y += 4;
      pdf.setFillColor(245, 247, 250); pdf.rect(margin, y - 4, contentW, 8, 'F');
      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(79, 70, 229);
      pdf.text(title.toUpperCase(), margin + 2, y); pdf.setTextColor(30, 30, 30); y += 7;
    };
    pdf.setFontSize(18); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(79, 70, 229);
    pdf.text('Arogya360 Health Assessment', margin, y); y += 8;
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120, 120, 120);
    pdf.text('This report is for informational guidance only and does not constitute medical advice.', margin, y);
    y += 5; pdf.line(margin, y, pageW - margin, y); pdf.setTextColor(30, 30, 30); y += 6;
    addWrappedText(`Assessment Date: ${fmt(assessment.created_at)}`, margin, 10, 'normal');
    if (assessment.initial_symptom) addWrappedText(`Initial Complaint: ${assessment.initial_symptom}`, margin, 10, 'normal');
    if (assessment.condition_pattern) addWrappedText(`Likely Pattern: ${assessment.condition_pattern}`, margin, 10, 'normal');
    y += 2;
    addSection('Risk Assessment');
    pdf.setFontSize(13); pdf.setFont('helvetica', 'bold');
    pdf.text(`${assessment.risk_level ?? '—'}  —  ${riskConfig.label}`, margin, y); y += 6;
    addWrappedText(riskConfig.description, margin, 10, 'italic');
    if (Array.isArray(assessment.matched_symptoms) && assessment.matched_symptoms.length > 0) {
      y += 2;
      addWrappedText('Reported symptoms: ' + assessment.matched_symptoms.map((s) => s.replace(/_/g, ' ')).join(', '), margin, 9, 'normal');
    }
    if (Array.isArray(assessment.recommendations) && assessment.recommendations.length > 0) {
      addSection('Recommended Actions');
      assessment.recommendations.forEach((rec, i) => { addWrappedText(`${i + 1}.  ${rec}`, margin + 2, 10, 'normal'); y += 1; });
      if (assessment.follow_up_date) { y += 1; addWrappedText(`Suggested follow-up: ${fmt(assessment.follow_up_date)}`, margin, 9, 'italic'); }
    }
    if (Array.isArray(assessment.prevention_tips) && assessment.prevention_tips.length > 0) {
      addSection('Verified Prevention Tips');
      pdf.setFontSize(8); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(120, 120, 120);
      pdf.text('Source: WHO / ICMR / MoHFW guidelines', margin, y); pdf.setTextColor(30, 30, 30); y += 5;
      assessment.prevention_tips.forEach((tip) => { addWrappedText(`•  ${tip}`, margin + 2, 10, 'normal'); y += 1; });
    }
    if (Array.isArray(assessment.government_resources) && assessment.government_resources.length > 0) {
      addSection('Government Benefits & Resources');
      assessment.government_resources.forEach((scheme, i) => {
        checkPage(20);
        pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
        pdf.text(`${i + 1}.  ${scheme.scheme_name}`, margin + 2, y); y += 5.5;
        addWrappedText(scheme.benefit, margin + 6, 9, 'normal');
        if (scheme.eligibility_note) addWrappedText(`Eligibility: ${scheme.eligibility_note}`, margin + 6, 9, 'italic');
        if (scheme.link) { pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(79, 70, 229); pdf.text(scheme.link, margin + 6, y); pdf.setTextColor(30, 30, 30); y += 5.5; }
        y += 2;
      });
    }
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(160, 160, 160);
      pdf.text(`Arogya360 · Page ${p} of ${totalPages}`, pageW / 2, 287, { align: 'center' });
    }
    const datePart = (toDate(assessment.created_at) ?? new Date()).toISOString().slice(0, 10);
    pdf.save(`arogya360-assessment-${assessment.assessment_id ?? assessmentId}-${datePart}.pdf`);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full max-w-[920px] mx-auto px-4 md:px-6 lg:px-8 pt-10 pb-28 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-[18px] animate-pulse"
            style={{ background: 'rgba(255,255,255,0.30)' }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-[920px] mx-auto px-4 md:px-6 lg:px-8 pt-10">
        <GlassCard className="px-6 py-6">
          <p className="text-esi-emergency text-[13px] font-body mb-4">{error}</p>
          <button onClick={() => navigate('/home')}
            className="text-[13px] text-brand-indigo underline font-body">
            Return home
          </button>
        </GlassCard>
      </div>
    );
  }

  if (!assessment) return null;

  const riskConfig = RISK_CONFIG[assessment.risk_level] || DEFAULT_RISK;

  // ── Timestamp helper — UNCHANGED ─────────────────────────────────────────
  const toJsDate = (val) => val?.toDate ? val.toDate() : val ? new Date(val) : null;
  const formatDate = (val) => {
    const d = toJsDate(val);
    return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  };

  const followUpFormatted = formatDate(assessment.follow_up_date);

  // ── Indigo accent used for secondary cards ────────────────────────────────
  const indigoIconBg   = 'rgba(88,86,214,0.09)';
  const indigoIconBorder = 'rgba(88,86,214,0.20)';
  const indigoIconColor  = '#5856D6';

  return (
    <div className="w-full max-w-[920px] mx-auto px-4 md:px-6 lg:px-8 pt-4 pb-28 space-y-4 page-enter">

      {/* ══════════════════════════════════════════════════════════════════════
          EMERGENCY BANNER — ESI-1 / ESI-2 only
          Trigger: riskConfig.isEmergency — UNCHANGED
          ══════════════════════════════════════════════════════════════════════ */}
      {riskConfig.isEmergency && (
        <EmergencyBanner>
          <div className="max-w-[860px] mx-auto flex items-start gap-3 px-4 py-1">
            <div className="flex-shrink-0 mt-0.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-100" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[15px] leading-tight">This assessment indicates a potential emergency.</p>
              <p className="text-[13px] opacity-90 mt-0.5 leading-snug">
                Please seek immediate medical attention or call emergency services now.
              </p>
            </div>
          </div>
        </EmergencyBanner>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          COMPLETION HEADER — centered, atmospheric
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col items-center text-center pt-6 pb-4" aria-label="Assessment complete">
        {/* Green checkmark circle with decorative dots */}
        <div className="relative mb-5">
          {/* Decorative particles — aria-hidden, spread wider */}
          <div aria-hidden="true" className="absolute pointer-events-none" style={{ inset: '-20px' }}>
            <span className="absolute w-2 h-2 rounded-full bg-esi-success/55" style={{ top: '4px', left: '50%', transform: 'translateX(-24px)' }} />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-brand-indigo/35" style={{ top: '2px', right: '8px' }} />
            <span className="absolute w-2 h-2 rounded-full bg-red-400/35" style={{ top: '18px', right: '-2px' }} />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-esi-success/45" style={{ top: '0px', left: '6px' }} />
            <span className="absolute w-2 h-2 rounded-full bg-brand-indigo/25" style={{ bottom: '6px', right: '4px' }} />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-red-300/40" style={{ bottom: '2px', left: '8px' }} />
          </div>
          {/* Check icon — 60px container */}
          <div
            className="w-[60px] h-[60px] rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(22,163,74,0.11)',
              border: '2px solid rgba(22,163,74,0.30)',
              boxShadow: '0 0 0 8px rgba(22,163,74,0.06), 0 6px 24px rgba(22,163,74,0.20)',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-esi-success" aria-hidden="true">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <h1 className="text-[28px] md:text-[34px] font-bold text-on-surface tracking-[-0.02em] font-display mb-2">
          Assessment Complete!
        </h1>
        <p className="text-[14px] md:text-[15px] text-on-surface-variant font-body leading-relaxed max-w-[520px]">
          Here's your personalized health guidance based on your symptoms.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CARD 1 — YOUR ASSESSMENT RESULT (risk level)
          ══════════════════════════════════════════════════════════════════════ */}
      <GlassCard
        className="px-6 py-6 md:px-8 md:py-7"
        style={{
          background: riskConfig.cardBg,
          border: `1px solid ${riskConfig.cardBorder}`,
          borderRadius: '20px',
          boxShadow: '0 6px 32px rgba(88,86,214,0.08), 0 2px 10px rgba(30,31,59,0.05)',
        }}
      >
        {/* Top row: eyebrow + status pill */}
        <div className="flex items-start justify-between mb-5">
          <p className="text-[11px] font-semibold tracking-[0.13em] uppercase text-on-surface-variant/65 font-display">
            Your Assessment Result
          </p>
          {/* Risk pill */}
          <span
            className="flex-shrink-0 flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full font-display ml-3"
            style={{ background: riskConfig.pillBg, color: riskConfig.pillText, border: `1px solid ${riskConfig.pillBorder}` }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: riskConfig.pillText }} />
            {riskConfig.label}
          </span>
        </div>

        {/* Icon + risk heading row */}
        <div className="flex items-center gap-4 mb-3">
          <div
            className="flex-shrink-0 w-12 h-12 rounded-[14px] flex items-center justify-center"
            style={{ background: riskConfig.iconBg, border: `1.5px solid ${riskConfig.iconBorder}`, color: riskConfig.iconColor }}
          >
            <IconShield />
          </div>
          <h2
            className="text-[30px] md:text-[36px] font-bold leading-none tracking-[-0.025em] font-display"
            style={{ color: riskConfig.iconColor }}
          >
            {riskConfig.label}
          </h2>
        </div>

        {/* Description */}
        <p className="text-[14px] text-on-surface-variant font-body leading-relaxed">
          {riskConfig.description}
        </p>
      </GlassCard>

      {/* ══════════════════════════════════════════════════════════════════════
          CARD 2 — YOUR SYMPTOMS
          Renders only when matched_symptoms is a non-empty array — UNCHANGED
          sym.replace(/_/g, ' ') preserved
          ══════════════════════════════════════════════════════════════════════ */}
      {Array.isArray(assessment.matched_symptoms) && assessment.matched_symptoms.length > 0 && (
        <SectionCard
          icon={<IconSymptoms />}
          iconBg={indigoIconBg}
          iconBorder={indigoIconBorder}
          iconColor={indigoIconColor}
          title="Your Symptoms"
        >
          <p className="text-[15px] font-semibold text-on-surface font-display mb-1 leading-snug">
            {assessment.matched_symptoms.map((sym) => sym.replace(/_/g, ' ')).join(', ')}
          </p>
          <p className="text-[13px] text-on-surface-variant font-body">
            These are the main symptoms you reported.
          </p>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CARD 3 — POSSIBLE CONDITION
          condition_pattern — UNCHANGED, no description invented
          ══════════════════════════════════════════════════════════════════════ */}
      {assessment.condition_pattern && (
        <SectionCard
          icon={<IconCondition />}
          iconBg={indigoIconBg}
          iconBorder={indigoIconBorder}
          iconColor={indigoIconColor}
          title="Possible Condition"
        >
          <p className="text-[15px] font-semibold text-on-surface font-display leading-snug">
            {assessment.condition_pattern}
          </p>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CARD 4 — RECOMMENDATIONS
          Renders only when recommendations is non-empty — UNCHANGED
          ══════════════════════════════════════════════════════════════════════ */}
      {Array.isArray(assessment.recommendations) && assessment.recommendations.length > 0 && (
        <SectionCard
          icon={<IconRec />}
          iconBg={indigoIconBg}
          iconBorder={indigoIconBorder}
          iconColor={indigoIconColor}
          title="Recommendations"
        >
          <ul className="space-y-2">
            {assessment.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] font-body text-on-surface">
                <span className="flex-shrink-0 mt-0.5 text-brand-indigo font-bold text-[15px] leading-none">•</span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CARD 5 — PREVENTION TIPS
          Renders only when prevention_tips is non-empty — UNCHANGED
          ══════════════════════════════════════════════════════════════════════ */}
      {Array.isArray(assessment.prevention_tips) && assessment.prevention_tips.length > 0 && (
        <SectionCard
          icon={<IconPrevention />}
          iconBg={indigoIconBg}
          iconBorder={indigoIconBorder}
          iconColor={indigoIconColor}
          title="Prevention Tips"
        >
          <ul className="space-y-2">
            {assessment.prevention_tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] font-body text-on-surface">
                <span className="flex-shrink-0 mt-0.5 text-esi-success font-bold text-[15px] leading-none">•</span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CARD 6 — FOLLOW UP
          follow_up_date?.toDate() — UNCHANGED
          No invented text — shows the actual follow-up date cleanly
          ══════════════════════════════════════════════════════════════════════ */}
      {assessment.follow_up_date && (
        <SectionCard
          icon={<IconFollowUp />}
          iconBg={indigoIconBg}
          iconBorder={indigoIconBorder}
          iconColor={indigoIconColor}
          title="Follow Up"
        >
          <p className="text-[14px] font-body text-on-surface leading-relaxed">
            Suggested follow-up date:{' '}
            <span className="font-semibold">
              {(assessment.follow_up_date?.toDate
                ? assessment.follow_up_date.toDate()
                : new Date(assessment.follow_up_date)
              ).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </p>
          <p className="text-[13px] text-on-surface-variant font-body mt-1.5 leading-relaxed">
            If your symptoms persist or worsen, please consult a healthcare professional.
          </p>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CARD 7 — GOVERNMENT BENEFITS & RESOURCES
          Renders only when government_resources is non-empty — UNCHANGED
          All fields: scheme_name, benefit, eligibility_note, link — UNCHANGED
          ══════════════════════════════════════════════════════════════════════ */}
      {Array.isArray(assessment.government_resources) && assessment.government_resources.length > 0 && (
        <SectionCard
          icon={<IconGov />}
          iconBg={indigoIconBg}
          iconBorder={indigoIconBorder}
          iconColor={indigoIconColor}
          title="Government Benefits & Resources"
        >
          <div className="space-y-3 mt-1">
            {assessment.government_resources.map((scheme, i) => (
              <div key={i} className="rounded-[12px] px-3 py-3"
                style={{ background: 'rgba(88,86,214,0.04)', border: '1px solid rgba(88,86,214,0.10)' }}>
                <p className="text-[13px] font-bold text-on-surface font-display mb-1">{scheme.scheme_name}</p>
                <p className="text-[12px] text-on-surface-variant font-body leading-relaxed mb-1">{scheme.benefit}</p>
                {scheme.eligibility_note && (
                  <p className="text-[11px] text-on-surface-variant/70 font-body italic mb-1">
                    Eligibility: {scheme.eligibility_note}
                  </p>
                )}
                {scheme.link && (
                  <a href={scheme.link} target="_blank" rel="noopener noreferrer"
                    className="text-[12px] text-brand-indigo font-body hover:underline">
                    Learn more →
                  </a>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          BOTTOM ACTION ROW — primary 3-button layout matching reference
          Back to Home   /   View History   /   Find Care Near You →
          All routes are existing Arogya360 routes:
            navigate('/home')    → existing /home route
            navigate('/history') → existing /history route
            navigate('/home')    → Find Care lives on the Home page
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row gap-3 pt-3">
        {/* Back to Home */}
        <button
          type="button"
          onClick={() => navigate('/home')}
          className={[
            'flex-1 h-[52px] flex items-center justify-center gap-2',
            'rounded-2xl px-5',
            'text-[13px] font-semibold text-on-surface-variant font-display',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-indigo/30',
            'hover:text-on-surface hover:shadow-md',
          ].join(' ')}
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1.5px solid rgba(200,200,220,0.60)',
            boxShadow: '0 2px 12px rgba(30,31,59,0.07)',
          }}
        >
          <IconHome />
          Back to Home
        </button>

        {/* View History */}
        <button
          type="button"
          onClick={() => navigate('/history')}
          className={[
            'flex-1 h-[52px] flex items-center justify-center gap-2',
            'rounded-2xl px-5',
            'text-[13px] font-semibold text-on-surface-variant font-display',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-indigo/30',
            'hover:text-on-surface hover:shadow-md',
          ].join(' ')}
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1.5px solid rgba(200,200,220,0.60)',
            boxShadow: '0 2px 12px rgba(30,31,59,0.07)',
          }}
        >
          <IconHistory />
          View History
        </button>

        {/* Find Care Near You — navigates to /home where Find Care section exists */}
        <button
          type="button"
          onClick={() => navigate('/home')}
          className={[
            'flex-1 h-[52px] flex items-center justify-center gap-2',
            'rounded-2xl px-5',
            'text-[14px] font-semibold text-white font-display',
            'bg-[linear-gradient(135deg,#706DF2_0%,#5856D6_100%)]',
            'shadow-[0_6px_20px_rgba(88,86,214,0.38),inset_0_1px_1px_rgba(255,255,255,0.35)]',
            'hover:brightness-[1.05] hover:shadow-[0_8px_26px_rgba(88,86,214,0.48)]',
            'active:scale-[0.98]',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 focus:ring-offset-1',
          ].join(' ')}
        >
          <IconLocation />
          Find Care Near You
          <IconArrowRight />
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECONDARY ACTIONS — PDF + WhatsApp (handlers UNCHANGED)
          Kept as secondary row, less prominent than the primary nav row
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SecondaryButton onClick={handleDownloadPDF} className="flex-1">
          Download PDF
        </SecondaryButton>
        <PrimaryButton onClick={handleWhatsAppShare} className="flex-1">
          Share via WhatsApp
        </PrimaryButton>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DOCTOR SUMMARY — secure QR share panel
          assessmentId comes from useParams() above — UNCHANGED route param
          ══════════════════════════════════════════════════════════════════════ */}
      <DoctorSummaryPanel assessmentId={assessmentId} />

      {/* Disclaimer */}
      <p className="text-[11px] text-on-surface-variant/50 text-center font-body pb-2 leading-relaxed">
        This assessment is for informational guidance only and does not constitute
        medical advice. Always consult a qualified healthcare professional.
      </p>
    </div>
  );
};

export default Result;
