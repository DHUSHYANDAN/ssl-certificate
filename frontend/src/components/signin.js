import React, { useState } from 'react';
import axios from 'axios';
import baseUrl from '../URL';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';




const SignIn = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const validate = () => {
        let tempErrors = {};
        if (!email) tempErrors.email = "Email is required";
        if (!password) tempErrors.password = "Password is required";
        setErrors(tempErrors);
        return Object.keys(tempErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            await axios.post(
                `${baseUrl}/login`, 
                { email, password },
                { withCredentials: true } 
            );
            toast.success("Login successful!");
        
     
            setTimeout(() => {
                window.location.href = '/home'; 
            }, 2000);
            
        } catch (error) {
            if (error.response && error.response.data) {
                toast.error(error.response.data.message);
            } else {
                toast.error("An error occurred. Please try again.");
            }
        }
    };

    return (
        <div className="flex justify-center items-center  h-screen bg-cover bg-center" style={{ backgroundImage: "url('./signin.jpg')" }}>
            <div className="w-full max-w-md bg-white p-8 opacity-85 rounded-lg shadow-md">
            <div className=' text-center'>
            <img
                    src="./ZigIcon.icon"
                    className="h-14 pb-2 text-center inline"
                    alt="Zigma Logo"
                />
                <h className="text-2xl font-mono text-center pt-1 font-bold">CertMonitor</h></div>
                <h2 className="text-lg font-serif mb-6 text-center text-blue-700">Access Your Account – Sign In Now! </h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-900 text-sm font-bold mb-2" htmlFor="email">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline `}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        {errors.email && <p className="text-red-500  ">{errors.email}</p>}
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-900 text-sm font-bold mb-2" htmlFor="password">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline `}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5">
                                <button type="button" onClick={togglePasswordVisibility} className="focus:outline-none">
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>
                        {errors.password && <p className="text-red-500 ">{errors.password}</p>}
                    </div>
                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            className="bg-blue-700 hover:bg-blue-900 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                            Sign In
                        </button>
                        <p className="text-center mt-4">
                            Don't have an account? <a href="/signup" className="text-blue-700">Sign up</a>
                        </p>
                    </div>
                </form>
            </div>
            <ToastContainer />
        </div>
    );
};

export default SignIn;
