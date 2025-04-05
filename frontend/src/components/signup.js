import React, { useState } from 'react';
import axios from 'axios';
import baseurl from '../URL';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

const Signup = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const [errors, setErrors] = useState({});
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState('');
    const [loading, setLoading] = useState(false);

    // Toggle password visibility
    const togglePasswordVisibility = () => {
        setPasswordVisible(!passwordVisible);
    };

    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: value
        }));

        validateField(name, value);
    };

    // Password strength evaluation
    const evaluatePasswordStrength = (password) => {
        if (password.length < 6) return 'weak';
        if (!/\d/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'normal';
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) return 'medium';
        return 'strong';
    };

    // Validate input fields
    const validateField = (name, value) => {
        let error = '';

        switch (name) {
            case 'name':
                if (!value.trim()) {
                    error = 'Name is required';
                } else if (!/^[a-zA-Z\s]+$/.test(value)) {
                    error = 'Only alphabets are allowed';
                }
                break;
            case 'email':
                if (!value.trim()) {
                    error = 'Email is required';
                } else if (!/\S+@\S+\.\S+/.test(value)) {
                    error = 'Invalid email format';
                }
                break;
            case 'password':
                if (!value) {
                    setPasswordStrength('');
                    error = 'Password is required';
                } else {
                    const strength = evaluatePasswordStrength(value);
                    setPasswordStrength(strength);

                    if (strength === 'weak') {
                        error = 'Weak: Must be at least 6 characters';
                    } else if (strength === 'normal') {
                        error = 'Normal: Add a number & special character';
                    } else if (strength === 'medium') {
                        error = 'Medium: Add both uppercase & lowercase';
                    }
                }
                break;
            case 'confirmPassword':
                if (!value) {
                    error = 'Confirm Password is required';
                } else if (value !== formData.password) {
                    error = 'Passwords do not match';
                }
                break;
            default:
                break;
        }

        setErrors((prevErrors) => ({
            ...prevErrors,
            [name]: error
        }));
    };

    // Validate all fields on submit
    const validateForm = () => {
        const formErrors = {};

        Object.keys(formData).forEach((key) => {
            validateField(key, formData[key]);
            if (!formData[key].trim()) {
                formErrors[key] = `${key.charAt(0).toUpperCase() + key.slice(1)} is required`;
            }
        });

        setErrors(formErrors);
        return Object.keys(formErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        if (passwordStrength === 'weak') {
            toast.error('Please enter a stronger password!');
            return;
        }

        try {
            const response = await axios.post(
                `${baseurl}/register`,
                {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password
                },
                { withCredentials: true }
            );

            toast.success(response.data.message);

            setFormData({ name: '', email: '', password: '', confirmPassword: '' });
            setLoading(true);
            setTimeout(() => navigate('/signin'), 2000);
        } catch (error) {
            if (error.response?.data?.errors) {
                const serverErrors = error.response.data.errors.reduce((acc, err) => {
                    acc[err.param] = err.msg;
                    return acc;
                }, {});
                setErrors(serverErrors);
            } else {
                setErrors({ general: error.response?.data?.message || 'Server error' });
            }
        }
    };

    // Get color class based on password strength
    const getStrengthColor = () => {
        switch (passwordStrength) {
            case 'weak':
                return 'text-red-500';
            case 'normal':
                return 'text-orange-500';
            case 'medium':
                return 'text-yellow-500';
            case 'strong':
                return 'text-green-500';
            default:
                return 'text-red-500';
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
            <div
                className="flex justify-center items-center bg-gray-100 h-screen bg-cover bg-center"
                style={{ backgroundImage: "url('./signin2.jpg')" }}
            >
                <form
                    className="bg-white p-8 rounded shadow-md opacity-85 w-full max-w-md"
                    onSubmit={handleSubmit}
                >
                    <div className="text-center">
                        <img
                            src="./ZigIcon.icon"
                            className="h-14 pb-2 text-center inline"
                            alt="Zigma Logo"
                        />
                        <h className="text-2xl font-mono text-center pt-1 font-bold">
                            CertMonitor
                        </h>
                    </div>
                    <h2 className="text-lg font-serif mb-6 text-center text-blue-700">
                        Get Started – Create Your Account Now!
                    </h2>
                    {errors.general && (
                        <p className="text-left text-md font-bold transition-opacity duration-500 opacity-100 animate-fadeIn mx-auto w-fit text-white bg-gradient-to-br from-pink-400 to-red-600 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-pink-200 dark:focus:ring-pink-800 text-sm px-5 py-2.5 mb-2 b shadow-xl rounded-full border border-white-300">
                            {errors.general}
                        </p>
                    )}

                    {/* Name Field */}
                    <div className="mb-4">
                        <label className="block text-gray-900 font-bold">Name</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full p-2 border outline-none border-gray-300 rounded mt-1"
                        />
                        {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
                    </div>

                    {/* Email Field */}
                    <div className="mb-4">
                        <label className="block text-gray-900 font-bold">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full p-2 border outline-none border-gray-300 rounded mt-1"
                        />
                        {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
                    </div>

                    {/* Password Field */}
                    <div className="mb-4 relative">
                        <label className="block text-gray-900 font-bold">Password</label>
                        <div className="relative">
                            <input
                                type={passwordVisible ? 'text' : 'password'}
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full p-2 border outline-none border-gray-300 rounded mt-1"
                            />
                            <span
                                className="absolute right-3 top-3 cursor-pointer text-gray-500"
                                onClick={togglePasswordVisibility}
                            >
                                {passwordVisible ? <FaEyeSlash /> : <FaEye />}
                            </span>
                        </div>
                        {errors.password && (
                            <p className={`text-sm ${getStrengthColor()}`}>{errors.password}</p>
                        )}
                    </div>

                    {/* Confirm Password Field */}
                    <div className="mb-4">
                        <label className="block text-gray-900 font-bold">Confirm Password</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="w-full p-2 border outline-none border-gray-300 rounded mt-1"
                        />
                        {errors.confirmPassword && (
                            <p className="text-red-500 text-sm">{errors.confirmPassword}</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className={`w-full p-2 rounded transition duration-200 font-bold ${
                            passwordStrength === 'weak'
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-700 hover:bg-blue-800 text-white'
                        }`}
                        disabled={passwordStrength === 'weak'}
                    >
                        Sign Up
                    </button>

                    {/* Redirect to Login */}
                    <p className="text-center mt-4">
                        Already have an account?{' '}
                        <a href="/signin" className="text-blue-700 font-bold">
                            Log in
                        </a>
                    </p>
                </form>
                <ToastContainer />
            </div>
        </>
    );
};

export default Signup;