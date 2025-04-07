import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import baseUrl from "../URL";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FaFilePdf, FaFileExcel } from "react-icons/fa";
import { toast } from "react-toastify";

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
                if (response.data?.data) {
                    setSslData(response.data.data);
                } else {
                    throw new Error("Invalid response structure");
                }
            } catch (err) {
                setError(err.message);
                if (err.response?.status === 401) {
                    toast.error("Your session has expired, please login.");
                }
            } finally {
                setLoading(false);
            }
        };
        fetchSSLDetails();
    }, []);

    useEffect(() => {
        setExpiredData(sslData.filter(ssl => new Date(ssl.validTo) < new Date()));
    }, [sslData]);

    useEffect(() => {
        let filtered;
        if (filterType === "expired") {
            filtered = expiredData;
            setIsExpiredFilter(true); // Setting expired filter correctly
        } else {
            filtered = sslData.filter(({ daysRemaining }) => {
                if (isNaN(daysRemaining)) return false; // Ignore expired entries
                return filterType === "less"
                    ? daysRemaining <= filterDays  && daysRemaining > 0
                    : filterType === "greater"
                        ? daysRemaining > filterDays
                        : daysRemaining === Number(filterDays);
            });
            setIsExpiredFilter(false); // Clearing expired filter when other filters are selected
        }
        setFilteredData(filtered);
    }, [filterDays, filterType, sslData, expiredData]);


    const formatToIST = (dateString) =>
        new Date(dateString).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const exportToExcel = useCallback(() => {
        const exportData = filteredData.map(({ url, issuedToCommonName, issuedByCommonName, validFrom, validTo, siteManager, email, daysRemaining }) => ({
            "URL": url,
            "ISSUED TO": issuedToCommonName || "N/A",
            "ISSUED BY": issuedByCommonName || "N/A",
            "VALID FROM": formatToIST(validFrom),
            "VALID TO": formatToIST(validTo),
            "SITE MANAGER": siteManager || "N/A",
            "EMAIL": email || "N/A",
            "STATUS": daysRemaining<=0 ? "EXPIRED" : `${daysRemaining} days`,
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        worksheet["!cols"] = Object.keys(exportData[0]).map(() => ({ wch: 20 }));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, isExpiredFilter ? "EXPIRED SSLS" : "EXPIRING SSLS");
        XLSX.writeFile(workbook, isExpiredFilter ? "EXPIRED_SSLS.xlsx" : "EXPIRING_SSLS.xlsx");
    }, [filteredData, isExpiredFilter]);

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text(isExpiredFilter ? "Expired SSL Certificates Report" : "Expiring SSL Certificates Report", 14, 10);

        const tableColumn = ["S.No", "URL", "Issued To", "Issued By", "Valid From", "Valid To", "Site Manager", "Email", "Status"];
        const tableRows = filteredData.map((ssl, index) => ([
            index + 1,
            ssl.url,
            ssl.issuedToCommonName || "N/A",
            ssl.issuedByCommonName || "N/A",
            formatToIST(ssl.validFrom),
            formatToIST(ssl.validTo),
            ssl.siteManager || "N/A",
            ssl.email || "N/A",
            ssl.daysRemaining <=0 ? "Expired" : `${ssl.daysRemaining} days`
        ]));

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 25, // Increase gap between title and table
            margin: { top: 10, left: 10, right: 10 }, // Adjust margin
            styles: {
                fontSize: 8, // Default font size for the table
                cellPadding: 2, // Space inside cells
                textColor: [0, 0, 0], // Black text
            },
            headStyles: {
                fillColor: [56, 178, 255], // Sky-400 Header
                textColor: [255, 255, 255], // White text
                fontSize: 8,
                halign: "center", // Center align header text
            },
            bodyStyles: {
                fillColor: [240, 240, 240], // Light gray background
                textColor: [0, 0, 0], // Black text
                fontSize: 8,
            },
            columnStyles: {
                0: { halign: "center", cellWidth: 12 }, // S.No centered
                1: { cellWidth: 30 }, // URL wider
                2: { cellWidth: 25 }, // Issued To
                3: { cellWidth: 25 }, // Issued By
                4: { cellWidth: 20 }, // Valid From
                5: { cellWidth: 20 }, // Valid To
                6: { cellWidth: 20 }, // Site Manager
                7: { cellWidth: 25 }, // Email
                8: { halign: "center", cellWidth: 18 }, // Status centered
            },
            theme: "grid",
            didDrawCell: (data) => {
                if (data.section === "body" && data.column.index === 8) {
                    const status = data.cell.raw;
                    if (status === "Expired") {
                        data.cell.styles.textColor = [255, 0, 0]; // Red text for expired SSLs
                    }
                }
            }
        });

        doc.save(isExpiredFilter ? "Expired_SSLs_details.pdf" : "Expiring_SSLs_details.pdf");
    };

    return (
        <div className="px-10 p-2 min-h-screen mx-auto bg-cover bg-center overflow-auto" style={{ backgroundImage: "url('./landingpage2.png')" }}>

            <h1 className="text-2xl font-bold text-center mb-6">SSL Certificates Report</h1>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                {/* Left Side - Filter Controls */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    {/* Filter Controls - Stack on Mobile, Inline on Desktop */}
                    <div className="flex flex-col md:flex-row md:items-center gap-4 w-full">
                        <label className="text-gray-700 font-medium">Filter SSLs by days:</label>
                        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                            <input
                                type="number"
                                value={filterDays}
                                onChange={(e) => setFilterDays(e.target.value)}
                                className="border px-3 py-2 rounded w-full sm:w-40 focus:outline-none focus:ring focus:ring-blue-300"
                                placeholder={filterDays ? `${filterDays} days` : "Enter days"}
                                disabled={isExpiredFilter}
                            />
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="border px-3 py-2 rounded w-full sm:w-40 focus:outline-none focus:ring focus:ring-blue-300"
                            >
                                <option value="less">Less than</option>
                                <option value="greater">Greater than</option>
                                <option value="equal">Equal to</option>
                                <option value="expired">Expired</option>
                            </select>
                        </div>
                    </div>


                </div>


                {/* Right Side - Export Buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={exportToExcel}
                        className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 shadow-md hover:bg-green-700 transition"
                    >
                        <FaFileExcel /> Excel
                    </button>
                    <button
                        onClick={exportToPDF}
                        className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2 shadow-md hover:bg-red-700 transition"
                    >
                        <FaFilePdf /> PDF
                    </button>
                </div>
            </div>

            {loading ? (
                <p className="text-center text-lg font-semibold">Loading...</p>
            ) : error ? (
                <p className="hidden">{toast.error(error === "Request failed with status code 401" ? "your session has Expired, please login" : error)}</p>
            ) : filteredData.length === 0 ? (
                <p className="text-center text-gray-500">No matching SSLs.</p>
            ) : (<>
                <p className="flex items-center gap-3 text-gray-800 bg-white shadow-md rounded-t-md p-3 font-mono border border-gray-200">
                    <span className="text-lg font-semibold">Total SSLs:</span>
                    <span className="bg-sky-400 text-white font-bold rounded-full px-3 py-1 text- shadow-md">
                        {filteredData.length}
                    </span>
                </p>


                <div className="overflow-auto max-h-[80vh]   ">
                    <table className="w-full overflow-y-auto  text-nowrap mb-3 bg-white border-collapse">
                        <thead>
                            <tr className="bg-sky-300 sticky   top-0">
                                <th className="p-3 border-r-2  text-left">S.No</th>
                                <th className="p-3 border-r-2 text-left">URL</th>
                                <th className="p-3 border-r-2 text-left">Issued To</th>
                                <th className="p-3 border-r-2 text-left">Issued By</th>
                                <th className="p-3 border-r-2 text-left">Valid From</th>
                                <th className="p-3 border-r-2 text-left">Valid To</th>
                                <th className="p-3 border-r-2 text-left">Site Manager</th>
                                <th className="p-3 border-r-2 text-left">Email</th>
                                <th className="p-3 border-r-2 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-[14px]">
                            {filteredData.map((ssl, index) => (
                                <tr key={ssl.sslId} className="border-b">
                                    <td className="p-6">{index + 1}</td>
                                    <td className="p-3">{ssl.url}</td>
                                    <td className="p-3">{ssl.issuedToCommonName || "-"}</td>
                                    <td className="p-3">{ssl.issuedByCommonName || "-"}</td>
                                    <td className="p-3">{formatToIST(ssl.validFrom)}</td>
                                    <td className="p-3">{formatToIST(ssl.validTo)}</td>
                                    <td className="p-3">{ssl.siteManager || "-"}</td>
                                    <td className="p-3">{ssl.email || "-"}</td>
                                    <td className={`p-3 font-semibold ${isExpiredFilter || ssl.daysRemaining <= 30 ? "text-red-600" : ""}`}>
                                        {ssl.daysRemaining <=0 ? "Expired" : `${ssl.daysRemaining} days`}
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </>
            )}
        </div>
    );
};

export default Report;
