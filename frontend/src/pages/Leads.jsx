import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useMe } from '../hooks/useMe';
import { useToast } from '../components/Toast.jsx';
import { Input, Button, Select, Tag, Table, Modal, Form } from 'antd';

export default function Leads() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [createErrors, setCreateErrors] = useState({ name: '', email: '', phone: '' });
  const [assignMap, setAssignMap] = useState({});
  const [assigningId, setAssigningId] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const toast = useToast();
  const [assignConfirm, setAssignConfirm] = useState(null); // { id, assignedTo, leadName, assigneeName }
  const [editLead, setEditLead] = useState(null); // { id, name, email, phone }
  const [editError, setEditError] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState({ name: '', email: '', phone: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [showError, setShowError] = useState(false);
  const meQuery = useMe();
  const role = meQuery.data?.user?.role || null;

  const leadsQuery = useQuery({
    queryKey: ['leads', page, limit],
    queryFn: async () => (await api.get(`/leads?page=${page}&limit=${limit}`)).data,
    staleTime: 30_000,
    keepPreviousData: true,
  });
  const leads = leadsQuery.data?.items || [];
  const total = leadsQuery.data?.total || 0;

  function validateEmail(v) {
    if (!v) return 'Email is required';
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    return ok ? '' : 'Enter a valid email';
  }
  function validateName(v) {
    if (!v || !v.trim()) return 'Name is required';
    return '';
  }
  function validatePhone(v) {
    if (!v) return 'Phone is required';
    const digits = String(v).replace(/\D/g, '');
    if (digits.length < 7) return 'Phone must have at least 7 digits';
    if (digits.length > 15) return 'Phone must be at most 15 digits';
    return '';
  }

  function hasErrors(obj) {
    return Object.values(obj).some(Boolean);
  }

  const updateLead = useMutation({
    mutationFn: async ({ id, name, email, phone }) => (await api.put(`/leads/${id}`, { name, email, phone })).data,
    onSuccess: () => {
      toast.success({ title: 'Updated', message: 'Lead updated successfully' });
      setEditLead(null);
      setEditError('');
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || 'Failed to update lead';
      setEditError(msg);
    },
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/auth/users')).data,
    staleTime: 60_000,
  });

  const createLead = useMutation({
    mutationFn: async () => (await api.post('/leads/create', { name, email, phone })).data,
    onSuccess: () => {
      setName(''); setEmail(''); setPhone('');
      toast.success({ title: 'Created', message: 'Lead created successfully' });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || 'Failed to create lead';
      toast.error({ title: 'Error', message: msg });
    }
  });

  const assignLead = useMutation({
    mutationFn: async ({ id, assignedTo }) => (await api.post(`/leads/${id}/assign`, { assignedTo })).data,
    onMutate: ({ id }) => setAssigningId(id),
    onSuccess: (_data, variables) => {
      setAssignMap(prev => ({ ...prev, [variables.id]: variables.assignedTo }));
      toast.success({ title: 'Assigned', message: 'Lead assigned successfully' });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || 'Failed to assign lead';
      toast.error({ title: 'Error', message: msg });
    },
    onSettled: () => setAssigningId(null),
  });

  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => { setShowError(false); setErrorMsg(''); }, 2500);
    return () => clearTimeout(t);
  }, [errorMsg]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded border">
        <h2 className="font-semibold mb-3">Create Lead</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Input
              status={createErrors.name ? 'error' : ''}
              placeholder="Name"
              value={name}
              onChange={(e)=>{ setName(e.target.value); if (createErrors.name) setCreateErrors(s=>({ ...s, name: validateName(e.target.value) })); }}
              onBlur={()=> setCreateErrors(s=>({ ...s, name: validateName(name) }))}
            />
            {createErrors.name && <div className="text-xs text-red-600 mt-1">{createErrors.name}</div>}
          </div>
          <div>
            <Input
              status={createErrors.email ? 'error' : ''}
              placeholder="Email"
              value={email}
              onChange={(e)=>{ setEmail(e.target.value); if (createErrors.email) setCreateErrors(s=>({ ...s, email: validateEmail(e.target.value) })); }}
              onBlur={()=> setCreateErrors(s=>({ ...s, email: validateEmail(email) }))}
            />
            {createErrors.email && <div className="text-xs text-red-600 mt-1">{createErrors.email}</div>}
          </div>
          <div>
            <Input
              status={createErrors.phone ? 'error' : ''}
              placeholder="Phone"
              value={phone}
              onChange={(e)=>{ setPhone(e.target.value); if (createErrors.phone) setCreateErrors(s=>({ ...s, phone: validatePhone(e.target.value) })); }}
              onBlur={()=> setCreateErrors(s=>({ ...s, phone: validatePhone(phone) }))}
            />
            {createErrors.phone && <div className="text-xs text-red-600 mt-1">{createErrors.phone}</div>}
          </div>
        </div>
        <Button
          type="primary"
          className="mt-3"
          onClick={()=>{
            const errs = {
              name: validateName(name),
              email: validateEmail(email),
              phone: validatePhone(phone),
            };
            setCreateErrors(errs);
            if (!hasErrors(errs)) createLead.mutate();
          }}
          disabled={createLead.isPending || hasErrors(createErrors)}
        >
          {createLead.isPending? 'Saving...' : 'Save Lead'}
        </Button>
      </div>

      <div className="bg-white p-4 rounded border">
        <h2 className="font-semibold mb-3">Leads</h2>
        <Table
          rowKey={(r)=>r._id}
          dataSource={leads}
          loading={leadsQuery.isLoading}
          pagination={{
            current: leadsQuery.data?.page || page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10','20','50'],
            onChange: (p, ps) => {
              setPage(p);
              if (ps !== limit) { setLimit(ps); }
            },
          }}
          columns={[
            {
              title: 'Name',
              dataIndex: 'name',
              key: 'name',
              render: (text, l) => (
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {l.name}
                    <Tag>{l.status}</Tag>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{l.email} • {l.phone}</div>
                </div>
              )
            },
            {
              title: 'Owner',
              key: 'owner',
              render: (_, l) => (
                <div className="text-xs text-gray-700">
                  <span className="font-medium">{l.ownerName || 'Unknown'}</span>
                  <span className="text-gray-400"> ({l.ownerId})</span>
                </div>
              )
            },
            {
              title: 'Assigned To',
              key: 'assignedTo',
              render: (_, l) => (
                role === 'sales' ? (
                  <span className="text-gray-600 text-sm">{(usersQuery.data?.items?.find(x => x._id === l.assignedTo)?.name) || l.assignedTo || '-'}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select
                      className="min-w-[220px]"
                      placeholder="Assign to..."
                      value={(assignMap[l._id] ?? (l.assignedTo || '')) || undefined}
                      onChange={(value)=>setAssignMap(prev => ({ ...prev, [l._id]: value }))}
                      options={(usersQuery.data?.items || []).map(u => ({ label: `${u.name || u.email} (${u.role})`, value: u._id }))}
                      allowClear
                      showSearch
                      optionFilterProp="label"
                    />
                    <Button
                      type="default"
                      size="small"
                      disabled={!assignMap[l._id] || (assigningId === l._id && assignLead.isPending)}
                      onClick={()=>{
                        const assignee = usersQuery.data?.items?.find(x => x._id === assignMap[l._id]);
                        setAssignConfirm({ id: l._id, assignedTo: assignMap[l._id], leadName: l.name, assigneeName: assignee?.name || assignee?.email || 'User' });
                      }}
                    >
                      {(assigningId === l._id && assignLead.isPending)? 'Assigning...' : 'Assign'}
                    </Button>
                  </div>
                )
              )
            },
            {
              title: 'Actions',
              key: 'actions',
              render: (_, l) => (
                <Button size="small" onClick={() => { setEditError(''); setEditLead({ id: l._id, name: l.name || '', email: l.email || '', phone: l.phone || '' }); }}>Edit</Button>
              )
            }
          ]}
        />
      </div>


      {/* Edit Lead Modal */}
      <Modal
        open={!!editLead}
        title="Edit lead"
        onCancel={() => { setEditLead(null); setEditError(''); }}
        onOk={() => {
          if (!editLead) return;
          const errs = {
            name: validateName(editLead.name),
            email: validateEmail(editLead.email),
            phone: validatePhone(editLead.phone),
          };
          setEditFieldErrors(errs);
          if (!hasErrors(errs)) {
            updateLead.mutate({ id: editLead.id, name: editLead.name, email: editLead.email, phone: editLead.phone });
          }
        }}
        confirmLoading={updateLead.isPending}
        okText="Save"
      >
        {editLead ? (
          <div className="space-y-3">
            {editError ? (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{editError}</div>
            ) : null}
            <Input
              status={editFieldErrors.name ? 'error' : ''}
              placeholder="Name"
              value={editLead.name}
              onChange={(e)=>{ const val = e.target.value; setEditLead(v => ({ ...v, name: val })); if (editFieldErrors.name) setEditFieldErrors(s=>({ ...s, name: validateName(val) })); }}
              onBlur={()=> setEditFieldErrors(s=>({ ...s, name: validateName(editLead.name) }))}
            />
            {editFieldErrors.name && <div className="text-xs text-red-600 mt-1">{editFieldErrors.name}</div>}
            <Input
              status={editFieldErrors.email ? 'error' : ''}
              placeholder="Email"
              value={editLead.email}
              onChange={(e)=>{ const val = e.target.value; setEditLead(v => ({ ...v, email: val })); if (editFieldErrors.email) setEditFieldErrors(s=>({ ...s, email: validateEmail(val) })); }}
              onBlur={()=> setEditFieldErrors(s=>({ ...s, email: validateEmail(editLead.email) }))}
            />
            {editFieldErrors.email && <div className="text-xs text-red-600 mt-1">{editFieldErrors.email}</div>}
            <Input
              status={editFieldErrors.phone ? 'error' : ''}
              placeholder="Phone"
              value={editLead.phone}
              onChange={(e)=>{ const val = e.target.value; setEditLead(v => ({ ...v, phone: val })); if (editFieldErrors.phone) setEditFieldErrors(s=>({ ...s, phone: validatePhone(val) })); }}
              onBlur={()=> setEditFieldErrors(s=>({ ...s, phone: validatePhone(editLead.phone) }))}
            />
            {editFieldErrors.phone && <div className="text-xs text-red-600 mt-1">{editFieldErrors.phone}</div>}
          </div>
        ) : null}
      </Modal>

      {/* Assign Confirmation Modal */}
      <Modal
        open={!!assignConfirm}
        title="Confirm assignment"
        onCancel={() => setAssignConfirm(null)}
        onOk={() => {
          if (assignConfirm) {
            assignLead.mutate({ id: assignConfirm.id, assignedTo: assignConfirm.assignedTo });
            setAssignConfirm(null);
          }
        }}
        okText="Confirm"
        confirmLoading={assignLead.isPending}
      >
        {assignConfirm ? (
          <div className="text-sm text-gray-700">
            Assign <span className="font-medium">{assignConfirm.leadName || 'Lead'}</span> to <span className="font-medium">{assignConfirm.assigneeName}</span>?
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
