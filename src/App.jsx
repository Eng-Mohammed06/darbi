import { useEffect, useState } from 'react';
import HomePage from './pages/HomePage.jsx';

/**
 * Day-1 shell. Routing and the three dashboards land on day 2; for now this
 * renders the three-portal homepage and proves the API + Postgres wiring by
 * loading real seeded majors.
 */
export default function App() {
  const [majors, setMajors] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/majors')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setMajors)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <HomePage
      majors={majors}
      error={error}
      onSelectStudent={() => alert('Student portal — day 2')}
      onSelectCompany={() => alert('Company portal — day 2')}
      onSelectCareer={() => alert('Career Boost — day 2')}
    />
  );
}
