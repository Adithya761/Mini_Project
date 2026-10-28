import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../../config/axios';
import PYQPortal from './PYQPortal';
import PYQBrowse from './PYQBrowse';
import PYQPredict from './PYQPredict';
import PYQSamplePaper from './PYQSamplePaper';
import 'remixicon/fonts/remixicon.css';

const PYQModule = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial tab from route path or query param
  const getInitialTab = () => {
    if (location.pathname.includes('portal')) return 'portal';
    if (location.pathname.includes('predict')) return 'predict';
    if (location.pathname.includes('sample-paper')) return 'sample-paper';
    return 'bank';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [subjectsList, setSubjectsList] = useState([]);
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalSubjects: 0,
    totalPredicted: 0,
    totalIntroduced: 0
  });

  const fetchSubjectsAndStats = async () => {
    try {
      const res = await axios.get('/pyq/subjects');
      if (res.data) {
        setSubjectsList(res.data.subjects || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      console.error('Error fetching subjects & stats:', err);
    }
  };

  useEffect(() => {
    fetchSubjectsAndStats();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 print:bg-white">
      {/* Top Navbar */}
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-indigo-600 transition-colors"
              title="Back to Dashboard"
            >
              <i className="ri-arrow-left-line text-xl"></i>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <i className="ri-book-read-fill text-xl"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 bg-clip-text text-transparent">
                  PYQ Question Vault
                </h1>
                <p className="text-xs text-slate-500 font-medium">VOID PREP • Question Bank & AI Predictor</p>
              </div>
            </div>
          </div>

          {/* Module Switcher Tabs */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
            {/* Tab 1: Portal */}
            <button
              onClick={() => setActiveTab('portal')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'portal'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="ri-inbox-archive-line text-sm"></i>
              <span>Introduce Portal</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === 'portal' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {stats.totalIntroduced || 0}
              </span>
            </button>

            {/* Tab 2: Bank */}
            <button
              onClick={() => setActiveTab('bank')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'bank'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="ri-database-2-line text-sm"></i>
              <span>Subject-Wise Bank</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold">
                {stats.totalQuestions || 0}
              </span>
            </button>

            {/* Tab 3: Predict */}
            <button
              onClick={() => setActiveTab('predict')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'predict'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="ri-sparkling-fill text-amber-200 text-sm"></i>
              <span>Predict PYQs</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/20 text-white font-bold uppercase tracking-wider">
                AI
              </span>
            </button>

            {/* Tab 4: Sample Paper Generator */}
            <button
              onClick={() => setActiveTab('sample-paper')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'sample-paper'
                  ? 'bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white shadow-md shadow-indigo-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="ri-file-paper-2-line text-sm"></i>
              <span>Sample Paper Generator</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === 'sample-paper' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
              }`}>
                Blueprint
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full print:max-w-none print:p-0 print:m-0">
        {activeTab === 'portal' && (
          <PYQPortal
            existingSubjects={subjectsList}
            onQuestionAdded={fetchSubjectsAndStats}
          />
        )}

        {activeTab === 'bank' && (
          <PYQBrowse
            onSwitchToPredict={() => setActiveTab('predict')}
            onSwitchToPortal={() => setActiveTab('portal')}
          />
        )}

        {activeTab === 'predict' && (
          <PYQPredict
            existingSubjects={subjectsList}
            onQuestionAdded={fetchSubjectsAndStats}
            onSwitchToBank={() => setActiveTab('bank')}
          />
        )}

        {activeTab === 'sample-paper' && (
          <PYQSamplePaper
            existingSubjects={subjectsList}
          />
        )}
      </main>
    </div>
  );
};

export default PYQModule;
