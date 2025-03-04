import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SignIn from "./pages/signinpage";
import SignUp from "./pages/signuppage";
import Home from "./pages/Homepage";
import Database from "./pages/databasepage"
import SettingPage from "./pages/SettingPage";
import ProtectedRoute from "./components/protectedRoutes";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<SignIn />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />

                {/* Protected Route for Home */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/home" element={<Home />} />  
                </Route>
                <Route element={<ProtectedRoute />}>
               <Route path="/settings" element={<SettingPage />} />
               </Route>
                <Route element={<ProtectedRoute />}>
                <Route path="/database" element={<Database />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
