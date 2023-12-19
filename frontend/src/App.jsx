import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import GuestCheck from './pages/GuestCheck';

function App() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<Home/>}/>
        <Route path='login' element={<Login/>}/>
        <Route path='guestCheck' element={<GuestCheck/>}/>
      </Routes>
    </Router>
  );
}

export default App;
