import React, { useEffect, useState } from "react";
import axios from "axios";
import baseUrl from "../URL";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; 

import { FaFilePdf, FaFileExcel } from "react-icons/fa";

const Report = () => {
    const [sslData, setSslData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterDays, setFilterDays] = useState(50);
    const [filterType, setFilterType] = useState("less");

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
        let filtered = sslData.filter(ssl => 
            filterType === "less" ? ssl.daysRemaining <= filterDays : 
            filterType === "greater" ? ssl.daysRemaining > filterDays : 
            ssl.daysRemaining === Number(filterDays)
        );
        setFilteredData(filtered);
    }, [filterDays, filterType, sslData]);

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
            validity: `${daysRemaining} days`,
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Expiring SSLs");
        XLSX.writeFile(workbook, "Expiring_SSLs.xlsx");
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text("Expiring SSL Certificates Report", 14, 10);
    
        const tableColumn = ["S.No", "URL", "Issued To", "Issued By", "Valid From", "Valid To", "Site Manager", "Email", "Validity"];
        const tableRows = filteredData.map((ssl, index) => ([
            index + 1,
            ssl.url,
            ssl.issuedTo?.commonName || "N/A",
            ssl.issuedBy?.commonName || "N/A",
            formatToIST(ssl.validFrom),
            formatToIST(ssl.validTo),
            ssl.siteManager || "N/A",
            ssl.email || "N/A",
            `${ssl.daysRemaining} days`
        ]));
    
        autoTable(doc, { // Correctly using autoTable
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 6 },
            theme: "grid"
        });
    
        doc.save("Expiring_SSLs.pdf");
    };
    

    return (
        <div className="px-10 p-2 mx-auto bg-cover bg-center h-screen " style={{ backgroundImage: "url('./landingpage2.png')" }}>
            <h1 className="text-2xl font-bold text-center mb-6">Expiring SSL Certificates Report</h1>
            <div className="flex flex-wrap gap-4 mb-6">
                <input type="number" value={filterDays} onChange={(e) => setFilterDays(e.target.value)} className="border px-3 py-2 rounded w-40" placeholder="Enter days" />
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className=" px-3 py-2 rounded w-40">
                    <option value="less">Less than</option>
                    <option value="greater">Greater than</option>
                    <option value="equal">Equal to</option>
                </select>
                <div className="flex gap-4">
                    <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2"><FaFileExcel /> Excel</button>
                    <button onClick={exportToPDF} className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2"><FaFilePdf /> PDF</button>
                </div>
            </div>
            {loading ? <p className="text-center text-lg font-semibold">Loading...</p> : error ? <p className="text-center text-red-500">Error: {error}</p> : filteredData.length === 0 ? <p className="text-center text-gray-500">No matching SSLs.</p> : (
                <div className="overflow-x-auto bg-white shadow-md rounded-lg">
                    <table className="w-full min-w-[1200px] border-collapse">
                        <thead>
                            <tr className="bg-sky-400/50">
                                <th className="p-3 text-left">S.No</th>
                                <th className="p-3 text-left">URL</th>
                                <th className="p-3 text-left">Issued To</th>
                                <th className="p-3 text-left">Issued By</th>
                                <th className="p-3 text-left">Valid From</th>
                                <th className="p-3 text-left">Valid To</th>
                                <th className="p-3 text-left">Site Manager</th>
                                <th className="p-3 text-left">Email</th>
                                <th className="p-3 text-left">Validity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((ssl, index) => (
                                <tr key={ssl._id} className="border-b">
                                    <td className="p-3 text-left">{index + 1}</td>
                                    <td className="p-3">{ssl.url}</td>
                                    <td className="p-3">{ssl.issuedTo?.commonName || "-"}</td>
                                    <td className="p-3">{ssl.issuedBy?.commonName || "-"}</td>
                                    <td className="p-3">{formatToIST(ssl.validFrom)}</td>
                                    <td className="p-3">{formatToIST(ssl.validTo)}</td>
                                    <td className="p-3">{ssl.siteManager || "-"}</td>
                                    <td className="p-3">{ssl.email || "-"}</td>
                                    <td className="p-3 text-red-600 font-semibold">{ssl.daysRemaining} days</td>
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