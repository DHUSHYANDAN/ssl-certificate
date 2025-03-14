import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import baseUrl from "../URL";
import { FaSpinner } from "react-icons/fa";


const Home = () => {
    const [url, setUrl] = useState("");
    const [siteManager, setSiteManager] = useState("");
    const [email, setEmail] = useState("");
    const [certificate, setCertificate] = useState(null);
    const [isValid, setIsValid] = useState(true);
    const [loading, setLoading] = useState(false);

    // Validate URL
    const validateUrl = (value) => {
        try {
            new URL(value);
            return true;
        } catch (_) {
            return false;
        }
    };

    // Ensure HTTPS format
    const formatUrlToHttps = (value) => {
        try {
            let parsedUrl = new URL(value);
            parsedUrl.protocol = "https:";
            return parsedUrl.origin;
        } catch (_) {
            return null;
        }
    };

    // Handle URL input change
    const handleChange = (e) => {
        setUrl(e.target.value);
        setIsValid(validateUrl(e.target.value));
    };

    // Fetch SSL details
    const fetchSSLDetails = async () => {
        if (!isValid) return toast.error("Enter a valid URL", { autoClose: 2000 });

        let formattedUrl = formatUrlToHttps(url);
        if (!formattedUrl) return toast.error("Invalid URL format", { autoClose: 2000 });

        setLoading(true);
        try {
            const response = await fetch(`${baseUrl}/fetch-ssl`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: formattedUrl }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to fetch SSL data");

            setCertificate(data.data);
            toast.success(data.message || "SSL data retrieved!", { autoClose: 2000 });
        } catch (error) {
            if (error.message === "Socketerror" || error.message === "TLS error") {
                toast.error("website is not reachable");
            } else if (error.message === "Not authorized, no token") {
               toast.error("Your session has Expired, Please login");
            }else {
                toast.error(error.message);
                }
        }
        setLoading(false);
    };

    const convertToIST = (utcDate) => {
        return new Date(utcDate).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    };

    // Validate email format
    const validateEmail = (email) => {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
        return emailRegex.test(email);
    };

    // Save Manager Details
    const saveManagerDetails = async () => {
        if (!siteManager || !email) return toast.error("Please fill in all fields", { autoClose: 2000 });
        if (!validateEmail(email)) return toast.error("Enter a valid email address", { autoClose: 2000 });

        setLoading(true);
        let formattedUrl = formatUrlToHttps(url);
        if (!formattedUrl) return toast.error("Invalid URL format", { autoClose: 2000 });

        try {
            const response = await fetch(`${baseUrl}/mail-to-sitemanager`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: formattedUrl, siteManager, email }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to save manager details");

            toast.success(data.message, { autoClose: 2000 });
            setSiteManager("");
            setEmail("");
        } catch (error) {
            toast.error(error.message, { autoClose: 2000 });
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col p-5 sm:pl-16 md:pl-5 md:items-start  lg:pl-[220px] xl:pl-0 xl:items-center  pt-6  min-h-screen bg-gray-100 bg-cover bg-center" style={{ backgroundImage: "url('./landingpage2.png')" }}>
           
            <h1 className="text-3xl font-bold mb-6">Monitor SSL Certificate</h1>

            {/* URL Input Section */}
            <div className="w-full md:w-2/5 bg-gray-700 p-6 opacity-80 rounded shadow-md">
                <label className="block text-gray-100 text-sm font-bold mb-2">Enter the URL</label>
                <input
                    type="text"
                    value={url}
                    onChange={handleChange}
                    className={`w-full p-2 border-2 outline-none focus:border-sky-500 ${isValid ? 'border-gray-300' : 'border-red-500'} rounded mb-1`}
                    placeholder="Enter website URL"
                />
                {!isValid && <p className="text-red-500 font-bold">Enter a valid URL</p>}

                <button
                    onClick={fetchSSLDetails}
                    className="relative inline-flex mt-2 items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-cyan-500 to-blue-500 hover:text-white focus:ring-4 focus:outline-none focus:ring-cyan-200"
                    disabled={loading}
                >
                    <span className="relative px-5 py-2.5 transition-all ease-in duration-75 bg-white  rounded-md group-hover:bg-transparent">
                    {loading ? <FaSpinner className="animate-spin mr-2 inline" /> : null}
                        {loading ? "Fetching..." : "Fetch SSL Details"}
                    </span>
                </button>
            </div>

            {/* SSL Certificate Details */}
            {certificate && (
  <div className="mt-6 w-full max-w-lg bg-gray-700 p-4 opacity-80 rounded shadow-md">
    <h2 className="text-xl font-bold text-white mb-4">SSL Certificate Details</h2>
    <div className="overflow-x-auto">
      <table className="w-full border border-gray-300 rounded-lg shadow-sm">
        <tbody>
          {[
            { label: "URL", value: certificate.url },
            { label: "Issued To", value: `${certificate.issuedTo.commonName} (${certificate.issuedTo.organization})` },
            { label: "Issued By", value: `${certificate.issuedBy.commonName} (${certificate.issuedBy.organization})` },
            { label: "Valid From", value: convertToIST(certificate.validFrom) },
            { label: "Valid To", value: convertToIST(certificate.validTo) },
          ].map((item, index) => (
            <tr key={item.label} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
              <th className="px-4 py-3 text-gray-700 font-semibold border-b border-gray-300 text-left">
                {item.label}:
              </th>
              <td className="px-4 py-3 border-b border-gray-300 break-words">{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}


            {/* Site Manager Details */}
            {certificate && (
                <div className="mt-6 w-full md:w-3/6 bg-gray-700 opacity-80 p-6 rounded shadow-md">
                    <h1 className="text-xl text-white font-bold mb-6">SSL Certificate Manager Details</h1>
                    <label className="block text-gray-100 text-sm font-bold mb-2">Enter Site Manager Name</label>
                    <input type="text" value={siteManager} onChange={(e) => setSiteManager(e.target.value)} className="w-full p-2 border-2 border-gray-300 rounded mb-3" placeholder="Enter Name" />

                    <label className="block text-gray-100 text-sm font-bold mb-2">Enter Manager Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border-2 border-gray-300 rounded mb-3" placeholder="Enter Email" />

                    <button onClick={saveManagerDetails} className="relative inline-flex mt-2 items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-cyan-500 to-blue-500 hover:text-white focus:ring-4 focus:outline-none focus:ring-cyan-200">
                    <span className="relative px-5 py-2.5 transition-all ease-in duration-75 bg-white  rounded-md group-hover:bg-transparent">
                    {loading ? <FaSpinner className="animate-spin mr-2 inline" /> : null}
                        {loading ? "Saving..." : "Send Email"}</span>
                    </button>
                </div>
            )}

            <ToastContainer autoClose={2000} />
          
        </div>
    );
};

export default Home;
