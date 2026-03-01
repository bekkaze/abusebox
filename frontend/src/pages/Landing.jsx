import Navbar from "../components/landing/Navbar"
import Hero from "../components/landing/Hero"
import '../index.css';

const LandingPage = () => {
  return (
    <div className="landing min-h-screen">
      <Navbar/>
      <Hero/>
    </div>
  )
}

export default LandingPage;
