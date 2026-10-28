import { useState, useEffect } from 'react';
import axios from '../../config/axios';
import 'remixicon/fonts/remixicon.css';

const TEMPLATES = [
  {
    id: 'STANDARD_100',
    name: 'SIT Standard Semester End Exam (100 Marks, 5 Units with Internal Choice)',
    totalMarks: 100,
    durationMinutes: 180,
    description: '5 Units, 2 questions per unit with internal choice (OR), 20 marks per unit.'
  },
  {
    id: 'MID_SEM_50',
    name: 'SIT Mid-Semester Assessment (50 Marks)',
    totalMarks: 50,
    durationMinutes: 90,
    description: 'Part A (Compulsory 2 x 5M) + Part B (Answer 2 of 3 x 20M).'
  },
  {
    id: 'FLEXIBLE_50',
    name: 'Model Question Paper (50 Marks, 5 x 10M)',
    totalMarks: 50,
    durationMinutes: 120,
    description: '5 questions chosen from each unit, 10 marks each.'
  }
];

const PYQSamplePaper = ({ existingSubjects = [] }) => {
  // Configuration State
  const [subject, setSubject] = useState('');
  const [templateId, setTemplateId] = useState('STANDARD_100');
  const [paperTitle, setPaperTitle] = useState('B.E. Semester End Model Examination');
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [requireCOCoverage, setRequireCOCoverage] = useState(false);
  const [difficultyPreference, setDifficultyPreference] = useState('Balanced');

  // Generator & Paper State
  const [generatedPaper, setGeneratedPaper] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [replacingKey, setReplacingKey] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isErrorToast, setIsErrorToast] = useState(false);
  const [showOutcomeDetails, setShowOutcomeDetails] = useState(true);

  // Saved Papers State
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedPapers, setSavedPapers] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Set default subject
  useEffect(() => {
    if (existingSubjects.length > 0 && !subject) {
      setSubject(existingSubjects[0].name);
    }
  }, [existingSubjects]);

  const showToast = (msg, isErr = false) => {
    setToastMessage(msg);
    setIsErrorToast(isErr);
    setTimeout(() => setToastMessage(''), 6000);
  };

  // Handle template selection
  const handleTemplateChange = (id) => {
    setTemplateId(id);
    const tmpl = TEMPLATES.find(t => t.id === id);
    if (tmpl) {
      setDurationMinutes(tmpl.durationMinutes);
    }
  };

  // Generate Sample Paper
  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!subject) {
      showToast('Please select a target subject', true);
      return;
    }

    setIsGenerating(true);
    setGenerationError('');
    try {
      const selectedTmpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
      const payload = {
        subject,
        title: paperTitle,
        duration: `${durationMinutes} Minutes`,
        totalMarks: selectedTmpl.totalMarks,
        requireCOCoverage: Boolean(requireCOCoverage),
        seed: Math.floor(Math.random() * 1000000),
        difficultyDistribution: difficultyPreference === 'Balanced'
          ? { Easy: 30, Medium: 50, Hard: 20 }
          : difficultyPreference === 'Easy-Leaning'
          ? { Easy: 50, Medium: 40, Hard: 10 }
          : { Easy: 10, Medium: 50, Hard: 40 }
      };

      const res = await axios.post('/pyq/sample-paper/generate', payload);
      if (res.data?.samplePaper) {
        setGeneratedPaper(res.data.samplePaper);
        setGenerationError('');
        showToast('University Sample Paper generated successfully!');
      } else {
        showToast('Failed to generate sample paper', true);
      }
    } catch (err) {
      console.error('Sample Paper generation error:', err);
      const apiErr = err.response?.data?.error || err.response?.data?.message || 'Failed to generate sample paper';
      setGenerationError(apiErr);
      showToast(apiErr, true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Replace an individual question
  const handleReplaceQuestion = async (sectionIndex, questionIndex) => {
    if (!generatedPaper) return;
    const key = `${sectionIndex}-${questionIndex}`;
    setReplacingKey(key);
    try {
      const res = await axios.post('/pyq/sample-paper/replace-question', {
        paperData: generatedPaper,
        sectionIndex,
        questionIndex
      });

      if (res.data?.samplePaper) {
        setGeneratedPaper(res.data.samplePaper);
        showToast('Question successfully replaced with alternative from repository!');
      } else {
        showToast('No additional alternative question found in bank matching this unit', true);
      }
    } catch (err) {
      console.error('Question replacement error:', err);
      showToast(err.response?.data?.error || 'Could not replace question', true);
    } finally {
      setReplacingKey(null);
    }
  };

  // Save generated sample paper to dedicated collection
  const handleSavePaper = async () => {
    if (!generatedPaper) return;
    setIsSaving(true);
    try {
      const res = await axios.post('/pyq/sample-paper/save', {
        samplePaper: generatedPaper
      });

      if (res.data?.samplePaper) {
        showToast('Sample paper saved to your dedicated collection!');
      } else {
        showToast('Failed to save paper', true);
      }
    } catch (err) {
      console.error('Save paper error:', err);
      showToast(err.response?.data?.error || 'Failed to save paper', true);
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch saved papers
  const fetchSavedPapers = async () => {
    setLoadingSaved(true);
    try {
      const res = await axios.get('/pyq/sample-paper/saved');
      setSavedPapers(res.data?.samplePapers || []);
    } catch (err) {
      console.error('Fetch saved papers error:', err);
      showToast('Could not load saved papers', true);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleOpenSavedModal = () => {
    setShowSavedModal(true);
    fetchSavedPapers();
  };

  const handleLoadSavedPaper = (paper) => {
    setGeneratedPaper(paper);
    setSubject(paper.subject);
    setShowSavedModal(false);
    showToast(`Loaded saved paper: "${paper.title || paper.subject}"`);
  };

  const handleDeleteSavedPaper = async (id) => {
    if (!window.confirm('Are you sure you want to delete this saved paper?')) return;
    try {
      await axios.delete(`/pyq/sample-paper/${id}`);
      setSavedPapers(prev => prev.filter(p => p._id !== id));
      showToast('Sample paper deleted successfully');
    } catch (err) {
      console.error('Delete paper error:', err);
      showToast('Failed to delete paper', true);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isSubjectLackingOBE = subject && subject.toLowerCase().includes('operating systems');
  const outcomeStatus = generatedPaper?.coverageSummary?.outcomeDataStatus;

  return (
    <div className="space-y-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border text-white animate-fade-in max-w-md print:hidden ${
          isErrorToast ? 'bg-rose-950 border-rose-700' : 'bg-slate-900 border-slate-700'
        }`}>
          <i className={`text-xl flex-shrink-0 ${
            isErrorToast ? 'ri-error-warning-fill text-rose-400' : 'ri-checkbox-circle-fill text-emerald-400'
          }`}></i>
          <span className="font-medium text-xs leading-relaxed">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner (Hidden in Print) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl border border-indigo-900/50 print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-3 border border-indigo-500/30">
              <i className="ri-file-paper-2-line"></i> Examination Blueprint Engine
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              Sample Paper Generator
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Generate university-standard examination papers with constraint-based question selection across units, mark distributions, difficulty calibration, and authentic outcome mappings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenSavedModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/15 transition-all shadow-sm"
            >
              <i className="ri-archive-line text-sm"></i>
              Saved Papers
            </button>
          </div>
        </div>
      </div>

      {/* Blueprint Configuration Panel (Hidden in Print) */}
      <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200 print:hidden space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i className="ri-sound-module-line text-indigo-600 text-xl"></i>
              Blueprint Configuration & Constraints
            </h3>
            <p className="text-xs text-slate-500">Configure examination template, subject, duration, and outcome quotas</p>
          </div>
          <span className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100">
            SIT Autonomous Schema
          </span>
        </div>

        <form onSubmit={handleGenerate} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Subject Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Target Subject *
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {existingSubjects.map((sub, i) => (
                  <option key={i} value={sub.name}>{sub.name}</option>
                ))}
              </select>
            </div>

            {/* Template Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Examination Template *
              </label>
              <select
                value={templateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Paper Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Examination Title
              </label>
              <input
                type="text"
                value={paperTitle}
                onChange={(e) => setPaperTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="e.g. End Semester Theory Examination"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Duration (Minutes)
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 180)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="180"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Difficulty Calibration */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Difficulty Calibration
              </label>
              <select
                value={difficultyPreference}
                onChange={(e) => setDifficultyPreference(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="Balanced">Balanced (Standard 30% Easy, 50% Medium, 20% Hard)</option>
                <option value="Easy-Leaning">Easy-Leaning (50% Easy, 40% Medium, 10% Hard)</option>
                <option value="Hard-Leaning">Rigorous (10% Easy, 50% Medium, 40% Hard)</option>
              </select>
            </div>

            {/* Mandatory CO/PO Quotas Checkbox */}
            <div className="flex flex-col justify-center">
              <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={requireCOCoverage}
                  onChange={(e) => setRequireCOCoverage(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Enforce Mandatory CO/PO Coverage Quotas
                  </span>
                  <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                    Requires verified CO1–CO5 outcomes across assembled questions. Keep unchecked for subjects whose historical archives predate OBE.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Academic Integrity Notice for Operating Systems */}
          {isSubjectLackingOBE && (
            <div className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
              requireCOCoverage
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <i className={`text-lg flex-shrink-0 ${
                requireCOCoverage ? 'ri-alert-line text-rose-600' : 'ri-information-line text-amber-600'
              }`}></i>
              <div>
                <p className="font-bold">
                  Historical Outcome Status: Operating Systems Archive
                </p>
                <p className="mt-0.5 leading-relaxed text-[11px]">
                  {requireCOCoverage ? (
                    <span>
                      <strong>Warning:</strong> Verified examination papers in the OS repository (e.g. 2011, 2020) pre-date Outcome-Based Education (OBE) and do not contain printed CO/PO mappings. Because our system adheres to academic integrity and never fabricates artificial mappings, enforcing mandatory CO quotas will reject generation. Uncheck &quot;Enforce Mandatory CO/PO Coverage Quotas&quot; to generate an authentic OS paper based on Units, Marks, and Difficulty.
                    </span>
                  ) : (
                    <span>
                      Operating Systems papers in our repository pre-date Outcome Based Education (OBE). Paper generation will satisfy all Unit, Question, and Marks constraints authentically without inventing artificial CO tags.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Validation / Generation Error Banner */}
          {generationError && (
            <div className="p-4 rounded-2xl text-xs flex items-start gap-3 border bg-rose-50 border-rose-200 text-rose-800">
              <i className="ri-error-warning-fill text-lg text-rose-600 flex-shrink-0 mt-0.5"></i>
              <div className="space-y-1">
                <p className="font-bold">Blueprint Constraint Violation</p>
                <p className="text-[11px] leading-relaxed">{generationError}</p>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-base"></i>
                  <span>Selecting Blueprint-Compliant Questions...</span>
                </>
              ) : (
                <>
                  <i className="ri-magic-line text-base"></i>
                  <span>Generate University Sample Paper</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Paper View */}
      {generatedPaper && (
        <div className="space-y-6">
          {/* Action Toolbar (Hidden in Print) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Display Options:</span>
              <button
                onClick={() => setShowOutcomeDetails(!showOutcomeDetails)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  showOutcomeDetails ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <i className="ri-price-tag-3-line mr-1"></i>
                {showOutcomeDetails ? 'Hide OBE Metadata' : 'Show CO/PO/Bloom Tags'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                title="Regenerate with alternative questions"
              >
                <i className="ri-refresh-line"></i>
                Regenerate
              </button>

              <button
                onClick={handleSavePaper}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                <i className="ri-save-3-line"></i>
                {isSaving ? 'Saving...' : 'Save Paper'}
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
              >
                <i className="ri-printer-line"></i>
                Print / Export PDF
              </button>
            </div>
          </div>

          {/* Outcome Status Banner (Hidden in Print) */}
          <div className={`p-4 rounded-2xl text-xs flex items-center justify-between border print:hidden ${
            outcomeStatus === 'NO_OBE_METADATA_IN_SOURCE'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <div className="flex items-center gap-2.5">
              <i className={`text-xl ${
                outcomeStatus === 'NO_OBE_METADATA_IN_SOURCE'
                  ? 'ri-information-line text-amber-600'
                  : 'ri-checkbox-circle-line text-emerald-600'
              }`}></i>
              <div>
                <span className="font-bold block">
                  {outcomeStatus === 'NO_OBE_METADATA_IN_SOURCE'
                    ? 'Historical Outcome Status: Unmapped Historical Papers'
                    : 'Verified OBE Outcome Coverage Satisfied'}
                </span>
                <span className="text-[11px] text-slate-600">
                  {outcomeStatus === 'NO_OBE_METADATA_IN_SOURCE'
                    ? 'This subject contains authentic examination papers that predate OBE. Questions are constraint-satisfied on Units, Marks, and Difficulty without fabricated outcomes.'
                    : 'All assembled questions contain verified Course Outcomes, Program Outcomes, and Bloom taxonomy levels.'}
                </span>
              </div>
            </div>

            {/* Quick CO Badges */}
            {generatedPaper.coverageSummary?.coCoverage && (
              <div className="hidden sm:flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">COs:</span>
                {Object.keys(generatedPaper.coverageSummary.coCoverage).map(co => (
                  <span key={co} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    {co}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* FORMAL UNIVERSITY EXAMINATION QUESTION PAPER CONTAINER   */}
          {/* ======================================================== */}
          <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-md border border-slate-300 print:border-none print:shadow-none print:p-0 text-slate-900 font-serif">
            {/* University Header */}
            <div className="text-center pb-6 border-b-2 border-slate-800 space-y-1">
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900 font-sans">
                {generatedPaper.institution || 'Siddaganga Institute of Technology, Tumakuru'}
              </h3>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 font-sans">
                (An Autonomous Institution, Affiliated to Visvesvaraya Technological University, Belagavi)
              </p>
              <h4 className="text-sm sm:text-base font-bold text-slate-800 pt-1 font-sans">
                {generatedPaper.title}
              </h4>
              <p className="text-xs font-bold text-slate-700 font-sans">
                Degree: {generatedPaper.degree} • Branch: {generatedPaper.branch}
              </p>
            </div>

            {/* Meta Table */}
            <div className="py-4 border-b border-slate-400 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-sans">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Course Name</span>
                <span className="font-bold text-slate-900">{generatedPaper.subject}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Course Code</span>
                <span className="font-bold text-slate-900">{generatedPaper.subjectCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Duration</span>
                <span className="font-bold text-slate-900">{generatedPaper.duration}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Maximum Marks</span>
                <span className="font-bold text-slate-900">{generatedPaper.totalMarks} Marks</span>
              </div>
            </div>

            {/* Questions Body */}
            <div className="pt-6 space-y-8 font-sans">
              {generatedPaper.sections?.map((sec, sIdx) => (
                <div key={sIdx} className="space-y-4">
                  {/* Section Title & Instructions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1.5 border-b border-slate-200 gap-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                      {sec.name}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 italic">
                      {sec.instructions}
                    </span>
                  </div>

                  {/* Questions in Section */}
                  <div className="space-y-3">
                    {sec.questions?.map((q, qIdx) => {
                      const isReplacing = replacingKey === `${sIdx}-${qIdx}`;

                      return (
                        <div key={qIdx} className="space-y-3">
                          {/* Internal Choice OR separator if not first question */}
                          {qIdx > 0 && (
                            <div className="text-center font-bold text-xs uppercase tracking-widest text-slate-400 font-sans my-2">
                              [ OR ]
                            </div>
                          )}

                          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2 relative group print:bg-transparent print:border-none print:p-1">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-start gap-2">
                                  <span className="font-bold text-xs text-slate-900 flex-shrink-0">
                                    Q{q.questionNumber || (qIdx + 1)}.
                                  </span>
                                  <p className="text-xs font-medium text-slate-900 leading-relaxed">
                                    {q.question}
                                  </p>
                                </div>

                                {/* Metadata Tags */}
                                {showOutcomeDetails && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1 pl-6 print:hidden">
                                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold">
                                      {q.marks}M
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold">
                                      {q.difficulty}
                                    </span>
                                    {q.courseOutcomes?.length > 0 && (
                                      <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-bold">
                                        {q.courseOutcomes.join(', ')}
                                      </span>
                                    )}
                                    {q.bloomLevel && (
                                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded text-[9px] font-bold">
                                        Bloom: {q.bloomLevel}
                                      </span>
                                    )}
                                    {q.unit && (
                                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px]">
                                        {q.unit}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Marks & Replace Button */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-bold text-slate-800">
                                  ({q.marks})
                                </span>
                                <button
                                  onClick={() => handleReplaceQuestion(sIdx, qIdx)}
                                  disabled={isReplacing}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100 print:hidden"
                                  title="Replace this question with another from repository"
                                >
                                  <i className={`ri-refresh-line text-sm ${isReplacing ? 'animate-spin text-indigo-600' : ''}`}></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* University Footer */}
            <div className="text-center pt-10 mt-10 border-t border-slate-300 text-xs font-bold text-slate-500 uppercase tracking-widest font-sans">
              *** End of Question Paper ***
            </div>
          </div>
        </div>
      )}

      {/* Saved Papers Modal */}
      {showSavedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i className="ri-archive-line text-indigo-600"></i>
                Saved Examination Papers
              </h3>
              <button
                onClick={() => setShowSavedModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {loadingSaved ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <i className="ri-loader-4-line animate-spin text-2xl mb-2 block text-indigo-600"></i>
                  Loading your saved papers...
                </div>
              ) : savedPapers.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No saved examination papers found. Generate a paper and click &quot;Save Paper&quot;.
                </div>
              ) : (
                savedPapers.map((paper) => (
                  <div
                    key={paper._id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {paper.title || paper.subject}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {paper.subject} • {paper.totalMarks} Marks • {paper.duration}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Saved: {new Date(paper.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoadSavedPaper(paper)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteSavedPaper(paper._id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Delete paper"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PYQSamplePaper;
