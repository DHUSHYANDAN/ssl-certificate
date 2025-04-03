import React, { useEffect, useMemo, useState } from "react";
import { MaterialReactTable } from "material-react-table";
import { FaSpinner } from "react-icons/fa";
import { FaEye } from 'react-icons/fa';
import {
  Box,
  IconButton,
  Tooltip,
  Modal,
  Button,
  Typography,
  Divider, Grid
} from "@mui/material";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import baseUrl from "../URL";
import { TextField, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
// import { useMaterialReactTable } from 'material-react-table';
// Fetch SSL Details remains unchanged using react-query


const useGetSSLDetails = () =>
  useQuery({
    queryKey: ["sslDetails"],
    queryFn: async () => {
      const { data } = await axios.get(`${baseUrl}/all-ssl`, {
        withCredentials: true,
      });
      return data.data;
    },
  });



// Delete SSL Entry with Toast Notification using a custom hook
const useDeleteSSL = (setLoading) => {
  const queryClient = useQueryClient();

  return async (sslId) => {
    if (!sslId) {
      toast.error("SSL ID is required!");
      throw new Error("SSL ID is required");
    }

    setLoading(true);
    try {
      const response = await axios.delete(`${baseUrl}/ssl-delete`, {
        data: { sslId },
        withCredentials: true,
      });

      if (response.status === 200) {
        toast.success("Deleted successfully!", { autoClose: 2000 });
        await queryClient.invalidateQueries({ queryKey: ["sslDetails"] });
      }
    } catch (error) {
      console.log("Failed to delete SSL:", error, sslId);

      console.error("Failed to delete SSL:", error?.response?.data?.message || error.message);

      // Show user-friendly error messages
      const errorMessage =
        error?.response?.data?.message || "Something went wrong while deleting SSL.";

      toast.error(errorMessage);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    }
  };
};


// Query Client Provider
const queryClient = new QueryClient();

export default function App() {
  const [loading, setLoading] = useState(false);
  return (
    <QueryClientProvider client={queryClient}>
      <SSLTable loading={loading} setLoading={setLoading} />
      <ToastContainer position="top-right" autoClose={2000} />
    </QueryClientProvider>
  );
}
const SSLTable = ({ loading, setLoading }) => {


  // const { sslDetails, setsslDetails } = useState([])
  // const {isLoading, setisLoading } = useState(false)


  const { data: sslDetails = [], isLoading } = useGetSSLDetails();

  // useEffect(() => {
  //   fetchdata()
  // }, [])


  //   const fetchdata =()=>{
  //     const res = axios.get(`${baseUrl}/all-ssl`,{
  //       withCredentials: true,
  //     })
  //     .then((response) => {
  //       // setsslDetails(response.data)
  //       console.log(response.data.data)
  //       })
  //       .catch((error) => {
  //         console.error(error);
  //         });
  //   }



  //   useEffect(() => {
  //     const demo = useGetSSLDetails()

  // }, [])

  // 🔍 Global Search State
  const [globalFilter, setGlobalFilter] = useState("");

  // 📌 Custom Global Filter Function
  const processedData = useMemo(() => {
    if (!sslDetails) return [];

    let data = [...sslDetails];

    // Apply Filtering
    if (globalFilter) {
      const lowerCaseFilter = globalFilter.toLowerCase();

      data = data.filter((row) => {
        return Object.values(row).some((value) => {
          if (!value) return false;

          const stringValue = String(value).toLowerCase();
          if (stringValue.includes(lowerCaseFilter)) return true;

          if (typeof value === "number" && value.toString().includes(globalFilter)) {
            return true;
          }

          if (row.validFrom || row.validTo) {
            const validFrom = new Date(row.validFrom).toLocaleDateString("en-IN");
            const validTo = new Date(row.validTo).toLocaleDateString("en-IN");

            return validFrom.includes(globalFilter) || validTo.includes(globalFilter);
          }

          return false;
        });
      });
    }

    // Apply Sorting (Descending Order of sslId)
    return data.sort((a, b) => b.sslId - a.sslId);
  }, [globalFilter, sslDetails]);



  const validateManagerName = (siteManager) => {
    return /^[a-zA-Z\s]*$/.test(siteManager);
  }

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };
  const formatUrlToHttps = (value) => {
    try {
      let parsedUrl = new URL(value);
      parsedUrl.protocol = "https:";
      return parsedUrl.origin;
    } catch (_) {
      return null;
    }
  };

  const saveManagerDetails = async (editSSL) => {
    if (!editSSL?.siteManager || !editSSL?.email) {
      return toast.error("Please fill in all fields", { autoClose: 2000 });

    }
    if (!validateManagerName(editSSL.siteManager)) {
      return toast.error("Name contains only alphabets", { autoClose: 2000 });
    }
    if (!validateEmail(editSSL.email)) {
      return toast.error("Enter a valid email address", { autoClose: 2000 });
    }

    setLoading(true);
    let formattedUrl = formatUrlToHttps(editSSL.url); // Ensure it's the URL, not siteManager
    if (!formattedUrl) {
      setLoading(false);
      return toast.error("Invalid URL format", { autoClose: 2000 });
    }

    try {
      const response = await fetch(`${baseUrl}/mail-to-sitemanager`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formattedUrl, siteManager: editSSL.siteManager, email: editSSL.email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save manager details");

      toast.success(data.message, { autoClose: 2000 });
    } catch (error) {
      toast.error(error.message, { autoClose: 2000 });
    }
    setLoading(false);
  };


  const [minute, setMinute] = useState("");
  const [hour, setHour] = useState("");
  if (minute === "*") {
    setMinute("00");
  }
  if (hour === "*") {
    setHour("00");
  }


  const fetchCronSchedule = async () => {

    try {
      const response = await axios.get(`${baseUrl}/cron-schedule`, { withCredentials: true });
      const cronParts = response.data.cronSchedule.split(" ");
      setMinute(cronParts[0] || "*");
      setHour(cronParts[1] || "*");
    } catch (error) {
      toast.error("Your session has Expired Please Login Again", { autoClose: 2000 });
      console.error(error);
    }
    setLoading(false);
  };


  useEffect(() => {
    fetchCronSchedule();

  }, []);



  const columns = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "S.No",
        size: 50,
        enableEditing: false,
        enableSorting: false,
        enableColumnFilter: false,

        Edit: () => null,
        Cell: ({ row }) => row.index + 1,

        muiTableBodyCellProps: {
          sx: {
            textAlign: "center",


          },
        },
      },
      {
        accessorKey: "url",
        header: "URL",
        size: 200,
        enableClickToCopy: true,
        enableEditing: false, // read-only

      },
      {
        accessorKey: "issuedTo.commonName",
        header: "Issued To CN",
        enableEditing: false,
        Edit: () => null,
      },
      {
        accessorKey: "issuedTo.organization",
        header: "Issued To Org",
        enableEditing: false,
        Edit: () => null,
      },
      {
        accessorKey: "issuedBy.commonName",
        header: "Issued By CN",
        enableEditing: false,
        Edit: () => null,
      },
      {
        accessorKey: "issuedBy.organization",
        header: "Issued By Org",
        enableEditing: false,
        Edit: () => null,
      },
      {
        accessorKey: "validFrom",
        header: "Valid From",
        enableEditing: false,
        enableSorting: false,
        accessorFn: (row) => {
          const validFrom = row?.validFrom;
          if (!validFrom) return "N/A";

          // Convert UTC to IST manually
          const utcDate = new Date(validFrom);
          const istDate = new Date(utcDate.getTime() + (0 * 60 * 60 * 1000)); // Add 5:30 hours

          // Format IST date
          return istDate.toLocaleString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
          });
        }
      },

      {
        accessorKey: "validTo",
        header: "Valid To",
        enableEditing: false,
        enableSorting: false,
        accessorFn: (row) => {
          const validTo = row?.validTo;
          if (!validTo) return "N/A";
          const gmtDate = new Date(validTo);
          const istDate = new Date(gmtDate.getTime() + 0 * 60 * 60 * 1000);
          return istDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        },
      },



      {
        accessorKey: "daysRemaining",
        header: "Validity", // Shortened header
        enableEditing: false,
        Cell: ({ cell }) => {
          const diffDays = cell.getValue(); // Get daysRemaining value

          if (diffDays <= 0) {
            return <strong style={{ color: "red" }}>Expired</strong>;
          }

          // Function to determine the background color
          const getColorStyle = (days) => {
            if (days > 160) return { backgroundColor: "#008000", color: "white" }; // Green
            if (days > 120) return { backgroundColor: "#90EE90", color: "black" }; // Light Green
            if (days > 80) return { backgroundColor: "orange", color: "black" }; // Orange
            if (days > 40) return { backgroundColor: "red", color: "white" }; // Red
            if (days === "Expired") {
              return { backgroundColor: "white", color: "darkred" };
            }
            return { backgroundColor: "darkred", color: "white" }; // Dark Red
          };

          return (
            <span
              style={{
                ...getColorStyle(diffDays),
                padding: "4px 20px",
                borderRadius: "20px",
                fontWeight: "bold",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {diffDays === "Expired" ? "Expired" : `${diffDays} days`}

            </span>
          );
        },
        muiTableBodyCellProps: {
          sx: {
            textAlign: "center",
          },
        },
      },

      {
        accessorKey: "image_url",
        header: "Image",
        enableEditing: false,
        size: 100,
        Cell: ({ cell }) => {
          const imageUrl = cell.getValue();
          if (!imageUrl) {
            return <i style={{ color: "red" }}>⚠️upload Image</i>;
          }

          return (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <img
                src={`${baseUrl}${imageUrl}?t=${Date.now()}`} // Force browser to get the latest image
                alt="Site_image"
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "30px",
                  objectFit: "cover",
                }}
              />

            </div>
          );
        },
      }

      ,

      {
        accessorKey: "siteManager",
        header: "Site Manager",

        Cell: ({ cell }) => {
          const name = cell.getValue();
          return name.trim() !== "" ? name : <i style={{ color: "red" }}>⚠️ name is required</i>;
        }
      },
      {
        accessorKey: "email",
        header: "Email",
        enableEditing: true,
        Cell: ({ cell }) => {
          const email = cell.getValue();
          return email.trim() !== "" ? email : <i style={{ color: "red" }}>⚠️ email is required</i>;
        }


      },

      {
        id: "actions",
        header: "Actions",
        Edit: () => null,

        size: 100,
        enableEditing: false,
        Cell: ({ row, table }) => (
          <Box sx={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <Tooltip title="View">
              <IconButton >
                <FaEye className="text-sky-500" onClick={() => {
                  setSelectedSSL(row.original);
                  setShowDetailsModal(true);
                }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton onClick={() => openEditModal(row.original)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                color="error"
                onClick={() => openDeleteModal(row.original.sslId)}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
    ],
    []
  );

  const [showEditModal, setShowEditModal] = useState(false);
  const [editSSL, setEditSSL] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [selectedSSL, setSelectedSSL] = useState(null);

  const openEditModal = (sslData) => {
    setEditSSL(sslData);
    setShowEditModal(true);
  };
  const updateSSL = async () => {
    try {
      const { url, siteManager, email } = editSSL;
      if (!siteManager) {
        toast.error("Please fill the SiteManager Name");
        return;
      }
      else if (!/^[a-zA-Z\s]*$/.test(siteManager)) {
        toast.error("name contains only alphabets");
        return;
      }
      else if (!email) {
        toast.error("Please fill the Email");
        return;
      }
      else if (!/\S+@\S+\.\S+/.test(email)) {
        toast.error("Please enter valid Email");
        return
      }
      await axios.put(
        `${baseUrl}/ssl-update`,
        { url, siteManager, email },
        { withCredentials: true }
      );

      toast.success("Updated successfully!", { autoClose: 2000 });
      setShowEditModal(false);
      // Refresh table data
      queryClient.invalidateQueries(["sslDetails"]);
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 2000);

      // Refresh table data
      queryClient.invalidateQueries(["sslDetails"]);
    } catch (error) {
      setLoading(false);
      console.error("Update failed:", error.response?.data || error);
      toast.error(error.response?.data?.message || "Failed to update SSL details");
    }

  };
  //for image

  const uploadSSLImage = async () => {
    const { file } = editSSL;
  
    if (!editSSL.url) {
      toast.error("URL is missing. Please provide a valid URL before uploading.");
      return;
    }
  
    const formData = new FormData();
    formData.append("url", editSSL.url);
    formData.append("file", file);
  
    try {
      const response = await axios.put(`${baseUrl}/ssl-update`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
  
      console.log("Upload Success:", response.data);
      toast.success("Image updated successfully!", { autoClose: 2000 });
  
      // Ensure backend sends updated image URL
      // if (response.data.image_url) {
      //   // Update state with new image URL
      //   setEditSSL((prev) => ({
      //     ...prev,
      //     image_url: response.data.image_url,
      //   }));
  
      //   // Manually update query cache to reflect changes in the table
      //   queryClient.setQueryData(["sslDetails"], (oldData) => {
      //     if (!oldData) return oldData; // Handle case when oldData is undefined
      //     return oldData.map((item) =>
      //       item.url === editSSL.url ? { ...item, image_url: response.data.image_url } : item
      //     );
      //   });
  
      //   // Invalidate query to refetch updated data
      //   queryClient.invalidateQueries(["sslDetails"]);
      // }
    } catch (error) {
      console.error("Image upload failed:", error.response?.data || error);
      toast.error(error.response?.data?.message || "Failed to upload image.");
    }
  };
  
  

  // Delete is still handled via a custom hook
  const deleteSSL = useDeleteSSL(setLoading);

  // State for modal confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Opens the modal and sets the selected SSL id
  const openDeleteModal = (sslId) => {
    setSelectedSSL(sslId);
    setShowDeleteModal(true);
  };

  // Calls delete mutation then resets modal state
  const confirmDeleteSSL = async () => {
    if (selectedSSL) {
      await deleteSSL(selectedSSL);
      setShowDeleteModal(false);
      setSelectedSSL(null);
    }
  };

  return (
    <>
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
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
        className="bg-cover  bg-center min-h-screen"
        style={{ backgroundImage: "url('./landingpage2.png')" }}
      >
        <Box sx={{ p: 2 }}>
          <h1 className="font-bold text-2xl text-center mb-1">
            SSL Certificate Details Monitoring
          </h1>
          {/* Total no of counts */}
          <div className="flex justify-between items-center mb-4">
            <Typography variant="h6" fontWeight="bold">
              Total SSL Certificates:  <span className="bg-sky-400 text-white font-bold rounded-full px-4 py-2 text-sm shadow-md min-w-[40px] text-center">
                {/* {sslDetails.length} */}
              </span>
            </Typography>

          </div>
          {/* /* 🔍 Search Bar for Global Filtering */}
          <Box sx={{ mb: 2 }} className="absolute right-40 z-10 mr-10 mt-2">
            <TextField
              variant="outlined"
              placeholder="Search..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              sx={{
                width: "100%",
                "& .MuiOutlinedInput-root": {
                  height: "40px",
                },

              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <MaterialReactTable className="h-1/2"
            columns={columns}
            data={processedData}
            enableGlobalFilter={false}
            getRowId={(row) => row.sslId}

            muiTableBodyRowProps={({ row }) => ({

              sx: {
                cursor: "pointer",
                backgroundColor: row.index % 2 ? "" : "#ffffff",
                "&:hover": {
                  backgroundColor: "oklch(0.951 0.046 236.824)",

                },
              },

            })}
            initialState={{
              columnVisibility: {
                "issuedTo.commonName": false,
                "issuedTo.organization": false,
                "issuedBy.commonName": false,
                "issuedBy.organization": false,
              },
            }}
            renderRowActions={({ row }) => (

              <Box sx={{ display: "flex", gap: "1rem" }}>


                <Tooltip title="Delete">
                  <IconButton
                    color="error"
                    onClick={() => openDeleteModal(row.original.sslId)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            state={{ isLoading }}
            muiTableHeadCellProps={{
              sx: {
                backgroundColor: "oklch(0.828 0.111 230.318)",
                // backgroundImage: "url('./landingpage2.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",

                color: "black",
                fontWeight: "bold",
                fontSize: "1rem",
                border: "0.5px solid lightgray",
              },
            }}
            // Row styling: alternate row colors and hover effect

            muiTableBodyCellProps={{
              sx: {
                padding: "8px",
                // border: "0.1px solid lightgray",
              },
            }}
          />
        </Box>



        {/* // JSX for Details Modal */}
        <Modal open={showDetailsModal} onClose={() => setShowDetailsModal(false)}>
          <Box className="bg-white p-4  w-5/6"
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",

              maxWidth: 900,
              maxHeight: "90vh",
              bgcolor: "white",
              boxShadow: 24,
              p: 4,
              borderRadius: "12px",
              overflowY: "auto",
            }}
          >
            {selectedSSL && <Typography variant="h5" fontWeight="bold" gutterBottom >
              <strong>🔗 URL:</strong> {selectedSSL.url}
            </Typography>}

            {selectedSSL && (
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography sx={{ my: 2 }}>  <span className="text-xl ">SSL Certificate Details</span></Typography>

                    <Typography><strong>📆 Days Remaining:</strong> {selectedSSL.daysRemaining}</Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                {/* Email Logs Section */}
                <Typography variant="h6" fontWeight="bold">📩 Email Logs</Typography>
                {selectedSSL?.EmailSendLogs?.length > 0 ? (
                  selectedSSL.EmailSendLogs.map((log, index) => (
                    <Box key={index} sx={{ ml: 2, mt: 1, p: 2, bgcolor: "#f5f5f5", borderRadius: "8px" }}>
                      <Typography><strong>Type:</strong> {log.emailType}</Typography>
                      <Typography><strong>Recipient:</strong> {log.recipient}</Typography>
                      <Typography><strong>Subject:</strong> {log.subject}</Typography>
                      <Typography><strong>Status:</strong> {log.status}</Typography>
                      <Typography><strong>Sent At:</strong> {new Date(log.sentAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })}</Typography>
                    </Box>
                  ))
                ) : (
                  <Typography sx={{ ml: 2, color: "gray" }}>No email logs available</Typography>
                )}

                <Divider sx={{ my: 2 }} />

                {/* Email Schedule Section */}
                <Typography variant="h6" fontWeight="bold">📅 Email Schedule</Typography>
                {selectedSSL?.emailSchedule ? (
                  <Box sx={{ ml: 2, mt: 1, p: 2, bgcolor: "#e3f2fd", borderRadius: "8px" }}>
                    <Typography><strong>Next 30 Days:</strong> {new Date(selectedSSL.emailSchedule?.nextEmailDates?.thirtyDays).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, {hour}:{minute}:00 {hour >= 12 ? "PM" : "AM"}
                    </Typography>
                    <Typography><strong>Next 15 Days:</strong> {new Date(selectedSSL.emailSchedule?.nextEmailDates?.fifteenDays).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, {hour}:{minute}:00 {hour >= 12 ? "PM" : "AM"}</Typography>
                    <Typography><strong>Next 10 Days:</strong> {new Date(selectedSSL.emailSchedule?.nextEmailDates?.tenDays).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, {hour}:{minute}:00 {hour >= 12 ? "PM" : "AM"}</Typography>
                    <Typography><strong>Next 5 Days:</strong> {new Date(selectedSSL.emailSchedule?.nextEmailDates?.fiveDays).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, {hour}:{minute}:00 {hour >= 12 ? "PM" : "AM"}</Typography>
                  </Box>
                ) : (
                  <Typography sx={{ ml: 2, color: "gray" }}>No email schedule available.</Typography>
                )}

                <Divider sx={{ my: 2 }} />

                {/* Notification Status Section */}
                <Typography variant="h6" fontWeight="bold">🔔 Notification Status</Typography>
                <Box sx={{ ml: 2, mt: 1, p: 2, bgcolor: "#f3e5f5", borderRadius: "8px" }}>
                  <Typography><strong>Normal Email Sent:</strong>   {selectedSSL?.notificationStatus?.NormalSent ? "✅ " : "❌ "}</Typography>
                  <Typography>
                    <strong>30 Days Email Sent:</strong> {selectedSSL?.notificationStatus?.thirtyDaysSent ? "✅ " : "❌ "}
                    {selectedSSL?.EmailSendLogs?.find(log => log.emailType === '30days')?.sentAt && (
                      <>
                        <strong className="text-sm"> Sent At:</strong>
                        {new Date(selectedSSL.EmailSendLogs.find(log => log.emailType === '30days').sentAt).toLocaleString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric',
                          second: 'numeric',
                        })}
                      </>
                    )}
                  </Typography>




                  <Typography><strong>15 Days Email Sent:</strong> {selectedSSL?.notificationStatus?.fifteenDaysSent ? "✅ " : "❌ "} {selectedSSL?.EmailSendLogs?.find(log => log.emailType === '15days')?.sentAt && (
                    <>
                      <strong className="text-sm"> Sent At:</strong> {new Date(selectedSSL?.EmailSendLogs?.find(log => log.emailType === '15days').sentAt).toLocaleString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        second: 'numeric',
                      })}
                    </>
                  )}</Typography>
                  <Typography><strong>10 Days Email Sent:</strong> {selectedSSL?.notificationStatus?.tenDaysSent ? "✅ " : "❌ "} {selectedSSL?.EmailSendLogs?.find(log => log.emailType === '10days')?.sentAt && (
                    <>
                      <strong className="text-sm"> Sent At:</strong> {new Date(selectedSSL?.EmailSendLogs?.find(log => log.emailType === '10days').sentAt).toLocaleString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        second: 'numeric',
                      })}
                    </>
                  )}</Typography>
                  <Typography><strong>5 Days Email Sent:</strong> {selectedSSL?.notificationStatus?.fiveDaysSent ? "✅ " : "❌ "} {selectedSSL?.emailLogs?.find(log => log.emailType === '5days')?.sentAt && (
                    <>
                      <strong className="text-sm"> Sent At:</strong> {new Date(selectedSSL.emailLogs.find(log => log.emailType === '5days').sentAt).toLocaleString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        second: 'numeric',
                      })}
                    </>
                  )}</Typography>
                  <Typography><strong>📧 Daily Email Count:</strong> {selectedSSL?.notificationStatus?.dailyEmailCount || 0}</Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Optional Fields */}
                {selectedSSL?.siteManager && <Typography><strong>👤 Site Manager:</strong> {selectedSSL.siteManager}</Typography>}
                {selectedSSL?.email && <Typography><strong>📩 Email:</strong> {selectedSSL.email}</Typography>}
              </Box>
            )}

            <Button onClick={() => setShowDetailsModal(false)} variant="contained" color="primary" sx={{ mt: 3, width: "100%" }}>
              Close
            </Button>
          </Box>
        </Modal>


        {/* // JSX for Edit Modal */}

        <Modal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          aria-labelledby="edit-modal-title"
          aria-describedby="edit-modal-description"
        >
          <Box
            className="bg-white p-4"
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: { xs: "90%", sm: "70%", md: "50%" }, // Responsive width
              maxWidth: "90vw", // Prevents overflowing on large screens
              maxHeight: "90vh", // Prevents modal from going off-screen
              bgcolor: "background.paper",
              borderRadius: "15px",
              boxShadow: 24,
              p: 4,
              overflowY: "auto", // Allows scrolling inside modal if needed
            }}
          >
            <Typography id="edit-modal-title" variant="h6">
              Edit SSL Details
            </Typography>

            <TextField label="URL" fullWidth value={editSSL?.url || ""} disabled margin="normal" />
            <TextField
              label="Valid From"
              fullWidth
              value={editSSL?.validFrom
                ? new Date(editSSL.validFrom).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                : ""}
              disabled
              margin="normal"
            />
            <TextField
              label="Valid To"
              fullWidth
              value={editSSL?.validTo
                ? new Date(editSSL.validTo).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                : ""}
              disabled
              margin="normal"
            />
            <TextField
              label="Site Manager"
              fullWidth
              value={editSSL?.siteManager || ""}
              onChange={(e) => setEditSSL({ ...editSSL, siteManager: e.target.value })}
              margin="normal"
            />
            <TextField
              label="Email"
              fullWidth
              value={editSSL?.email || ""}
              onChange={(e) => setEditSSL({ ...editSSL, email: e.target.value })}
              margin="normal"
            />
            <Box
              sx={{
                mt: 3,
                p: 3,
                borderRadius: "12px",
                backgroundColor: "#f9f9f9",
                boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
                textAlign: "",
              }}
            >
              <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", color: "#333" }}>
                Upload siteManager or URL Image
              </Typography>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setSelectedFile(file);
                    setEditSSL((prev) => ({
                      ...prev,
                      file,
                      url: prev.url || "default-url", // Ensure URL is not undefined
                    }));
                  }
                }}
                style={{ display: "none" }}
                id="upload-image-input"
              />

              <label htmlFor="upload-image-input">
                <Button
                  variant="contained"
                  component="span"
                  sx={{
                    backgroundColor: "#1976d2",
                    color: "white",
                    fontWeight: "bold",
                    px: 3,
                    py: 1.5,
                    borderRadius: "8px",
                    textTransform: "none",
                    "&:hover": {
                      backgroundColor: "#1565c0",
                    },
                  }}
                >
                  🔍 Choose Image
                </Button>
              </label>

              {selectedFile && (
                <Box sx={{ mt: 1 }}>
                  {/* Selected File Name */}
                  <Typography
                    variant="body2"
                    sx={{
                      color: "gray",
                      fontStyle: "italic",
                    }}
                  >
                    Selected: {selectedFile.name}
                  </Typography>

                  {/* Image Preview */}
                  <Box
                    sx={{
                      mt: 2,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: "8px",
                      overflow: "hidden",
                      width: "250px",
                      height: "200px",
                      border: "2px solid #ddd",
                      backgroundColor: "#fff",
                    }}
                  >
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Preview"
                      className="justify-center"
                      style={{

                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </Box>

                  {/* Show Upload Button Only After Selecting an Image */}
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={uploadSSLImage}
                    sx={{
                      mt: 3,
                      backgroundColor: "#1976d2",
                      fontWeight: "bold",
                      textTransform: "none",
                      borderRadius: "8px",
                      px: 3,
                      py: 1.5,
                      "&:hover": {
                        backgroundColor: "#1565c0",
                      },
                    }}
                  >
                    📤 Upload Image
                  </Button>
                </Box>
              )}
            </Box>


            <Box
              sx={{
                mt: 3,
                display: "flex",
                flexWrap: "wrap", // Prevents button overflow
                justifyContent: { xs: "center", md: "flex-end" }, // Center on small screens, right-align on larger screens
                gap: 2,
              }}
            >
              <Button variant="contained" color="primary" onClick={updateSSL}>
                Save Changes
              </Button>

              <Button
                variant="contained"
                onClick={() => saveManagerDetails(editSSL)}
                sx={{ color: "white", backgroundColor: "green" }}
              >
                {loading && <FaSpinner className="animate-spin mr-2" />}
                📩 Send Mail
              </Button>

              <Button variant="outlined" color="error" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
            </Box>
          </Box>
        </Modal>


        <Modal
          open={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          aria-labelledby="delete-confirmation-title"
          aria-describedby="delete-confirmation-description"
        >
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 400,
              bgcolor: "background.paper",
              border: "2px solid #000",
              boxShadow: 24,
              p: 4,
            }}
          >
            <Typography
              id="delete-confirmation-title"
              variant="h6"
              component="h2"
            >
              Are you sure you want to delete?{" "}
              {sslDetails.find((ssl) => ssl.sslId === selectedSSL)?.url}
            </Typography>
            <Box
              sx={{
                mt: 2,
                display: "flex",
                justifyContent: "flex-end",
                gap: 1,
              }}
            >
              <Button
                variant="contained"
                color="error"
                onClick={confirmDeleteSSL}
              >
                Yes, Delete
              </Button>
              <Button
                variant="outlined"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        </Modal>
      </div>
    </>
  );
};

