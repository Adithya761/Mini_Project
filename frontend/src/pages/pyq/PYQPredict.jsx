import { useState } from 'react';
import axios from '../../config/axios';
import 'remixicon/fonts/remixicon.css';

const PYQPredict = ({ existingSubjects = [], onQuestionAdded, onSwitchToBank }) => {
  const [predictSubject, setPredictSubject] = useState(existingSubjects[0]?.name || 'Operating Systems');
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [targetExam, setTargetExam] = useState('End-Sem 2026');
  const [topicsFocus, setTopicsFocus] = useState('');
  const [predictCount, setPredictCount] = useState(5);
  const [predictDifficulty, setPredictDifficulty] = useState('Medium');
  const [syllabusNotes, setSyllabusNotes] = useState('');
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictedQuestions, setPredictedQuestions] = useState([]);
  const [savedQuestionIds, setSavedQuestionIds] = useState(new Set());
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    const finalSubject = predictSubject === 'Custom' ? customSubjectInput.trim() : predictSubject;
    if (!finalSubject) {
      showToast('Please specify a subject for prediction');
      return;
    }

    setIsPredicting(true);
    setPredictedQuestions([]);
    setError('');

    try {
      const res = await axios.post('/pyq/predict', {
        subject: finalSubject,
        targetExam,
        topics: topicsFocus,
        count: predictCount,
        difficulty: predictDifficulty,
        syllabusText: syllabusNotes
      });

      if (res.data.predictions && res.data.predictions.length > 0) {
        setPredictedQuestions(res.data.predictions);
        showToast(`✨ Generated ${res.data.predictions.length} predicted questions!`);
      } else {
        setError('No predictions could be generated. Please refine your inputs.');
      }
    } catch (err) {
      console.error('Prediction error:', err);
      setError(err.response?.data?.error || 'AI Prediction failed. Please try again.');
    } finally {
      setIsPredicting(false);
    }
  };

  const handleSaveSingle = async (q, index) => {
    const finalSubject = predictSubject === 'Custom' ? customSubjectInput.trim() : predictSubject;
    try {
      await axios.post('/pyq/save-predicted', {
        questions: [{ ...q, subject: finalSubject, targetExam }],
        subject: finalSubject,
        targetExam
      });

      setSavedQuestionIds(prev => new Set([...prev, index]));
      showToast('🎉 Question introduced to PYQ Bank!');
      if (onQuestionAdded) onQuestionAdded();
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save question. Ensure you are signed in.');
    }
  };

  const handleSaveAll = async () => {
    if (predictedQuestions.length === 0) return;
    const finalSubject = predictSubject === 'Custom' ? customSubjectInput.trim() : predictSubject;

    setIsSavingAll(true);
    try {
      const res = await axios.post('/pyq/save-predicted', {
        questions: predictedQuestions.map(q => ({ ...q, subject: finalSubject, targetExam })),
        subject: finalSubject,
        targetExam
      });

      const allIndexes = new Set(predictedQuestions.map((_, i) => i));
      setSavedQuestionIds(allIndexes);
      showToast(`🚀 ${res.data?.count || predictedQuestions.length} questions introduced into PYQ Bank!`);
      if (onQuestionAdded) onQuestionAdded();
    } catch (err) {
      console.error('Bulk save error:', err);
      showToast('Failed to save questions to bank.');
    } finally {
      setIsSavingAll(false);
    }
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
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <i className="ri-sparkling-fill text-amber-400 text-xl"></i>
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Hero Form */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-amber-300 mb-4">
            <i className="ri-sparkling-fill"></i>
            <span>AI Examination Pattern Recognition</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight mb-3">
            Predict Upcoming Exam Questions
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Configure examination targets, curriculum focus, and difficulty. AI analyzes recurrence from introduced PYQs and syllabus weightage to predict high-probability questions.
          </p>
        </div>

        <form onSubmit={handlePredict} className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">Subject</label>
              <select
                value={predictSubject}
                onChange={(e) => setPredictSubject(e.target.value)}
                className="w-full bg-white text-slate-800 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {existingSubjects.map((sub, i) => (
                  <option key={i} value={sub.name}>{sub.name}</option>
                ))}
                <option value="Custom">+ Custom Subject...</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">Target Exam</label>
              <input
                type="text"
                placeholder="e.g. End-Sem 2026, Mid-Sem"
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value)}
                className="w-full bg-white text-slate-800 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">Question Count</label>
              <select
                value={predictCount}
                onChange={(e) => setPredictCount(parseInt(e.target.value))}
                className="w-full bg-white text-slate-800 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="3">3 Questions (Rapid)</option>
                <option value="5">5 Questions (Standard)</option>
                <option value="8">8 Questions (Comprehensive)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">Difficulty</label>
              <select
                value={predictDifficulty}
                onChange={(e) => setPredictDifficulty(e.target.value)}
                className="w-full bg-white text-slate-800 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="Medium">Medium (Standard)</option>
                <option value="Hard">Hard (Distinction / GATE)</option>
                <option value="Easy">Easy (Core Pass)</option>
              </select>
            </div>
          </div>

          {predictSubject === 'Custom' && (
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">Enter Custom Subject Name</label>
              <input
                type="text"
                placeholder="e.g. Theory of Computation, Artificial Intelligence..."
                value={customSubjectInput}
                onChange={(e) => setCustomSubjectInput(e.target.value)}
                className="w-full bg-white text-slate-800 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">Specific Units / Topics (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Unit 3 Deadlocks, Virtual Memory, Process Scheduling"
                value={topicsFocus}
                onChange={(e) => setTopicsFocus(e.target.value)}
                className="w-full bg-white text-slate-800 text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">Syllabus Keywords / Past Trends (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Emphasize numericals, Banker's algorithm, LRU"
                value={syllabusNotes}
                onChange={(e) => setSyllabusNotes(e.target.value)}
                className="w-full bg-white text-slate-800 text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPredicting}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPredicting ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-lg"></i>
                  <span>Analyzing Trends & Predicting...</span>
                </>
              ) : (
                <>
                  <i className="ri-magic-line text-lg"></i>
                  <span>Generate Predicted PYQs</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-sm flex items-center gap-3">
          <i className="ri-error-warning-fill text-xl"></i>
          <span>{error}</span>
        </div>
      )}

      {/* Results Header */}
      {predictedQuestions.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm">
                <i className="ri-sparkling-fill"></i>
              </span>
              AI Predicted Questions for {predictSubject === 'Custom' ? customSubjectInput : predictSubject}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Target: {targetExam} • {predictedQuestions.length} Questions Generated
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAll}
              disabled={isSavingAll}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {isSavingAll ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  <span>Introducing All...</span>
                </>
              ) : (
                <>
                  <i className="ri-download-cloud-2-line text-sm"></i>
                  <span>Add All to PYQ Bank</span>
                </>
              )}
            </button>

            {onSwitchToBank && (
              <button
                onClick={onSwitchToBank}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                View in Bank →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cards */}
      {predictedQuestions.length > 0 && (
        <div className="space-y-4">
          {predictedQuestions.map((q, idx) => {
            const isSaved = savedQuestionIds.has(idx);
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-200 ring-1 ring-indigo-500/10 hover:shadow-md transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Evidence Level Badge */}
                    {q.evidenceLevel === 'HIGH_CONFIDENCE' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm flex items-center gap-1.5">
                        <i className="ri-shield-check-fill text-emerald-600"></i>
                        {q.confidenceLabel || 'High Historical Recurrence'}
                      </span>
                    )}
                    {q.evidenceLevel === 'MEDIUM_CONFIDENCE' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 shadow-sm flex items-center gap-1.5">
                        <i className="ri-line-chart-fill text-indigo-600"></i>
                        {q.confidenceLabel || 'Moderate Historical Recurrence'}
                      </span>
                    )}
                    {q.evidenceLevel === 'INSUFFICIENT_DATA' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-sm flex items-center gap-1.5">
                        <i className="ri-information-line text-slate-500"></i>
                        {q.confidenceLabel || 'Insufficient Historical Data'}
                      </span>
                    )}
                    {(!q.evidenceLevel || q.evidenceLevel === 'EMERGING_TREND') && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm flex items-center gap-1.5">
                        <i className="ri-flashlight-fill text-amber-600"></i>
                        {q.confidenceLabel || 'Emerging or Limited Evidence'}
                      </span>
                    )}

                    {/* Match Classification Badge */}
                    {q.matchType && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {q.matchType}
                      </span>
                    )}

                    {/* Historical Appearances Badge */}
                    {q.historicalRepetitionCount > 1 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                        <i className="ri-history-line text-purple-600"></i>
                        {q.historicalRepetitionCount}x in Exams {q.appearedYears && q.appearedYears.length > 0 ? `(${q.appearedYears.join(', ')})` : ''}
                      </span>
                    )}

                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {q.marks || 8} Marks
                    </span>

                    {/* Bloom Taxonomy */}
                    {q.bloomLevel && (
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={`Bloom Level: ${q.bloomLevel}`}>
                        Bloom: {q.bloomLevel}
                      </span>
                    )}

                    {/* Course Outcomes */}
                    {Array.isArray(q.courseOutcomes) && q.courseOutcomes.length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1" title="Course Outcomes">
                        <i className="ri-target-line text-blue-500"></i>
                        {q.courseOutcomes.join(', ')}
                      </span>
                    )}

                    {q.unit && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200">
                        {q.unit}
                      </span>
                    )}

                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getDifficultyBadge(q.difficulty)}`}>
                      {q.difficulty || 'Medium'}
                    </span>
                  </div>

                  <div>
                    <button
                      onClick={() => handleSaveSingle(q, idx)}
                      disabled={isSaved}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isSaved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                      }`}
                    >
                      <i className={isSaved ? "ri-check-line text-sm" : "ri-add-line text-sm"}></i>
                      <span>{isSaved ? 'Introduced to Bank' : 'Introduce to PYQ Bank'}</span>
                    </button>
                  </div>
                </div>

                <div className="my-3">
                  <h4 className="text-base font-semibold text-slate-900 leading-relaxed">
                    {q.question}
                  </h4>
                  {q.topic && (
                    <p className="text-xs text-slate-500 mt-1">
                      Core Topic: <span className="font-semibold text-slate-700">{q.topic}</span>
                    </p>
                  )}
                </div>

                {q.predictionReasoning && (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 my-3 text-xs text-amber-900 flex items-start gap-2">
                    <i className="ri-line-chart-line text-amber-600 text-sm mt-0.5"></i>
                    <div>
                      <span className="font-bold">Recurrence Pattern: </span>
                      <span>{q.predictionReasoning}</span>
                    </div>
                  </div>
                )}

                {q.metadataLimitations && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 my-2 text-xs text-slate-600 flex items-start gap-2">
                    <i className="ri-information-line text-slate-400 text-sm mt-0.5"></i>
                    <span>{q.metadataLimitations}</span>
                  </div>
                )}

                {q.solution && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Model Solution & Key Points:
                    </span>
                    <div className="p-4 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed">
                      {q.solution}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PYQPredict;
