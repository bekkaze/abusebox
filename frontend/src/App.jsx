import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AuthProvider from "./services/auth/authProvider";
import ThemeProvider, { useTheme } from "./services/theme/themeProvider";
import Routes from "./routes";

// A single toast container for the whole app; pages only call toast().
function Toasts() {
  const { dark } = useTheme();
  return <ToastContainer position="top-center" autoClose={4000} theme={dark ? "dark" : "light"} newestOnTop />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes />
        <Toasts />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
