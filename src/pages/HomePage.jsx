import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

const PORTALS = [
  {
    role: 'student',
    icon: '👨‍🎓',
    title: 'Student Portal',
    blurb: 'Discover engineering majors and get AI-powered career recommendations',
    cta: 'Get Started',
  },
  {
    role: 'company',
    icon: '🏢',
    title: 'Company Portal',
    blurb: 'Post jobs and find talented engineering students',
    cta: 'Sign In',
  },
  {
    role: 'career',
    icon: '📈',
    title: 'Career Boost',
    blurb: 'Advance your career with AI mentorship and industry insights',
    cta: 'Explore',
  },
];

export default function HomePage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([api('/majors', { auth: false }), api('/jobs', { auth: false })])
      .then(([majors, jobs]) =>
        setStats({
          majors: majors.length,
          courses: majors.reduce((n, m) => n + m.course_count, 0),
          jobs: jobs.length,
        }),
      )
      .catch(() => setStats(null));
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(135deg, #001a33 0%, #0a2647 100%)' }}
    >
      <header className="text-center mb-10">
        <h1 className="text-5xl font-bold text-white mb-2">🎓 DARBI</h1>
        <p className="text-lg" style={{ color: '#d4af37' }}>
          AI-Powered Career &amp; Job Matching Platform
        </p>
        <p className="text-gray-300 text-xl mt-6 max-w-3xl">
          Find your perfect engineering major, connect with top companies, or advance your career
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {PORTALS.map((p) => (
          <Link
            key={p.role}
            to={`/portal/${p.role}`}
            className="bg-white rounded-lg shadow-lg p-8 text-center hover:shadow-2xl transition flex flex-col"
            style={{ borderTop: '4px solid #d4af37' }}
          >
            <div className="text-5xl mb-4">{p.icon}</div>
            <h2 className="text-2xl font-bold text-darbi-navy mb-3">{p.title}</h2>
            <p className="text-gray-600 mb-6 flex-1">{p.blurb}</p>
            <div
              className="font-bold py-3 px-6 rounded-lg text-white"
              style={{ backgroundColor: '#001a33' }}
            >
              {p.cta}
            </div>
          </Link>
        ))}
      </div>

      {stats && (
        <p className="mt-12 text-gray-300 text-sm">
          {stats.majors} majors · {stats.courses} verified courses · {stats.jobs} verified job
          listings
        </p>
      )}

      <footer className="text-gray-400 text-sm mt-10">
        DARBI Phase 2 · JSYP 2026 Hackathon · Team Sparks
      </footer>
    </div>
  );
}
