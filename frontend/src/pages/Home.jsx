import Navbar from "../components/home/HomeNavbar"
import Hero from "../components/home/HomeHero"
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