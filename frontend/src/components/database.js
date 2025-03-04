import React, { useMemo } from 'react';
import { MaterialReactTable } from 'material-react-table';
import {
  Box,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import API_BASE_URL from '../URL';

const SSLTable = () => {
  const columns = useMemo(
    () => [
      { accessorKey: '_id', header: 'ID', enableEditing: false, size: 80 },
      { accessorKey: 'url', header: 'URL', size: 200 },
      { accessorKey: 'issuedTo.commonName', header: 'Issued To (CN)' },
      { accessorKey: 'issuedTo.organization', header: 'Issued To (Org)' },
      { accessorKey: 'issuedBy.commonName', header: 'Issued By (CN)' },
      { accessorKey: 'issuedBy.organization', header: 'Issued By (Org)' },
      { accessorKey: 'validFrom', header: 'Valid From' },
      { accessorKey: 'validTo', header: 'Valid To' },
      { accessorKey: 'siteManager', header: 'Site Manager' },
      { accessorKey: 'email', header: 'Email' },
    ],
    []
  );

  const { data: sslDetails = [], isLoading } = useGetSSLDetails();
  const { mutateAsync: createSSL } = useCreateSSL();
  const { mutateAsync: updateSSL } = useUpdateSSL();
  const { mutateAsync: deleteSSL } = useDeleteSSL();

  const handleCreateSSL = async ({ values, table }) => {
    await createSSL(values);
    table.setCreatingRow(null);
  };

  const handleSaveSSL = async ({ values, table }) => {
    await updateSSL(values);
    table.setEditingRow(null);
  };

  return (
    <MaterialReactTable
      columns={columns}
      data={sslDetails}
      enableEditing
      onCreatingRowSave={handleCreateSSL}
      onEditingRowSave={handleSaveSSL}
      renderRowActions={({ row, table }) => (
        <Box sx={{ display: 'flex', gap: '1rem' }}>
          <Tooltip title="Edit">
            <IconButton onClick={() => table.setEditingRow(row)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton color="error" onClick={() => deleteSSL(row.original._id)}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      state={{ isLoading }}
    />
  );
};

const useGetSSLDetails = () =>
    useQuery({
      queryKey: ['sslDetails'],
      queryFn: async () => {
        const { data } = await axios.get(`${API_BASE_URL}/all-ssl`);
        return data.data;
      },
    });
  
  const useCreateSSL = () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (ssl) => axios.post(`${API_BASE_URL}/ssl`, ssl),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['sslDetails'] });
      },
    });
  };
  
  const useUpdateSSL = () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (ssl) => axios.put(`${API_BASE_URL}/ssl/${ssl._id}`, ssl),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['sslDetails'] });
      },
    });
  };
  
  const useDeleteSSL = () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id) => axios.delete(`${API_BASE_URL}/ssl/${id}`),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['sslDetails'] });
      },
    });
  };
  

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SSLTable />
    </QueryClientProvider>
  );
}
