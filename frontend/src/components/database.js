import React, { useMemo, useState } from "react";
import { MaterialReactTable } from "material-react-table";
import {
  Box,
  IconButton,
  Tooltip,
  Modal,
  Button,
  Typography,
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

const SSLTable = ({ loading, setLoading }) => {
  const { data: sslDetails = [], isLoading } = useGetSSLDetails();

  // 🔍 Global Search State
  const [globalFilter, setGlobalFilter] = useState("");

  // 📌 Custom Global Filter Function
  const filteredData = useMemo(() => {
    if (!globalFilter) return sslDetails;

    const lowerCaseFilter = globalFilter.toLowerCase();

    return sslDetails.filter((row) =>
      Object.values(row).some(
        (value) =>
          value && String(value).toLowerCase().includes(lowerCaseFilter)
      )
    );
  }, [globalFilter, sslDetails]);
  const columns = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "S.No",
        size: 50,
        enableEditing: false,
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
        accessorFn: (row) => {
          const gmtDate = new Date(row.validFrom);
          const istDate = new Date(gmtDate.getTime() + 5.5 * 60 * 60 * 1000);
          return istDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        },
      },
      {
        accessorKey: "validTo",
        header: "Valid To",
        enableEditing: false,
        accessorFn: (row) => {
          const gmtDate = new Date(row.validTo);
          const istDate = new Date(gmtDate.getTime() + 5.5 * 60 * 60 * 1000);
          return istDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        },
      },

      {
        id: "timeDuration",
        header: "Time Duration",
        enableEditing: false,
        Edit: () => null,
        accessorFn: (row) => {
          const validToDate = new Date(row.validTo);
          const now = new Date();
          const diffMs = validToDate - now;
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          // If it's already expired or expiring today
          if (diffDays <= 0) {
            return "Expired";
          }

          if (diffDays > 160) {
            return (
              <span
                style={{
                  backgroundColor: "oklch(0.792 0.209 151.711)",
                  color: "white",
                  padding: "4px 20px",
                  borderRadius: "20px",
                  fontWeight: "bold",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {`${diffDays} days`}
              </span>
            );
          } else if (diffDays > 120) {
            return (
              <span
                style={{
                  backgroundColor: "oklch(0.795 0.184 86.047)",
                  color: "black",
                  padding: "4px 20px",
                  borderRadius: "20px",
                  fontWeight: "bold",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {`${diffDays} days`}
              </span>
            );
          } else if (diffDays > 80) {
            return (
              <span
                style={{
                  backgroundColor: "orange",
                  color: "black",
                  padding: "4px 20px",
                  borderRadius: "20px",
                  fontWeight: "bold",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {`${diffDays} days`}
              </span>
            );
          } else if (diffDays > 40) {
            return (
              <span
                style={{
                  backgroundColor: "red",
                  color: "white",
                  padding: "4px 20px",
                  borderRadius: "20px",
                  fontWeight: "bold",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {`${diffDays} days`}
              </span>
            );
          } else {
            return (
              <span
                style={{
                  backgroundColor: "darkred",
                  color: "white",
                  padding: "4px 20px",
                  borderRadius: "20px",
                  fontWeight: "bold",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {`${diffDays} days`}
              </span>
            );
          }
        },
        muiTableBodyCellProps: {
          sx: {
            textAlign: "center",
          },
        },
      },
      {
        accessorKey: "siteManager",
        header: "Site Manager",

        enableEditing: true,
      },
      {
        accessorKey: "email",
        header: "Email",
        enableEditing: true,
      },

      {
        id: "actions",
        header: "Actions",
        Edit: () => null,

        size: 100,
        enableEditing: false,
        Cell: ({ row, table }) => (
          <Box sx={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
             <Tooltip title="Edit">
          <IconButton >
            <EditIcon onClick={() => openEditModal(row.original)} />
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

  const [selectedSSL, setSelectedSSL] = useState(null);

  const openEditModal = (sslData) => {
    setEditSSL(sslData);
    setShowEditModal(true);
  };
  const updateSSL = async () => {
    try {
      const { url, siteManager, email } = editSSL;
      if (!siteManager)  {
        toast.error("Please fill the SiteManager Name");
        return;
      }
      else if(!/^[a-zA-Z\s]*$/.test(siteManager)){
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
      console.error("Update failed:", error);
      toast.error("Failed to update SSL details");
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
        className="bg-cover screen-h bg-center"
        style={{ backgroundImage: "url('./landingpage2.png')" }}
      >
        <Box sx={{ p: 2, height: "100vh" }}>
          <h1 className="font-bold text-2xl text-center mb-1">
            SSL Certificate Details Monitoring
          </h1>
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

                <MaterialReactTable
                columns={columns}
                data={filteredData}
                enableGlobalFilter={false}
            // onEditingRowSave={handleSaveSSL}

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
                color: "black",
                fontWeight: "bold",
                fontSize: "1rem",
                border: "1px solid lightgray",
              },
            }}
            // Row styling: alternate row colors and hover effect
            muiTableBodyRowProps={({ row }) => ({
              sx: {
                backgroundColor:
                  row.index % 2 ? "oklch(0.951 0.026 236.824)" : "#ffffff",
                "&:hover": {
                  backgroundColor: "lightyellow",
                },
              },
            })}
            muiTableBodyCellProps={{
              sx: {
                padding: "8px",
                border: "1px solid lightgray",
              },
            }}
          />
        </Box>
        {/* // JSX for Edit Modal */}
       
        <Modal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          aria-labelledby="edit-modal-title"
          aria-describedby="edit-modal-description"
        >
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 400,
              bgcolor: "background.paper",
              borderRadius: "15px",
              boxShadow: 24,
              p: 4,
            }}
          >
            <Typography id="edit-modal-title" variant="h6">
              Edit SSL Details
            </Typography>
            <TextField
              label="URL"
              fullWidth
              value={editSSL?.url || ""}
              disabled
              margin="normal"
            />
            <TextField
              label="Valid From"
              fullWidth
              value={editSSL?.validFrom || ""}
              disabled
              margin="normal"
            />
            <TextField
              label="Valid To"
              fullWidth
              value={editSSL?.validTo || ""}
              disabled
              margin="normal"
            />
            <TextField
              label="Site Manager"
              fullWidth
              value={editSSL?.siteManager || ""}
              onChange={(e) =>
                setEditSSL({ ...editSSL, siteManager: e.target.value })
              }
              margin="normal"
            />
            <TextField
              label="Email"
              fullWidth
              value={editSSL?.email || ""}
              onChange={(e) =>
                setEditSSL({ ...editSSL, email: e.target.value })
              }
              margin="normal"
            />
            <Box
              sx={{
                mt: 2,
                display: "flex",
                justifyContent: "flex-end",
                gap: 1,
              }}
            >
              <Button variant="contained" color="primary" onClick={updateSSL}>
                Save Changes
              </Button>
              <Button
                variant="outlined"
                onClick={() => setShowEditModal(false)}
              >
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
    if (!sslId) throw new Error("SSL ID is required");
    try {
      await axios.delete(`${baseUrl}/ssl-delete`, {
        data: { sslId },
        withCredentials: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["sslDetails"] });
      toast.success("Deleted successfully!", { autoClose: 2000 });
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    } catch (error) {
      setLoading(false);
      console.error("Failed to delete SSL:", error.message);
      toast.error(`Failed to delete SSL: ${error.message}`);
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
