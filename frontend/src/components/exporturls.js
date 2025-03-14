import React, { useEffect, useState } from "react";
import axios from "axios";
import baseUrl from "../URL";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; 
import { FaFilePdf, FaFileExcel } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";

const Report = () => {
    const [sslData, setSslData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterDays, setFilterDays] = useState(30);
    const [filterType, setFilterType] = useState("less");
    const [expiredData, setExpiredData] = useState([]);
    const [isExpiredFilter, setIsExpiredFilter] = useState(false);

    useEffect(() => {
        const fetchSSLDetails = async () => {
            try {
                const response = await axios.get(`${baseUrl}/all-ssl`, { withCredentials: true });
                if (response.data && response.data.data) {
                    setSslData(response.data.data);
                } else {
                    throw new Error("Invalid response structure");
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchSSLDetails();
    }, []);

    useEffect(() => {
        const expired = sslData.filter(ssl => new Date(ssl.validTo) < new Date());
        setExpiredData(expired);
    }, [sslData]);
    
    useEffect(() => {
        let filtered;
        if (filterType === "expired") {
            filtered = expiredData;
            setIsExpiredFilter(true);
        } else {
            filtered = sslData.filter(ssl => {
                const daysRemaining = isNaN(ssl.daysRemaining) ? null : ssl.daysRemaining; // Ensure it's a number
                
                if (daysRemaining === null) return false; // Ignore "Expired" entries
                
                return filterType === "less" ? daysRemaining <= filterDays 
                     : filterType === "greater" ? daysRemaining > filterDays 
                     : daysRemaining === Number(filterDays);
            });
    
            setIsExpiredFilter(false);
        }
        setFilteredData(filtered);
    }, [filterDays, filterType, sslData, expiredData]);
    

    const formatToIST = (dateString) => {
        return new Date(dateString).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    };

    const exportToExcel = () => {
        const exportData = filteredData.map(({ url, issuedTo, issuedBy, validFrom, validTo, siteManager, email, daysRemaining }) => ({
            url,
            issuedTo: issuedTo?.commonName || "N/A",
            issuedBy: issuedBy?.commonName || "N/A",
            validFrom: formatToIST(validFrom),
            validTo: formatToIST(validTo),
            siteManager: siteManager || "N/A",
            email: email || "N/A",
            validity: isExpiredFilter ? "Expired" : `${daysRemaining} days`,
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, isExpiredFilter ? "Expired SSLs" : "Expiring SSLs");
        XLSX.writeFile(workbook, isExpiredFilter ? "Expired_SSLs.xlsx" : "Expiring_SSLs.xlsx");
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text(isExpiredFilter ? "Expired SSL Certificates Report" : "Expiring SSL Certificates Report", 14, 10);

        const tableColumn = ["S.No", "URL", "Issued To", "Issued By", "Valid From", "Valid To", "Site Manager", "Email", "Status"];
        const tableRows = filteredData.map((ssl, index) => ([
            index + 1,
            ssl.url,
            ssl.issuedTo?.commonName || "N/A",
            ssl.issuedBy?.commonName || "N/A",
            formatToIST(ssl.validFrom),
            formatToIST(ssl.validTo),
            ssl.siteManager || "N/A",
            ssl.email || "N/A",
            isExpiredFilter ? "Expired" : `${ssl.daysRemaining} days`
        ]));

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 6 },
            theme: "grid"
        });

        doc.save(isExpiredFilter ? "Expired_SSLs.pdf" : "Expiring_SSLs.pdf");
    };

    return (
        <div className="px-10 p-2 min-h-screen mx-auto bg-cover bg-center overflow-auto" style={{ backgroundImage: "url('./landingpage2.png')" }}>

            <h1 className="text-2xl font-bold text-center mb-6">SSL Certificates Report</h1>
            <div className="flex flex-wrap gap-4 mb-6">
                <input 
                    type="number" 
                    value={filterDays} 
                    onChange={(e) => setFilterDays(e.target.value)} 
                    className="border px-3 py-2 rounded w-40" 
                    placeholder="Enter days" 
                    disabled={isExpiredFilter} 
                />
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 rounded w-40">
                    <option value="less">Less than</option>
                    <option value="greater">Greater than</option>
                    <option value="equal">Equal to</option>
                    <option value="expired">Expired</option>
                </select>
                <div className="flex gap-4">
                    <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2"><FaFileExcel /> Excel</button>
                    <button onClick={exportToPDF} className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2"><FaFilePdf /> PDF</button>
                </div>
            </div>
            {loading ? (
                <p className="text-center text-lg font-semibold">Loading...</p>
            ) : error ? (
                <p className="hidden">{toast.error(error==="Request failed with status code 401"?"your session has Expired, please login":error)}</p>
            ) : filteredData.length === 0 ? (
                <p className="text-center text-gray-500">No matching SSLs.</p>
            ) : (
                <div className="overflow-auto max-h-[80vh] rounded-lg">

                    <table className="w-full overflow-y-auto   bg-white border-collapse">
                        <thead>
                            <tr className="bg-sky-300 sticky top-0">
                                <th className="p-3 text-left">S.No</th>
                                <th className="p-3 text-left">URL</th>
                                <th className="p-3 text-left">Issued To</th>
                                <th className="p-3 text-left">Issued By</th>
                                <th className="p-3 text-left">Valid From</th>
                                <th className="p-3 text-left">Valid To</th>
                                <th className="p-3 text-left">Site Manager</th>
                                <th className="p-3 text-left">Email</th>
                                <th className="p-3 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((ssl, index) => (
                                <tr key={ssl._id} className="border-b">
                                    <td className="p-3">{index + 1}</td>
                                    <td className="p-3">{ssl.url}</td>
                                    <td className="p-3">{ssl.issuedTo?.commonName || "-"}</td>
                                    <td className="p-3">{ssl.issuedBy?.commonName || "-"}</td>
                                    <td className="p-3">{formatToIST(ssl.validFrom)}</td>
                                    <td className="p-3">{formatToIST(ssl.validTo==="Expired")}</td>
                                    <td className="p-3">{ssl.siteManager || "-"}</td>
                                    <td className="p-3">{ssl.email || "-"}</td>
                                    <td className={`p-3 font-semibold ${isExpiredFilter || ssl.daysRemaining <= "30" ? "text-red-600" : ""}`}>
                                        {isExpiredFilter ? "Expired" : `${ssl.daysRemaining} days`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Report;
