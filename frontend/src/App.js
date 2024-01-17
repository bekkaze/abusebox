import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/Landing';
import QuickCheck from './pages/blacklist/QuickCheck';
import Login from './pages/Login';
import Layout from './layouts/dashboard/Layout';
import Home from './pages/dashboard/Home';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="" element={<LandingPage />} />
        <Route path="quick-check" element={<QuickCheck />} />
        <Route path="login" element={<Login />} />
        <Route path="dashboard" element={<Layout />}>
          <Route path="home" element={<Home />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
