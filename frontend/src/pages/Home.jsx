import Navbar from "../components/HomeNavbar"
import Hero from "../components/HomeHero"
import '../index.css';
const Home = () => {
  return (
    <div className="home">
      <Navbar/>
      <Hero/>
    </div>
  )
}

export default Home;