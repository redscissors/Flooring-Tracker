// Mounts the REAL App over the fake client; the seeded project reopens
// through the ft-last-open restore, exactly as a refresh would.
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import App from "../../src/App.jsx";
localStorage.setItem("ft-last-open", JSON.stringify({ projectId: "p1", customerId: null }));
localStorage.setItem("ft-last-seen", String(Date.now()));
localStorage.setItem("ft-theme", "light");
createRoot(document.getElementById("root")).render(<App user={{ id: "u1", email: "preview@example.com" }} onSignOut={() => { }} />);
