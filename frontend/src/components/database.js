import React, { useMemo, useState } from 'react';
import { MaterialReactTable } from 'material-react-table';
import { Box, IconButton, Tooltip, Modal, Button, Typography } from '@mui/material';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import baseUrl from '../URL';

const SSLTable = () => {
  const queryClient = useQueryClient();
  const columns = useMemo(
    () => [
      {
        accessorKey: 'url',
        header: 'URL',
        size: 200,
        enableEditing: false, // read-only
      },
      {
        accessorKey: 'issuedTo.commonName',
        header: 'Issued To CN',
        enableEditing: false, 
      },
      {
        accessorKey: 'issuedTo.organization',
        header: 'Issued To Org',
        enableEditing: false, 
      },
      {
        accessorKey: 'issuedBy.commonName',
        header: 'Issued By CN',
        enableEditing: false, 
      },
      {
        accessorKey: 'issuedBy.organization',
        header: 'Issued By Org',
        enableEditing: false, 
      },
      {
        accessorKey: 'validFrom',
        header: 'Valid From',
        enableEditing: false,
      },
      {
        accessorKey: 'validTo',
        header: 'Valid To',
        enableEditing: false, 
      },
      {
        id: 'timeDuration',
        header: 'Time Duration',
        enableEditing: false,
        accessorFn: (row) => {
          const validToDate = new Date(row.validTo);
          const now = new Date();
          const diffMs = validToDate - now; 
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          
          // If it's already expired or expiring today
          if (diffDays <= 0) {
            return 'Expired';
          }
          return `${diffDays} days`;
        },
      },
      {
        accessorKey: 'siteManager',
        header: 'Site Manager',
     
        enableEditing: true,
      },
      {
        accessorKey: 'email',
        header: 'Email',
        enableEditing: true,
      
      }
      
      
    ],
    []
  );
  

  const { data: sslDetails = [], isLoading } = useGetSSLDetails();

 
  const handleSaveSSL = async ({ values, table }) => {
    try {
      if (values.siteManager === "") {
        toast.error('Please enter the Site Manager Name');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!values.email || !emailRegex.test(values.email)) {
        toast.error('Please enter a valid email address');
        return;
      }
      
      await axios.put(`${baseUrl}/ssl-update`, values, { withCredentials: true });
      toast.success("Updated successfully!");
      await queryClient.invalidateQueries({ queryKey: ['sslDetails'] });
      table.setEditingRow(null);
    } catch (error) {
      console.error("Failed to update SSL:", error.message);
      toast.error(`Failed to update SSL: ${error.message}`);
    }
  };
  
  

  // Delete is still handled via a custom hook
  const deleteSSL = useDeleteSSL();

  // State for modal confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSSL, setSelectedSSL] = useState(null);

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
    <div className="bg-cover screen-h bg-center" style={{ backgroundImage: "url('./landingpage2.png')" }}>
      <Box sx={{ p: 2,height: '100vh', overflow: 'auto' }}>
        <MaterialReactTable
          columns={columns}
          data={sslDetails}
          enableEditing
          initialState={{
            columnVisibility: {
              'issuedTo.commonName': false,
              'issuedTo.organization': false,
              'issuedBy.commonName': false,
              'issuedBy.organization': false,
            },
          }}
          onEditingRowSave={handleSaveSSL}
          renderRowActions={({ row, table }) => (
            <Box sx={{ display: 'flex', gap: '1rem' }}>
              <Tooltip title="Edit">
                <IconButton onClick={() => table.setEditingRow(row)}>
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton color="error" onClick={() => openDeleteModal(row.original.sslId)}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          state={{ isLoading }}
          muiTableHeadCellProps={{
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.9)', 
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1rem',
              borderBottom: '2px solid #0d47a',
            },
          }}
          // Row styling: alternate row colors and hover effect
          muiTableBodyRowProps={({ row }) => ({
            sx: {
              backgroundColor: row.index % 2 ? '#f0f0f0' : '#ffffff', 
              '&:hover': {
                backgroundColor: 'lightyellow', 
              },
            },
          })}
      
          muiTableBodyCellProps={{
            sx: {
              padding: '8px',
              border: '1px solid lightgray',
            },
          }}
        />
      </Box>
      
      {/* Alert Modal for Delete Confirmation */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        aria-labelledby="delete-confirmation-title"
        aria-describedby="delete-confirmation-description"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            bgcolor: 'background.paper',
            border: '2px solid #000',
            boxShadow: 24,
            p: 4,
          }}
        >
          <Typography id="delete-confirmation-title" variant="h6" component="h2">
            Are you sure you want to delete?
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="contained" color="error" onClick={confirmDeleteSSL}>
              Yes, Delete
            </Button>
            <Button variant="outlined" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
          </Box>
        </Box>
      </Modal>
    </div>
  );
};

// Fetch SSL Details remains unchanged using react-query
const useGetSSLDetails = () =>
  useQuery({
    queryKey: ['sslDetails'],
    queryFn: async () => {
      const { data } = await axios.get(`${baseUrl}/all-ssl`, { withCredentials: true });
      return data.data;
    },
  });

// Delete SSL Entry with Toast Notification using a custom hook
const useDeleteSSL = () => {
  const queryClient = useQueryClient();
  return async (sslId) => {
    if (!sslId) throw new Error("SSL ID is required");
    try {
      await axios.delete(`${baseUrl}/ssl-delete`, {
        data: { sslId },
        withCredentials: true,
      });
      await queryClient.invalidateQueries({ queryKey: ['sslDetails'] });
      toast.success("Deleted successfully!");
    } catch (error) {
      console.error("Failed to delete SSL:", error.message);
      toast.error(`Failed to delete SSL: ${error.message}`);
    }
  };
};

// Query Client Provider
const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SSLTable />
      <ToastContainer position="top-right" autoClose={3000} />
    </QueryClientProvider>
  );
}
