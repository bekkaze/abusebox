import Navbar from "../components/landing/Navbar"
import Hero from "../components/landing/LandingHero"
import '../index.css';

const LandingPage = () => {
  return (
    <div className="landing">
      <Navbar/>
      <Hero/>
    </div>
  )
}

export default LandingPage;