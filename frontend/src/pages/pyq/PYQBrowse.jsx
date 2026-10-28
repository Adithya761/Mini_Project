import { useState, useEffect } from 'react';
import axios from '../../config/axios';
import 'remixicon/fonts/remixicon.css';

const PYQBrowse = ({ onSwitchToPredict, onSwitchToPortal }) => {
  const [pyqs, setPyqs] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Filters
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedExamType, setSelectedExamType] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyPredicted, setOnlyPredicted] = useState(false);
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);

  // Solution Accordion
  const [expandedSolutions, setExpandedSolutions] = useState({});

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const fetchSubjects = async () => {
    try {
      const res = await axios.get('/pyq/subjects');
      if (res.data) {
        setSubjectsList(res.data.subjects || []);
        setAvailableYears(res.data.years || []);
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
    }
  };

  const fetchPYQs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (selectedSubject !== 'All') params.subject = selectedSubject;
      if (selectedYear !== 'All') params.year = selectedYear;
      if (selectedExamType !== 'All') params.examType = selectedExamType;
      if (selectedDifficulty !== 'All') params.difficulty = selectedDifficulty;
      if (onlyPredicted) params.isPredicted = 'true';
      if (onlyBookmarked) params.bookmarkedOnly = 'true';
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await axios.get('/pyq', { params });
      setPyqs(res.data.pyqs || []);
    } catch (err) {
      console.error('Error fetching PYQs:', err);
      setError('Failed to load Previous Year Questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    fetchPYQs();
  }, [selectedSubject, selectedYear, selectedExamType, selectedDifficulty, onlyPredicted, onlyBookmarked]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPYQs();
  };

  const toggleSolution = (id) => {
    setExpandedSolutions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleToggleBookmark = async (id) => {
    try {
      const res = await axios.post(`/pyq/${id}/bookmark`);
      setPyqs(prev => prev.map(item => {
        if (item._id === id) {
          return { ...item, isBookmarked: res.data.isBookmarked };
        }
        return item;
      }));
      showToast(res.data.isBookmarked ? '⭐ Question bookmarked!' : 'Bookmark removed');
    } catch (err) {
      console.error('Bookmark error:', err);
      showToast('Please sign in to bookmark questions');
    }
  };

  const handleToggleSolved = async (id) => {
    try {
      const res = await axios.post(`/pyq/${id}/solve`);
      setPyqs(prev => prev.map(item => {
        if (item._id === id) {
          return { ...item, isSolved: res.data.isSolved };
        }
        return item;
      }));
      showToast(res.data.isSolved ? '✅ Marked as practiced!' : 'Practice status cleared');
    } catch (err) {
      console.error('Solved error:', err);
      showToast('Please sign in to mark questions as solved');
    }
  };

  const handleCopyQuestion = (text) => {
    navigator.clipboard.writeText(text);
    showToast('📋 Question copied to clipboard!');
  };

  const getDifficultyBadge = (diff) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'hard':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <i className="ri-information-fill text-indigo-400 text-xl"></i>
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Subject Chips Slider */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <i className="ri-apps-2-line text-indigo-500"></i> Subject-Wise Directory
          </span>
          <span className="text-xs text-slate-400">
            {subjectsList.length} subjects indexed
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedSubject('All')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedSubject === 'All'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <i className="ri-function-line"></i>
            All Subjects
          </button>
          {subjectsList.map((sub, i) => (
            <button
              key={i}
              onClick={() => setSelectedSubject(sub.name)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedSubject === sub.name
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>{sub.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                selectedSubject === sub.name ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {sub.count}
              </span>
              {sub.predictedCount > 0 && (
                <span className="text-[10px] text-amber-500 font-bold flex items-center" title={`${sub.predictedCount} predicted questions`}>
                  <i className="ri-sparkling-fill"></i>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
          <input
            type="text"
            placeholder="Search questions, topics, algorithms, or concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Search
          </button>
        </form>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="All">All Years</option>
            {availableYears.map((yr, i) => (
              <option key={i} value={yr}>{yr}</option>
            ))}
          </select>

          {/* Exam Type Filter */}
          <select
            value={selectedExamType}
            onChange={(e) => setSelectedExamType(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="All">All Exam Types</option>
            <option value="End-Sem">End-Sem</option>
            <option value="Mid-Sem">Mid-Sem</option>
            <option value="University Board">University Board</option>
            <option value="GATE">GATE</option>
            <option value="Unit Test">Unit Test</option>
          </select>

          {/* Difficulty Filter */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="All">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          {/* AI Predicted Toggle */}
          <button
            onClick={() => setOnlyPredicted(prev => !prev)}
            className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              onlyPredicted
                ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <i className={`ri-sparkling-fill ${onlyPredicted ? 'text-amber-500' : 'text-slate-400'}`}></i>
            <span>AI Predicted</span>
          </button>

          {/* Bookmarked Only Toggle */}
          <button
            onClick={() => setOnlyBookmarked(prev => !prev)}
            className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              onlyBookmarked
                ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <i className={`ri-star-fill ${onlyBookmarked ? 'text-rose-500' : 'text-slate-400'}`}></i>
            <span>Saved</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-sm flex items-center gap-3">
          <i className="ri-error-warning-fill text-xl"></i>
          <span>{error}</span>
        </div>
      )}

      {/* Question Cards */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 animate-pulse space-y-3">
              <div className="flex gap-2">
                <div className="h-6 w-28 bg-slate-200 rounded-full"></div>
                <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
              </div>
              <div className="h-5 w-3/4 bg-slate-200 rounded"></div>
              <div className="h-4 w-1/2 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>
      ) : pyqs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
            <i className="ri-file-search-line"></i>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No Questions Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            No questions match your current filters. You can introduce new questions from the Portal or use the AI Predictor.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setSelectedSubject('All');
                setSelectedYear('All');
                setSelectedExamType('All');
                setSelectedDifficulty('All');
                setOnlyPredicted(false);
                setOnlyBookmarked(false);
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
            >
              Reset Filters
            </button>
            <button
              onClick={onSwitchToPortal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition-all flex items-center gap-1.5"
            >
              <i className="ri-inbox-archive-line"></i>
              Introduce From Portal
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {pyqs.map((q) => (
            <div
              key={q._id}
              className={`bg-white rounded-2xl p-6 shadow-sm border transition-all hover:shadow-md ${
                q.isPredicted
                  ? 'border-indigo-300 ring-1 ring-indigo-500/20 bg-gradient-to-br from-white via-indigo-50/10 to-purple-50/20'
                  : 'border-slate-200'
              }`}
            >
              {/* Meta Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    {q.subject}
                  </span>

                  {q.subjectCode && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-200/80 text-slate-800 border border-slate-300">
                      {q.subjectCode}
                    </span>
                  )}

                  {q.questionNumber && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      {q.questionNumber}
                    </span>
                  )}

                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                    <i className="ri-calendar-event-line text-slate-400"></i>
                    {q.year} • {q.examType}
                  </span>

                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {q.marks} Marks
                  </span>

                  {q.bloomLevel && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={`Bloom's Taxonomy Level: ${q.bloomLevel}`}>
                      Bloom: {q.bloomLevel}
                    </span>
                  )}

                  {Array.isArray(q.courseOutcomes) && q.courseOutcomes.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1" title="Course Outcomes">
                      <i className="ri-target-line text-blue-500"></i>
                      {q.courseOutcomes.join(', ')}
                    </span>
                  )}

                  {q.unit && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200">
                      {q.unit}
                    </span>
                  )}

                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getDifficultyBadge(q.difficulty)}`}>
                    {q.difficulty}
                  </span>

                  {q.isPredicted && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm flex items-center gap-1 animate-pulse">
                      <i className="ri-sparkling-fill text-amber-200"></i>
                      AI Predicted ({q.probability || 88}% Likelihood)
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    onClick={() => handleToggleSolved(q._id)}
                    className={`p-2 rounded-xl transition-colors ${
                      q.isSolved
                        ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        : 'hover:bg-slate-100 hover:text-slate-600'
                    }`}
                    title={q.isSolved ? 'Practiced! Click to mark unpracticed' : 'Mark as practiced'}
                  >
                    <i className={`text-lg ${q.isSolved ? 'ri-checkbox-circle-fill' : 'ri-checkbox-circle-line'}`}></i>
                  </button>

                  <button
                    onClick={() => handleToggleBookmark(q._id)}
                    className={`p-2 rounded-xl transition-colors ${
                      q.isBookmarked
                        ? 'text-rose-500 bg-rose-50 hover:bg-rose-100'
                        : 'hover:bg-slate-100 hover:text-slate-600'
                    }`}
                    title={q.isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
                  >
                    <i className={`text-lg ${q.isBookmarked ? 'ri-star-fill' : 'ri-star-line'}`}></i>
                  </button>

                  <button
                    onClick={() => handleCopyQuestion(q.question)}
                    className="p-2 rounded-xl hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    title="Copy question text"
                  >
                    <i className="ri-file-copy-line text-lg"></i>
                  </button>
                </div>
              </div>

              {/* Statement */}
              <div className="my-3">
                <h4 className="text-base font-semibold text-slate-900 leading-relaxed">
                  {q.question}
                </h4>
                {q.topic && (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <i className="ri-price-tag-3-line text-slate-400"></i>
                    Topic: <span className="font-medium text-slate-700">{q.topic}</span>
                  </p>
                )}
              </div>

              {/* Prediction Reasoning */}
              {q.isPredicted && q.predictionReasoning && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 my-3 text-xs text-amber-900 flex items-start gap-2">
                  <i className="ri-lightbulb-flash-line text-amber-600 text-sm mt-0.5"></i>
                  <div>
                    <span className="font-bold">Exam Pattern Insight: </span>
                    <span>{q.predictionReasoning}</span>
                  </div>
                </div>
              )}

              {/* Tags */}
              {q.tags && q.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 my-3">
                  {q.tags.map((tag, tIndex) => (
                    <span key={tIndex} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Solution Accordion */}
              {q.solution && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => toggleSolution(q._id)}
                    className="flex items-center justify-between w-full text-left text-xs font-bold text-indigo-700 hover:text-indigo-800 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <i className="ri-key-line"></i>
                      {expandedSolutions[q._id] ? 'Hide Model Answer / Solution' : 'View Model Answer & Key Points'}
                    </span>
                    <i className={`ri-arrow-${expandedSolutions[q._id] ? 'up' : 'down'}-s-line text-base`}></i>
                  </button>

                  {expandedSolutions[q._id] && (
                    <div className="mt-3 p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-800">
                      {q.solution}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PYQBrowse;
