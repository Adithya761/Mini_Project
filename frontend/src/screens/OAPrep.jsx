import { useNavigate } from 'react-router-dom';
import 'remixicon/fonts/remixicon.css';

const PRACTICE_AREAS = [
  {
    id: 'aptitude',
    title: 'Aptitude Practice',
    description: 'Quantitative aptitude, logical reasoning, verbal ability, and data interpretation practice for company assessment rounds.',
    icon: 'ri-calculator-line',
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
    topics: ['Quantitative Aptitude', 'Logical Reasoning', 'Verbal Ability', 'Data Interpretation']
  },
  {
    id: 'cs-fundamentals',
    title: 'Computer Science Fundamentals',
    description: 'Operating Systems, DBMS, Computer Networks, and OOP core concept drill tests with topic-wise evaluation.',
    icon: 'ri-cpu-line',
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    topics: ['Operating Systems', 'Database Systems', 'Computer Networks', 'Object-Oriented Programming']
  },
  {
    id: 'dsa',
    title: 'DSA Practice',
    description: 'Data structures & algorithms problem patterns, time-space complexity challenges, and curated coding interview tracks.',
    icon: 'ri-code-s-slash-line',
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-600',
    topics: ['Arrays & Strings', 'Trees & Graphs', 'Dynamic Programming', 'Two Pointers & Sliders']
  },
  {
    id: 'sql',
    title: 'SQL Practice',
    description: 'Query authoring challenges, schema joins, window functions, and database query optimization problems.',
    icon: 'ri-database-2-line',
    color: 'from-purple-500 to-pink-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconColor: 'text-purple-600',
    topics: ['Complex Joins', 'Window Functions', 'Subqueries & CTEs', 'Aggregation & Grouping']
  },
  {
    id: 'lld',
    title: 'Low-Level Design (LLD)',
    description: 'Object-oriented design patterns, UML class modeling, clean architecture principles, and schema structuring scenarios.',
    icon: 'ri-layout-masonry-line',
    color: 'from-rose-500 to-red-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    iconColor: 'text-rose-600',
    topics: ['Design Patterns', 'SOLID Principles', 'Class Diagrams', 'System Schema Design']
  }
];

const OAPrep = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-orange-50 font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-indigo-600 transition-colors"
              title="Back to Dashboard"
            >
              <i className="ri-arrow-left-line text-xl"></i>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-500 flex items-center justify-center text-white shadow-md shadow-orange-100">
                <i className="ri-terminal-box-fill text-xl"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-slate-900">
                    OA Prep
                  </h1>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  VOID PREP • Online Assessment Practice Module
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <i className="ri-dashboard-line"></i>
              Dashboard
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-100"
            >
              <i className="ri-user-line"></i>
              Profile
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl border border-indigo-900/50 relative overflow-hidden">
          <div className="max-w-3xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold uppercase tracking-wider border border-orange-500/30">
              <i className="ri-sparkling-fill text-amber-400"></i> Next-Gen Placement Preparation
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Online Assessment (OA) Practice
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              We are building a structured online assessment suite tailored to recruitment patterns of top tier technology companies and product engineering teams. The practice module will launch in an upcoming milestone.
            </p>
            <p className="text-xs text-indigo-300 font-semibold pt-1">
              VOID PREP — Your preparation space for placements and technical interviews.
            </p>
          </div>

          <div className="absolute -right-8 -bottom-10 opacity-10 pointer-events-none">
            <i className="ri-terminal-box-line text-[240px] text-white"></i>
          </div>
        </div>

        {/* Existing Mock Interviews Callout (Preserved Functionality) */}
        <div className="bg-white rounded-2xl p-6 border border-amber-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-50/50 via-white to-orange-50/40">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-2xl flex-shrink-0">
              <i className="ri-user-voice-line"></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Looking for Interactive Mock Interviews?
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Our AI-powered Mock Interview session and feedback platform remains fully operational. Practice behavioral, domain, and technical interview questions anytime.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/mock-interview')}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              Open Mock Interviews
            </button>
            <button
              onClick={() => navigate('/mock-interview/new')}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl transition-all"
            >
              Start New Session
            </button>
          </div>
        </div>

        {/* Planned Practice Areas Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 pb-2 border-b border-slate-200">
            <div>
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <i className="ri-compass-3-line text-indigo-600"></i>
                Planned Assessment Tracks
              </h3>
              <p className="text-xs text-slate-500">
                Five focused modules currently in active engineering for comprehensive OA readiness
              </p>
            </div>
            <span className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100">
              5 Core Practice Areas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRACTICE_AREAS.map((area, idx) => (
              <div
                key={area.id}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-xl ${area.bgColor} ${area.iconColor} flex items-center justify-center text-2xl`}>
                      <i className={area.icon}></i>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Module {idx + 1}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {area.title}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {area.description}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Curriculum Highlights:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {area.topics.map((t, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center pt-8 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} VOID PREP. All rights reserved.</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Your preparation space for placements and technical interviews.
          </p>
        </div>
      </main>
    </div>
  );
};

export default OAPrep;
