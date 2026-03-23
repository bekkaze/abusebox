import AuthProvider from "./services/auth/authProvider";
import ThemeProvider from "./services/theme/themeProvider";
import Routes from "./routes";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;