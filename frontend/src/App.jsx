import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/shared/Layout'
import Dashboard from './components/Dashboard'
import BlacklistCheck from './components/BlacklistCheck'
import BlacklistMonitor from './components/BlacklistMonitor'
import AbuseMailbox from './components/AbuseMailbox'
import { Login } from './components/Login';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />}/>
          <Route path='blacklist-check' element={<BlacklistCheck />}/>
          <Route path='abuse-mailbox' element={<AbuseMailbox />}/>
          <Route path='blacklist-monitor' element={<BlacklistMonitor />} />
        </Route>
        <Route path='login' element={<Login />}/>
      </Routes>
    </Router>
  )
}

export default App 