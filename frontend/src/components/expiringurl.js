import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import baseUrl from "../URL";
import { Link } from "react-router-dom";

const ExpiringURL = () => {
    const [sslData, setSslData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expiredData, setExpiredData] = useState([]);

    // Track screen size for conditional rendering
    const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 760);

    useEffect(() => {
        const fetchSSLDetails = async () => {
            try {
                const response = await axios.get(`${baseUrl}/all-ssl`, { withCredentials: true });

                if (response.data && response.data.data) {
                    const allSSLs = response.data.data;

                    // Filter SSLs expiring in 30 days or less
                    const filteredData = allSSLs.filter((ssl) => ssl.daysRemaining <= 30);
                    setSslData(filteredData);

                    // Filter expired SSLs (validTo date is in the past)
                    const expired = allSSLs.filter((ssl) => new Date(ssl.validTo) < new Date());
                    setExpiredData(expired);
                } else {
                    throw new Error("Invalid response structure");
                }
            } catch (err) {
                console.error("Error fetching SSL details:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSSLDetails();

        // Handle screen resize
        const handleResize = () => setIsSmallScreen(window.innerWidth < 740);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className="relative">
            {/* Floating Button (for small screens) */}
            {isSmallScreen && sslData.length > 0 && (
                <motion.button
                    className={`${isModalOpen ? '' : 'fixed bottom-10 right-6 flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-full shadow-2xl transition-all hover:bg-red-700 hover:scale-105 hover:shadow-red-500/50'}`}
                    onClick={() => setIsModalOpen(true)}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <svg className=" w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M5.6 19h12.8a2 2 0 0 0 1.74-3L13.74 5a2 2 0 0 0-3.48 0L3.86 16a2 2 0 0 0 1.74 3Z" />
                    </svg>
                    <span className="font-bold text-lg">Expiring SSLs</span>
                </motion.button>
            )}

            {/* Expiring SSL Modal */}
            <AnimatePresence>
                {(isSmallScreen ? isModalOpen : sslData.length > 0) && (
                    <motion.div
                        className="fixed right-0 top-12 -translate-y-1/2 mt-10 mb-12 flex items-center justify-end h-auto p-2 bg-none"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onClick={() => isSmallScreen && setIsModalOpen(false)}
                    >
                        <motion.div
                            className="bg-white w-96 max-h-[85vh] overflow-y-auto p-6 shadow-xl rounded-lg"
                            initial={{ x: isSmallScreen ? "100%" : 0 }}
                            animate={{ x: 0 }}
                            exit={{ x: isSmallScreen ? "100%" : 0 }}
                            transition={{ duration: 0.5 }}
                            onClick={(e) => e.stopPropagation()}
                        >

                            {loading ? (
                                <p className="text-center text-lg font-semibold">Loading...</p>
                            ) : error ? (
                                <p className="text-center text-red-500">Error: {error}</p>
                            ) : sslData.length === 0 ? (
                                <p className="text-center text-gray-500">No expiring URLs in the next 30 days.</p>
                            ) : (<>
                                <div className="space-y-1">
                                    <h2 className='text-red-600 text-lg font-bold'>Expiring SSL Certificates</h2>
                                    {sslData.filter(ssl => ssl.expiryStatus !== 'Expired').length === 0 ? (
                                        <p className="text-gray-500 font-semibold mt-4">No expiring SSL certificates.</p>
                                    ) : (
                                        sslData.map((ssl) => (
                                            ssl.expiryStatus !== 'Expired' && (
                                                <motion.div
                                                    key={ssl._id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ duration: 0.5 }}
                                                >
                                                    <div className="mt-3 bg-gray-100 p-3 rounded-lg shadow-md hover:shadow-lg transition">
                                                        <h2 className="text-lg font-bold text-gray-900">{ssl.url}</h2>
                                                        <p className="text-sm text-gray-700">
                                                            Expires in{" "}
                                                            <span className="font-semibold text-red-600">{ssl.daysRemaining}</span> days
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )
                                        ))
                                    )}

                                </div>
                                <h1 className="text-lg font-bold text-red-600 mt-4">Expired SSL Certificates</h1>
                                <div className="space-y-1">
                                    {sslData.filter(ssl => ssl.expiryStatus === 'Expired').length === 0 ? (
                                        <p className="text-gray-500 font-semibold mt-4">No expired SSL certificates.</p>
                                    ) : (
                                        sslData.map((ssl) => (
                                            ssl.expiryStatus === 'Expired' && (
                                                <motion.div
                                                    key={ssl._id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ duration: 0.5 }}
                                                >
                                                    <div className="mt-3 bg-gray-100 p-3 rounded-lg shadow-md hover:shadow-lg transition">
                                                        <h2 className="text-lg font-bold text-gray-900">{ssl.url}</h2>
                                                        <p className="text-sm text-gray-700">
                                                            Expired before{" "}
                                                            <span className="font-semibold text-red-600">
                                                                {-1 * ssl.daysRemaining}
                                                            </span>{" "}
                                                            days
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )
                                        ))
                                    )}

                                </div></>
                            )}

                            {/* View More Button */}
                            <Link to="/export">
                                <button className="w-full mt-4 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition">
                                    View
                                </button>
                            </Link>

                            {/* Close Button (Only for small screens) */}
                            {isSmallScreen && (
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full mt-4 bg-gray-700 text-white py-2 rounded-md hover:bg-gray-800 transition"
                                >
                                    Close
                                </button>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ExpiringURL;