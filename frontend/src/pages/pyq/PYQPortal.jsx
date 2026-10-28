import { useState, useEffect } from 'react';
import axios from '../../config/axios';
import 'remixicon/fonts/remixicon.css';

const PYQPortal = ({ onQuestionAdded, existingSubjects = [] }) => {
  const [portalMode, setPortalMode] = useState('single'); // 'single', 'bulk', 'manage'
  const [toastMessage, setToastMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [portalStats, setPortalStats] = useState({
    totalQuestions: 0,
    totalSubjects: 0,
    totalPredicted: 0,
    totalIntroduced: 0
  });

  // Single Question Form State
  const [formData, setFormData] = useState({
    subject: '',
    customSubject: '',
    subjectCode: '',
    year: new Date().getFullYear(),
    examType: 'End-Sem',
    question: '',
    questionNumber: '',
    questionType: 'Subjective',
    marks: 10,
    unit: 'Unit 1',
    topic: '',
    difficulty: 'Medium',
    courseOutcomes: [],
    bloomLevel: '',
    solution: '',
    tags: ''
  });

  // Duplicate Detection & Validation State
  const [duplicateResult, setDuplicateResult] = useState(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [confirmedDistinct, setConfirmedDistinct] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Bulk Ingestion State
  const [bulkInput, setBulkInput] = useState('');
  const [parsedBulkQuestions, setParsedBulkQuestions] = useState([]);
  const [bulkError, setBulkError] = useState('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  // Managed Introduced Questions List
  const [managedQuestions, setManagedQuestions] = useState([]);
  const [loadingManaged, setLoadingManaged] = useState(false);
  const [managedSearch, setManagedSearch] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Fetch Portal Stats
  const fetchPortalStats = async () => {
    try {
      const res = await axios.get('/pyq/subjects');
      if (res.data?.stats) {
        setPortalStats(res.data.stats);
      }
    } catch (err) {
      console.error('Error fetching portal stats:', err);
    }
  };

  // Fetch Introduced Questions for Management
  const fetchManagedQuestions = async () => {
    setLoadingManaged(true);
    try {
      const res = await axios.get('/pyq', {
        params: { search: managedSearch }
      });
      setManagedQuestions(res.data.pyqs || []);
    } catch (err) {
      console.error('Error fetching managed questions:', err);
    } finally {
      setLoadingManaged(false);
    }
  };

  useEffect(() => {
    fetchPortalStats();
  }, []);

  useEffect(() => {
    if (portalMode === 'manage') {
      fetchManagedQuestions();
    }
  }, [portalMode, managedSearch]);

  // Set default subject if available
  useEffect(() => {
    if (existingSubjects.length > 0 && !formData.subject) {
      setFormData(prev => ({ ...prev, subject: existingSubjects[0].name }));
    }
  }, [existingSubjects]);

  // Check for duplicates before submission (Read-only)
  const handleCheckDuplicate = async () => {
    const finalSubject = formData.subject === 'Custom' ? formData.customSubject.trim() : formData.subject.trim();
    const errors = [];
    if (!finalSubject) errors.push('Please specify a subject name.');
    if (!formData.question.trim()) {
      errors.push('Question statement is required.');
    } else if (formData.question.trim().length < 15) {
      errors.push('Question statement must be at least 15 characters long.');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      showToast(errors[0]);
      return null;
    }

    setValidationErrors([]);
    setIsCheckingDuplicate(true);
    try {
      const res = await axios.post('/pyq/check-duplicate', {
        subject: finalSubject,
        question: formData.question.trim(),
        year: parseInt(formData.year) || new Date().getFullYear(),
        marks: parseInt(formData.marks) || 5,
        unit: formData.unit.trim(),
        topic: formData.topic.trim(),
        difficulty: formData.difficulty
      });

      setDuplicateResult(res.data);
      if (res.data.status === 'EXACT_DUPLICATE') {
        showToast('⚠️ Exact duplicate detected in question bank!');
      } else if (res.data.status === 'LIKELY_NEAR_DUPLICATE') {
        showToast('🔍 Potential near-duplicate(s) detected. Please review matches.');
      } else {
        showToast('✅ Question verified unique! Ready to submit.');
      }
      return res.data;
    } catch (err) {
      console.error('Error checking duplicate:', err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to check duplicates';
      showToast(errMsg);
      if (err.response?.data?.validationErrors) {
        setValidationErrors(err.response.data.validationErrors);
      }
      return null;
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  // Handle Single Question Submission
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    const finalSubject = formData.subject === 'Custom' ? formData.customSubject.trim() : formData.subject.trim();

    if (!finalSubject) {
      showToast('Please specify a subject name');
      return;
    }

    if (!formData.question.trim() || formData.question.trim().length < 15) {
      showToast('Question statement must be at least 15 characters long');
      return;
    }

    // Step: Run duplicate check if student hasn't clicked check yet
    let dupCheck = duplicateResult;
    if (!dupCheck) {
      dupCheck = await handleCheckDuplicate();
      if (!dupCheck) return; // Validation error
    }

    if (dupCheck.status === 'EXACT_DUPLICATE') {
      showToast('❌ Cannot submit: Exact duplicate already exists in the question bank.');
      return;
    }

    if (dupCheck.status === 'LIKELY_NEAR_DUPLICATE' && !confirmedDistinct) {
      showToast('⚠️ Please review potential duplicates and confirm distinction before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        subject: finalSubject,
        subjectCode: formData.subjectCode.trim(),
        year: parseInt(formData.year) || new Date().getFullYear(),
        examType: formData.examType,
        question: formData.question.trim(),
        questionNumber: formData.questionNumber.trim(),
        questionType: formData.questionType,
        marks: parseInt(formData.marks) || 5,
        unit: formData.unit.trim(),
        topic: formData.topic.trim() || 'General',
        difficulty: formData.difficulty,
        courseOutcomes: formData.courseOutcomes,
        bloomLevel: formData.bloomLevel || undefined,
        solution: formData.solution.trim(),
        tags: formData.tags,
        confirmedDistinct
      };

      const res = await axios.post('/pyq/introduce', payload);
      showToast(res.data?.message || 'Question submitted for review! (Status: PENDING)');

      // Reset form state
      setFormData(prev => ({
        ...prev,
        question: '',
        questionNumber: '',
        solution: '',
        topic: '',
        courseOutcomes: [],
        bloomLevel: '',
        tags: ''
      }));
      setDuplicateResult(null);
      setConfirmedDistinct(false);
      setValidationErrors([]);

      fetchPortalStats();
      if (onQuestionAdded) onQuestionAdded();
    } catch (err) {
      console.error('Error introducing question:', err);
      const data = err.response?.data;
      if (data?.status === 'EXACT_DUPLICATE') {
        setDuplicateResult({
          status: 'EXACT_DUPLICATE',
          isDuplicate: true,
          message: data.error,
          matches: data.matches || []
        });
        showToast('❌ Exact duplicate detected in bank.');
      } else if (data?.status === 'LIKELY_NEAR_DUPLICATE') {
        setDuplicateResult({
          status: 'LIKELY_NEAR_DUPLICATE',
          requiresReview: true,
          message: data.error,
          matches: data.matches || []
        });
        showToast('⚠️ Likely near-duplicate found. Confirmation required.');
      } else {
        showToast(data?.error || 'Failed to introduce question');
        if (data?.validationErrors) setValidationErrors(data.validationErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Template for Bulk Questions
  const loadBulkSampleTemplate = () => {
    const template = [
      {
        "subject": "Operating Systems",
        "subjectCode": "CS401",
        "year": 2024,
        "examType": "End-Sem",
        "question": "Explain the four necessary conditions for deadlock. How can deadlock prevention break each condition?",
        "marks": 10,
        "unit": "Unit 3",
        "topic": "Deadlock Characterization",
        "difficulty": "Medium",
        "solution": "1. Mutual Exclusion: At least one resource must be held in non-shareable mode.\n2. Hold and Wait: Process holds resources while requesting more.\n3. No Preemption: Resources cannot be forcibly taken.\n4. Circular Wait: Closed chain of processes waiting for each other.\n\nPrevention breaks circular wait via resource ordering.",
        "tags": ["Deadlock", "Operating Systems", "Conditions"]
      },
      {
        "subject": "Database Management Systems",
        "subjectCode": "CS402",
        "year": 2024,
        "examType": "End-Sem",
        "question": "What is the difference between Dense Index and Sparse Index in file organization? Give diagrams and compare search costs.",
        "marks": 8,
        "unit": "Unit 5",
        "topic": "File Indexing",
        "difficulty": "Easy",
        "solution": "Dense Index has an index entry for EVERY search key in the file.\nSparse Index has index entries for only some records (usually block anchors).\nSparse indices consume less memory but require block searching.",
        "tags": ["DBMS", "Indexing", "Dense", "Sparse"]
      }
    ];

    setBulkInput(JSON.stringify(template, null, 2));
    setParsedBulkQuestions(template);
    setBulkError('');
  };

  // Parse bulk input
  const handleParseBulk = () => {
    setBulkError('');
    try {
      const parsed = JSON.parse(bulkInput);
      if (!Array.isArray(parsed)) {
        throw new Error('Bulk payload must be a JSON array of question objects.');
      }
      if (parsed.length === 0) {
        throw new Error('JSON array is empty.');
      }
      setParsedBulkQuestions(parsed);
      showToast(`✅ Successfully parsed ${parsed.length} questions ready for introduction.`);
    } catch (err) {
      setBulkError(err.message || 'Invalid JSON syntax. Click "Load Sample Template" to view correct format.');
      setParsedBulkQuestions([]);
    }
  };

  // Submit Bulk Questions
  const handleBulkSubmit = async () => {
    if (parsedBulkQuestions.length === 0) {
      showToast('Please parse valid questions first.');
      return;
    }

    setIsBulkSubmitting(true);
    try {
      const res = await axios.post('/pyq/bulk-introduce', {
        questions: parsedBulkQuestions
      });

      showToast(`🚀 ${res.data?.count || parsedBulkQuestions.length} questions introduced into the PYQ Bank!`);
      setBulkInput('');
      setParsedBulkQuestions([]);
      fetchPortalStats();
      if (onQuestionAdded) onQuestionAdded();
    } catch (err) {
      console.error('Error submitting bulk questions:', err);
      showToast(err.response?.data?.error || 'Failed to submit batch');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // Delete Question from Portal
  const handleDeleteQuestion = async (id) => {
    if (!window.confirm('Are you sure you want to delete this question from the bank?')) return;
    try {
      await axios.delete(`/pyq/${id}`);
      showToast('Question deleted from bank');
      fetchManagedQuestions();
      fetchPortalStats();
      if (onQuestionAdded) onQuestionAdded();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete question');
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <i className="ri-checkbox-circle-fill text-emerald-400 text-xl"></i>
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Portal Header & Quick Metrics */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl border border-indigo-900/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-3 border border-indigo-500/30">
              <i className="ri-inbox-archive-line"></i> Question Ingestion & Management
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              PYQ Introduction Portal
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Introduce verified university previous year questions, answer solutions, marking rubrics, and examination patterns directly into the repository.
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
              <span className="text-2xl font-black text-indigo-300 block">{portalStats.totalQuestions}</span>
              <span className="text-[11px] font-medium text-slate-300">Total in Bank</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
              <span className="text-2xl font-black text-emerald-300 block">{portalStats.totalIntroduced}</span>
              <span className="text-[11px] font-medium text-slate-300">Introduced PYQs</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
              <span className="text-2xl font-black text-amber-300 block">{portalStats.totalPredicted}</span>
              <span className="text-[11px] font-medium text-slate-300">AI Predicted</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
              <span className="text-2xl font-black text-purple-300 block">{portalStats.totalSubjects}</span>
              <span className="text-[11px] font-medium text-slate-300">Subjects</span>
            </div>
          </div>
        </div>

        {/* Mode Selector Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-8 pt-6 border-t border-white/10">
          <button
            onClick={() => setPortalMode('single')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              portalMode === 'single'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <i className="ri-edit-circle-line text-sm"></i>
            Single Question Entry
          </button>

          <button
            onClick={() => setPortalMode('bulk')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              portalMode === 'bulk'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <i className="ri-file-upload-line text-sm"></i>
            Batch / JSON Ingestion
          </button>

          <button
            onClick={() => setPortalMode('manage')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              portalMode === 'manage'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <i className="ri-settings-4-line text-sm"></i>
            Manage Introduced Questions ({portalStats.totalQuestions})
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODE 1: SINGLE QUESTION INTRODUCTION                     */}
      {/* ======================================================== */}
      {portalMode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Form: 7 cols */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-7 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <i className="ri-add-box-fill text-indigo-600 text-xl"></i>
                  Introduce Question Specification
                </h3>
                <p className="text-xs text-slate-500">Provide exam metadata, question statement, and model answers</p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100">
                Mode: Manual Spec
              </span>
            </div>

            <form onSubmit={handleSingleSubmit} className="space-y-5">
              {/* Subject & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Subject Name *
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {existingSubjects.map((sub, i) => (
                      <option key={i} value={sub.name}>{sub.name}</option>
                    ))}
                    <option value="Custom">+ Introduce New Subject...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS401, IT302"
                    value={formData.subjectCode}
                    onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Custom Subject Name if selected */}
              {formData.subject === 'Custom' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Enter New Subject Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Theory of Computation, Cloud Computing..."
                    value={formData.customSubject}
                    onChange={(e) => setFormData({ ...formData, customSubject: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              {/* Year, Exam Type, Marks, Difficulty */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Exam Year *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Exam Type
                  </label>
                  <select
                    value={formData.examType}
                    onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="End-Sem">End-Sem</option>
                    <option value="Mid-Sem">Mid-Sem</option>
                    <option value="University Board">University Board</option>
                    <option value="GATE">GATE</option>
                    <option value="Unit Test">Unit Test</option>
                    <option value="Model Exam">Model Exam</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Marks
                  </label>
                  <input
                    type="number"
                    value={formData.marks}
                    onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Difficulty
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Unit, Question No, Topic, Bloom */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Unit / Module
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Unit 3, Module 2"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Question No. (Optional)</span>
                    <span className="text-[10px] text-slate-400">e.g. 1(a), 2</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1(a)"
                    value={formData.questionNumber}
                    onChange={(e) => setFormData({ ...formData, questionNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Bloom Taxonomy (Optional)
                  </label>
                  <select
                    value={formData.bloomLevel}
                    onChange={(e) => setFormData({ ...formData, bloomLevel: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">None / Unspecified</option>
                    <option value="L1">L1 - Remember</option>
                    <option value="L2">L2 - Understand</option>
                    <option value="L3">L3 - Apply</option>
                    <option value="L4">L4 - Analyze</option>
                    <option value="L5">L5 - Evaluate</option>
                    <option value="L6">L6 - Create</option>
                  </select>
                </div>
              </div>

              {/* Topic & Course Outcomes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Topic / Concept Focus
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Banker's Algorithm, Normalization"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Course Outcomes (Optional)</span>
                    <span className="text-[10px] text-slate-400">Click to toggle COs</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6'].map(co => {
                      const isSelected = formData.courseOutcomes?.includes(co);
                      return (
                        <button
                          key={co}
                          type="button"
                          onClick={() => {
                            const current = formData.courseOutcomes || [];
                            const updated = isSelected ? current.filter(c => c !== co) : [...current, co];
                            setFormData({ ...formData, courseOutcomes: updated });
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          {co}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Question Statement & Inline Duplicate Inspection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Question Statement *
                  </label>
                  <button
                    type="button"
                    onClick={handleCheckDuplicate}
                    disabled={isCheckingDuplicate || !formData.question.trim()}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors border border-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isCheckingDuplicate ? (
                      <>
                        <i className="ri-loader-4-line animate-spin text-sm"></i>
                        <span>Scanning Bank...</span>
                      </>
                    ) : (
                      <>
                        <i className="ri-search-eye-line text-sm"></i>
                        <span>Check for Duplicates</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows="4"
                  required
                  placeholder="Enter the complete examination question statement with all requirements and sub-parts..."
                  value={formData.question}
                  onChange={(e) => {
                    setFormData({ ...formData, question: e.target.value });
                    if (duplicateResult) setDuplicateResult(null);
                    if (confirmedDistinct) setConfirmedDistinct(false);
                    if (validationErrors.length) setValidationErrors([]);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                ></textarea>

                {/* Validation Errors Alert */}
                {validationErrors.length > 0 && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <i className="ri-error-warning-fill text-sm"></i> Please address the following issues:
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Duplicate Analysis Outcome Card */}
                {duplicateResult && (
                  <div className={`p-4 rounded-2xl border transition-all ${
                    duplicateResult.status === 'EXACT_DUPLICATE'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : duplicateResult.status === 'LIKELY_NEAR_DUPLICATE'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : duplicateResult.status === 'POSSIBLE_RELATED'
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <i className={`text-lg mt-0.5 ${
                          duplicateResult.status === 'EXACT_DUPLICATE'
                            ? 'ri-close-circle-fill text-rose-600'
                            : duplicateResult.status === 'LIKELY_NEAR_DUPLICATE'
                            ? 'ri-alert-fill text-amber-600'
                            : duplicateResult.status === 'POSSIBLE_RELATED'
                            ? 'ri-information-fill text-blue-600'
                            : 'ri-checkbox-circle-fill text-emerald-600'
                        }`}></i>
                        <div>
                          <h4 className="font-bold text-xs">
                            {duplicateResult.status === 'EXACT_DUPLICATE' && 'Exact Duplicate Detected (Insertion Blocked)'}
                            {duplicateResult.status === 'LIKELY_NEAR_DUPLICATE' && 'Potential Near-Duplicate(s) Detected'}
                            {duplicateResult.status === 'POSSIBLE_RELATED' && 'Related Topic Question(s) Found (Distinct)'}
                            {duplicateResult.status === 'NO_DUPLICATE' && 'Verified Unique Question! Ready for Submission'}
                          </h4>
                          <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                            {duplicateResult.message}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border bg-white/60">
                        {duplicateResult.status}
                      </span>
                    </div>

                    {/* Matched Questions Preview */}
                    {duplicateResult.matches && duplicateResult.matches.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-current/15 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                          Existing Question Matches ({duplicateResult.matches.length}):
                        </span>
                        {duplicateResult.matches.map((m, idx) => (
                          <div key={idx} className="p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-current/10 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {m.subject} • {m.year} • {m.examType}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                  {m.marks} Marks
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                m.similarityPercentage >= 95
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : m.similarityPercentage >= 80
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}>
                                {m.similarityPercentage}% Match
                              </span>
                            </div>
                            <p className="text-slate-800 font-medium leading-relaxed italic">
                              "{m.question}"
                            </p>
                          </div>
                        ))}

                        {/* Near Duplicate Confirmation Action */}
                        {duplicateResult.status === 'LIKELY_NEAR_DUPLICATE' && (
                          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
                            <p className="text-[11px] text-amber-900 font-medium">
                              If your question asks for a fundamentally distinct concept or derivation, confirm distinction:
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmedDistinct(!confirmedDistinct);
                                showToast(!confirmedDistinct ? '✓ Confirmed as distinct! You can now submit for review.' : 'Confirmation revoked.');
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                                confirmedDistinct
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-600 hover:bg-amber-700 text-white'
                              }`}
                            >
                              <i className={confirmedDistinct ? "ri-check-line" : "ri-shield-check-line"}></i>
                              <span>{confirmedDistinct ? '✓ Confirmed Distinct' : 'Confirm Distinct & Submit'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Model Answer / Solution */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex justify-between items-center">
                  <span>Model Answer / Key Solution Points</span>
                  <span className="text-[11px] font-normal text-slate-400">Markdown & code syntax supported</span>
                </label>
                <textarea
                  rows="6"
                  placeholder="Provide comprehensive model answer, algorithms, proof steps, mathematical derivations, or rubrics..."
                  value={formData.solution}
                  onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                ></textarea>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Keywords / Tags (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operating Systems, Deadlock, Resource Allocation, Numerical"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || isCheckingDuplicate || duplicateResult?.status === 'EXACT_DUPLICATE' || (duplicateResult?.status === 'LIKELY_NEAR_DUPLICATE' && !confirmedDistinct)}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 font-bold text-sm rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    duplicateResult?.status === 'EXACT_DUPLICATE'
                      ? 'bg-slate-400 text-slate-100 cursor-not-allowed'
                      : confirmedDistinct
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-lg"></i>
                      <span>Submitting for Faculty Review...</span>
                    </>
                  ) : duplicateResult?.status === 'EXACT_DUPLICATE' ? (
                    <>
                      <i className="ri-forbid-line text-lg"></i>
                      <span>Exact Duplicate - Insertion Blocked</span>
                    </>
                  ) : duplicateResult?.status === 'LIKELY_NEAR_DUPLICATE' && !confirmedDistinct ? (
                    <>
                      <i className="ri-error-warning-line text-lg"></i>
                      <span>Review Potential Duplicates Above</span>
                    </>
                  ) : (
                    <>
                      <i className="ri-check-double-line text-lg"></i>
                      <span>{confirmedDistinct ? 'Submit Distinct Question (Status: PENDING)' : 'Introduce Question to Bank (PENDING Review)'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Live Preview: 5 cols */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 sticky top-24">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="ri-eye-line text-indigo-500"></i> Student View Preview
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  Live Preview
                </span>
              </div>

              {/* Preview Card */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                    {formData.subject === 'Custom' ? (formData.customSubject || 'New Subject') : (formData.subject || 'Subject')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white text-slate-700 border border-slate-200">
                    {formData.year} • {formData.examType}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white text-slate-700 border border-slate-200">
                    {formData.marks} Marks
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white text-slate-600 border border-slate-200">
                    {formData.unit}
                  </span>
                </div>

                <div className="pt-1">
                  <h4 className="text-sm font-semibold text-slate-900 leading-relaxed">
                    {formData.question || 'Your question statement will appear here as you type...'}
                  </h4>
                  {formData.topic && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Topic: <span className="font-semibold text-slate-700">{formData.topic}</span>
                    </p>
                  )}
                </div>

                {formData.solution && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Model Answer Preview:
                    </span>
                    <div className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {formData.solution}
                    </div>
                  </div>
                )}

                {/* Submission Provenance Preview */}
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <i className="ri-user-star-line"></i> Origin: Student Submitted
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                    <i className="ri-time-line"></i> Status: Pending Faculty Review
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: BATCH / JSON INGESTION                           */}
      {/* ======================================================== */}
      {portalMode === 'bulk' && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i className="ri-folder-upload-fill text-indigo-600 text-xl"></i>
                Batch Question Ingestion
              </h3>
              <p className="text-xs text-slate-500">Paste JSON array to introduce multiple previous year questions in bulk</p>
            </div>
            <button
              onClick={loadBulkSampleTemplate}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors"
            >
              <i className="ri-magic-line"></i>
              Load Sample Template
            </button>
          </div>

          <div>
            <textarea
              rows="12"
              placeholder="Paste JSON array containing question objects here..."
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              className="w-full bg-slate-900 text-emerald-400 font-mono text-xs rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed shadow-inner"
            ></textarea>
          </div>

          {bulkError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center gap-2">
              <i className="ri-error-warning-fill text-base"></i>
              <span>{bulkError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <button
              onClick={handleParseBulk}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors"
            >
              Parse & Validate JSON
            </button>

            {parsedBulkQuestions.length > 0 && (
              <button
                onClick={handleBulkSubmit}
                disabled={isBulkSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {isBulkSubmitting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    <span>Introducing Batch...</span>
                  </>
                ) : (
                  <>
                    <i className="ri-check-line"></i>
                    <span>Introduce {parsedBulkQuestions.length} Questions to Bank</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Parsed Preview Table */}
          {parsedBulkQuestions.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 mb-3">
                Parsed Questions Preview ({parsedBulkQuestions.length})
              </h4>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {parsedBulkQuestions.map((q, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold text-indigo-700">
                      <span>{q.subject}</span>
                      <span>•</span>
                      <span>{q.year}</span>
                      <span>•</span>
                      <span>{q.marks || 10}M</span>
                    </div>
                    <p className="font-semibold text-slate-800">{q.question}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 3: MANAGE INTRODUCED QUESTIONS                      */}
      {/* ======================================================== */}
      {portalMode === 'manage' && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i className="ri-archive-stack-fill text-indigo-600 text-xl"></i>
                Introduced Question Repository
              </h3>
              <p className="text-xs text-slate-500">Inspect, edit metadata, and manage all introduced questions</p>
            </div>

            {/* Search */}
            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search introduced questions..."
                value={managedSearch}
                onChange={(e) => setManagedSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {loadingManaged ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <i className="ri-loader-4-line animate-spin text-2xl mb-2 block text-indigo-600"></i>
              Loading introduced questions...
            </div>
          ) : managedQuestions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No questions found matching your query.
            </div>
          ) : (
            <div className="space-y-3">
              {managedQuestions.map((q) => (
                <div
                  key={q._id}
                  className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        {q.subject}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        {q.year} • {q.examType}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {q.marks} Marks
                      </span>
                      {q.reviewStatus === 'PENDING' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200 flex items-center gap-1">
                          <i className="ri-time-line"></i>
                          Pending Review
                        </span>
                      )}
                      {q.reviewStatus === 'APPROVED' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                          <i className="ri-check-line"></i>
                          Approved
                        </span>
                      )}
                      {q.origin === 'STUDENT_SUBMITTED' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">
                          Student Submission
                        </span>
                      )}
                      {q.isPredicted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                          AI Predicted
                        </span>
                      )}
                      {q.courseOutcomes?.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold">
                          {q.courseOutcomes.join(', ')}
                        </span>
                      )}
                      {q.bloomLevel && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                          {q.bloomLevel}
                        </span>
                      )}
                    </div>
                    <h5 className="text-xs font-semibold text-slate-900 leading-snug">
                      {q.question}
                    </h5>
                    {q.topic && (
                      <p className="text-[11px] text-slate-500">
                        Topic: {q.topic}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteQuestion(q._id)}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                      title="Delete question from bank"
                    >
                      <i className="ri-delete-bin-line text-lg"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PYQPortal;
