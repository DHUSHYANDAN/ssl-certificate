import React, { useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import baseUrl from "../URL";

const Home = () => {
    const [url, setUrl] = useState("");
    const [siteManager, setSiteManager] = useState("");
    const [email, setEmail] = useState("");
    const [certificate, setCertificate] = useState(null);
    const [isValid, setIsValid] = useState(true);
    const [loading, setLoading] = useState(false);


    const validateUrl = (value) => {
        try {
            new URL(value);
            return true;
        } catch (_) {
            return false;
        }
    };

    const handleChange = (e) => {
        setUrl(e.target.value);
        setIsValid(validateUrl(e.target.value));
    };

    const fetchSSLDetails = async () => {
        if (!isValid) return toast.error("Enter a valid URL");

        setLoading(true);
        try {
            const response = await fetch(`${baseUrl}/fetch-ssl`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to fetch SSL data");

            setCertificate(data.data);
            toast.success(data.message || "SSL data retrieved!");
        } catch (error) {
            if (error.message === "Socketerror") {
                toast.error("It is not a valid URL");
            } else {
                toast.error(error.message);
            }
        }
        setLoading(false);
    };
    const validateEmail = (email) => {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
        return emailRegex.test(email);
    };
    const saveManagerDetails = async () => {
        if (!siteManager || !email) {
            return toast.error("Please fill in all fields");
        }
    
        if (!validateEmail(email)) {
            return toast.error("Please enter a valid email address");
        }    
        setLoading(true);
        try {
            const response = await fetch(`${baseUrl}/mail-to-sitemanager`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, siteManager, email })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to save manager details");

            toast.success(data.message);
        } catch (error) {
            if (error.message === "Socketerror") {
                toast.error("It is not a valid URL");
            } else {
                toast.error(error.message);
            }

        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col  items-center pt-6 min-h-screen bg-gray-100 bg-cover bg-center" style={{ backgroundImage: "url('./landingpage2.png')" }}>
            <h1 className="text-3xl font-bold mb-6">Monitor SSL Certificate</h1>
            <div className="w-full md:w-3/6 bg-gray-700 p-6 opacity-80 rounded shadow-md">
                <label className="block text-gray-100 text-sm font-bold mb-2" >Enter the URL</label>
                <input
                    type="text"
                    value={url}
                    onChange={handleChange}
                    className={`w-full p-2 border-2 outline-none focus:border-sky-500  ${isValid ? 'border-gray-300' : 'border-red-500'} rounded mb-1`}
                    placeholder="Enter website URL"
                />
                {!isValid && <p className="text-red-500 font-bold">Enter a valid URL</p>}
                <button
                    onClick={fetchSSLDetails}
                    className="relative inline-flex mt-2 items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-cyan-500 to-blue-500 group-hover:from-cyan-500 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-cyan-200 dark:focus:ring-cyan-800"
                    disabled={loading}
                >
                    <span class="relative px-5 py-2.5 transition-all ease-in duration-75 bg-white dark:bg-gray-900 rounded-md group-hover:bg-transparent group-hover:dark:bg-transparent">
                        {loading ? "Fetching..." : "Fetch SSL Details"}
                    </span>

                </button>
            </div>
            {certificate && (
                <div className="mt-6 bg-gray-700 p-4 opacity-80 rounded shadow-md">
                    <h2 className="text-xl font-bold text-white mb-4">SSL Certificate Details</h2>
                    <table className="w-full border  border-gray-300 rounded-lg shadow-sm overflow-hidden">
                        <tbody>
                            {[
                                { label: "URL", value: certificate.url },
                                { label: "Issued To", value: `${certificate.issuedTo.commonName} (${certificate.issuedTo.organization})` },
                                { label: "Issued By", value: `${certificate.issuedBy.commonName} (${certificate.issuedBy.organization})` },
                                { label: "Valid From", value: certificate.validFrom },
                                { label: "Valid To", value: certificate.validTo },
                            ].map((item, index) => (
                                <tr key={item.label} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                                    <th className="px-4 py-3 text-gray-700 font-semibold border-b border-gray-300">{item.label}:</th>
                                    <td className="px-4 py-3 border-b border-gray-300">{item.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                </div>
            )}
           {certificate &&( <div className="mt-6 w-full md:w-3/6 bg-gray-700 opacity-80 p-6 rounded shadow-md">
            <h1 className="text-xl text-white font-bold mb-6"> SSL Certificate Manager Details</h1>
            <label className="block text-gray-100 text-sm font-bold mb-2" >Enter the Site Manager Name</label>
                <input
                    type="text"
                    value={siteManager}
                    onChange={(e) => setSiteManager(e.target.value)}
                    className="w-full p-2 border-2 outline-none focus:border-sky-500 border-gray-300 rounded mb-3"
                    placeholder="Enter Site Manager Name"
                />
                 <label className="block text-gray-100 text-sm font-bold mb-2" >Enter the Manager Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 border-2 outline-none focus:border-sky-500 border-gray-300 rounded mb-3"
                    placeholder="Enter Email"
                />
                <button
                    onClick={saveManagerDetails}
                    className="relative inline-flex items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-cyan-500 to-blue-500 group-hover:from-cyan-500 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-cyan-200 dark:focus:ring-cyan-800"
                    disabled={loading}
                >
                    <span class="relative px-5 py-2.5 transition-all ease-in duration-75 bg-white dark:bg-gray-900 rounded-md group-hover:bg-transparent group-hover:dark:bg-transparent">
                        {loading ? "Saving..." : "Save Manager Details"}
                    </span>

                </button>
            </div>)}
        </div>
    );
};

export default Home;
