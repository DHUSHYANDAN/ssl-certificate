import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import baseUrl from "../URL";

const Navbars = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${baseUrl}/profile`, {
          withCredentials: true,
        });
        setUser(response.data.user);
      } catch (error) {
        setUser(null);
      }
    };
    checkAuth();
  }, []);





  // Logout function
  const handleLogout = async () => {
    try {
      await axios.post(`${baseUrl}/logout`, {}, { withCredentials: true });
      setUser(null);
      toast.success("Logged out successfully!");
      
      setShowLogoutModal(false);
      setLoading(true);
      setTimeout(() => {
        navigate("/signIn");
      }, 2000);
    } catch (error) {
      setLoading(false);
      toast.error("Error logging out!");
    }
  };

  return (
    <>
    {loading && (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-40">
    <div>
      <h1 className="text-xl md:text-7xl font-bold text-white flex items-center">
        L
        <svg
          stroke="currentColor"
          fill="currentColor"
          strokeWidth="0"
          viewBox="0 0 24 24"
          className="animate-spin"
          height="1em"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM13.6695 15.9999H10.3295L8.95053 17.8969L9.5044 19.6031C10.2897 19.8607 11.1286 20 12 20C12.8714 20 13.7103 19.8607 14.4956 19.6031L15.0485 17.8969L13.6695 15.9999ZM5.29354 10.8719L4.00222 11.8095L4 12C4 13.7297 4.54894 15.3312 5.4821 16.6397L7.39254 16.6399L8.71453 14.8199L7.68654 11.6499L5.29354 10.8719ZM18.7055 10.8719L16.3125 11.6499L15.2845 14.8199L16.6065 16.6399L18.5179 16.6397C19.4511 15.3312 20 13.7297 20 12L19.997 11.81L18.7055 10.8719ZM12 9.536L9.656 11.238L10.552 14H13.447L14.343 11.238L12 9.536ZM14.2914 4.33299L12.9995 5.27293V7.78993L15.6935 9.74693L17.9325 9.01993L18.4867 7.3168C17.467 5.90685 15.9988 4.84254 14.2914 4.33299ZM9.70757 4.33329C8.00021 4.84307 6.53216 5.90762 5.51261 7.31778L6.06653 9.01993L8.30554 9.74693L10.9995 7.78993V5.27293L9.70757 4.33329Z"></path>
        </svg>
        ading . . .
      </h1>
    </div>
  </div>
    )}
    <nav className={`bg-white shadow-md sticky w-full z-20 top-0 border-b border-gray-200 ${user ? 'bg-cover bg-center' : ''}`} style={user ? { backgroundImage: "url('./landingpage2.png')" } : {}}>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo & Brand */}
          <Link to="/home" className="flex items-center space-x-3">
            <img src="./ZigmaImage.png" className="h-14" alt="Logo" />
            <span className="text-lg font-semibold">
            {user ? `Welcome, ${user.name.length > 10 ? user.name.substring(0, 10) + "..." : user.name}!` : ""}
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden lg:flex space-x-6">
            {!user ? (
              <>
                <button
                  className="hover:text-white shadow-xl font-bold hover:bg-blue-600 px-4 py-2 rounded-lg"
                  onClick={() => navigate("/signUp")}
                >
                  Sign Up
                </button>
                <button
                  className="hover:text-white shadow-xl font-bold hover:bg-blue-600 px-4 py-2 rounded-lg"
                  onClick={() => navigate("/signIn")}
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                <button
                  className="hover:text-white shadow-xl font-bold hover:bg-blue-500 px-4 rounded-lg"
                  onClick={() => navigate("/home")}
                >
                  Home
                </button>
                <button
                  className="hover:text-white shadow-xl font-bold hover:bg-blue-500 px-4 rounded-lg"
                  onClick={() => navigate("/database")}
                >
                  URL Monitored
                </button>
                <button
                className="hover:text-white shadow-xl font-bold hover:bg-blue-500 px-4 rounded-lg
                "
                onClick={() => navigate("/export")}
                >Report</button>
                <button
                  className="hover:text-white shadow-xl font-bold hover:bg-blue-500 px-4 rounded-lg"
                  onClick={() => navigate("/settings")}
                >
                  Settings
                </button>
                <button
                  className="hover:text-white shadow-xl font-bold hover:bg-red-500 px-4 py-1 rounded-lg"
                  onClick={() => setShowLogoutModal(true)}
                >
                  Log Out
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden text-gray-500 hover:bg-gray-100 p-2 rounded-lg focus:outline-none"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16m-7 6h7"}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="lg:hidden bg-white shadow-lg">
          <div className="px-4 pb-3 space-y-2">
            {!user ? (
              <>
                <div className="flex  sm:justify-center"> 
                  <button
                    className="sm:w-1/2 w-full hover:text-white  text-left sm:text-center font-bold hover:bg-blue-600 px-4 py-2 rounded-md"
                    onClick={() => navigate("/signUp")}
                  >
                    Sign Up
                  </button>
                </div>
                <div className="flex sm:justify-center">
                  <button
                    className="sm:w-1/2 w-full hover:text-white  text-left sm:text-center font-bold hover:bg-blue-600 px-4 py-2 rounded-md"
                    onClick={() => navigate("/signIn")}
                  >
                    Sign In
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex sm:justify-center">
                  <button
                    className="sm:w-1/2 w-full hover:text-white border-b-2 border-dashed text-left sm:text-center font-bold hover:bg-blue-600 px-4 py-2 rounded-md"
                    onClick={() => navigate("/home")}
                  >
                    Home
                  </button>
                </div>
                <div className="flex sm:justify-center">
                  <button
                    className="sm:w-1/2 w-full hover:text-white border-b-2 border-dashed  text-left sm:text-center font-bold hover:bg-blue-600 px-4 py-2 rounded-md"
                    onClick={() => navigate("/database")}
                  >
                    URL Monitored
                  </button>
                </div>
                <div className="flex sm:justify-center">
                  <button
                  className="sm:w-1/2 w-full hover:text-white border-b-2 border-d
                  dashed text-left sm:text-center font-bold hover:bg-blue-600 px-4 py-2
                  rounded-md"
                  onClick={() => navigate("/export")}
                  >
                    Report
                    </button>
                </div>
                <div className="flex sm:justify-center">
                  <button
                    className="sm:w-1/2 w-full hover:text-white border-b-2 border-dashed text-left sm:text-center font-bold hover:bg-blue-600 px-4 py-2 rounded-md"
                    onClick={() => navigate("/settings")}
                  >
                    Settings
                  </button>
                </div>
                <div className="flex sm:justify-center">
                  <button
                    className="sm:w-1/2 w-full hover:text-white border-b-2 border-dashed  text-left sm:text-center font-bold hover:bg-blue-600 px-4 py-2 rounded-md"
                    onClick={() => setShowLogoutModal(true)}
                  >
                    Log Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm">
            <h3 className="text-lg font-semibold text-gray-700">
              Are you sure you want to log out?
            </h3>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 mr-2"
              >
                Yes, Log Out
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
        
    </nav>
    <ToastContainer />
    </>
  );
};

export default Navbars;
