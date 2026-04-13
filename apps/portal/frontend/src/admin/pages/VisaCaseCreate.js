import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Loader2, Save, UserPlus, Info, Copy, CheckCircle2, ExternalLink, ChevronsUpDown, Check, User } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const VisaCaseCreate = () => {
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const isMountedRef = React.useRef(true);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [createNewUser, setCreateNewUser] = useState(false);
  const [showMagicLinkModal, setShowMagicLinkModal] = useState(false);
  const [magicLinkData, setMagicLinkData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [masterCaseStats, setMasterCaseStats] = useState({
    stages: 11,
    deliverables: 23,
    documents: 13,
    totalAmount: 15800
  });
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handler seguro para cerrar el modal
  const handleCloseModal = (open) => {
    if (!open && isMountedRef.current) {
      setShowMagicLinkModal(false);
      setTimeout(() => {
        if (isMountedRef.current) {
          setCopied(false);
        }
      }, 200);
    }
  };

  const [formData, setFormData] = useState({
    userId: '',
    templateId: 'eb2-niw',
    visaType: 'EB-2 NIW',
    coordinatorId: '',
    salesRepId: '',
    notes: ''
  });

  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    phone: '',
    cvFile: null
  });
  
  const [coordinatorPopoverOpen, setCoordinatorPopoverOpen] = useState(false);
  const [salesRepPopoverOpen, setSalesRepPopoverOpen] = useState(false);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      
      // Fetch users - cargar todos (sin límite de 50)
      const usersRes = await axios.get(`${BACKEND_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 1000 }  // Cargar hasta 1000 usuarios
      });
      setUsers(usersRes.data.users || []);

      // Fetch staff (coordinators)
      const staffRes = await axios.get(`${BACKEND_URL}/api/admin/staff?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let staffList = staffRes.data.staff || [];
      
      // Pre-select current user as coordinator if they are a coordinator/advisor
      if (admin && (admin.role === 'coordinator' || admin.role === 'advisor')) {
        const adminId = admin._id || admin.id;
        
        // Check if current user is in the staff list
        let currentStaff = staffList.find(s => 
          s._id === adminId || s.id === adminId || s.email === admin.email
        );
        
        // If not in list (due to permissions), add them manually
        if (!currentStaff) {
          currentStaff = {
            _id: adminId,
            id: adminId,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            department: admin.department
          };
          staffList = [currentStaff, ...staffList];
        }
        
        // Pre-select current user
        setFormData(prev => ({
          ...prev,
          coordinator: currentStaff._id || currentStaff.id
        }));
      }
      
      setStaff(staffList);

      // Fetch master case stats
      try {
        const statsRes = await axios.get(`${BACKEND_URL}/api/admin/system/export-master-case`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (statsRes.data && statsRes.data.counts) {
          const counts = statsRes.data.counts;
          const masterCase = statsRes.data.data?.master_case;
          
          setMasterCaseStats({
            stages: counts.stages || 11,
            deliverables: counts.deliverables || 23,
            documents: counts.client_documents || 13,
            totalAmount: 15800 // Por ahora fijo, se puede calcular sumando stages
          });
        }
      } catch (statsError) {
        console.warn('Could not fetch master case stats, using defaults');
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoadingData(false);
    }
  };

  // Búsqueda dinámica de usuarios en el backend
  const searchUsersInBackend = async (query) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    try {
      setSearchingUsers(true);
      const token = localStorage.getItem('admin_token');
      const response = await axios.get(`${BACKEND_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          search: query,
          limit: 50 
        }
      });
      setSearchResults(response.data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Debounce para la búsqueda
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (userSearchQuery.length >= 3) {
        searchUsersInBackend(userSearchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [userSearchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      
      // Si se está creando un nuevo usuario
      if (createNewUser) {
        // Validar datos del nuevo usuario
        if (!newUserData.name) {
          toast.error('El nombre del usuario es requerido');
          setLoading(false);
          return;
        }
        if (!newUserData.phone) {
          toast.error('El teléfono es obligatorio');
          setLoading(false);
          return;
        }
        // Validar formato del teléfono: solo números, sin espacios, mínimo 10 dígitos
        if (!/^\d{10,15}$/.test(newUserData.phone)) {
          toast.error('El teléfono debe contener solo números (código de área incluido, sin espacios). Ejemplo: 584124248787');
          setLoading(false);
          return;
        }
        if (!newUserData.cvFile) {
          toast.error('El CV es obligatorio');
          setLoading(false);
          return;
        }
        
        // Validar tamaño del archivo (máx 10MB)
        if (newUserData.cvFile.size > 10 * 1024 * 1024) {
          toast.error('El CV no debe superar los 10MB');
          setLoading(false);
          return;
        }
        
        toast.info('Subiendo CV...');
        
        // 1. Subir el CV primero a Supabase
        const formDataCV = new FormData();
        formDataCV.append('file', newUserData.cvFile);
        formDataCV.append('documentType', 'cv');
        formDataCV.append('metadata', JSON.stringify({
          userName: newUserData.name,
          uploadDate: new Date().toISOString()
        }));
        
        let cvUrl = null;
        try {
          const { data: uploadData } = await axios.post(
            `${BACKEND_URL}/api/storage/upload`,
            formDataCV,
            {
              headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              }
            }
          );
          cvUrl = uploadData.publicUrl;
          toast.success('CV subido correctamente');
        } catch (uploadError) {
          console.error('Error uploading CV:', uploadError);
          toast.error('Error al subir el CV');
          setLoading(false);
          return;
        }
        
        toast.info('Creando usuario y caso...');
        
        // 2. Crear usuario y caso con la URL del CV
        const createUserData = {
          name: newUserData.name,
          email: newUserData.email || undefined,
          phone: newUserData.phone || undefined,
          visaType: formData.visaType,
          coordinatorId: (formData.coordinator && formData.coordinator !== 'none') ? formData.coordinator : undefined,
          salesRepId: (formData.salesRep && formData.salesRep !== 'none') ? formData.salesRep : undefined,
          notes: formData.notes,
          cvUrl: cvUrl
        };
        
        const { data } = await axios.post(
          `${BACKEND_URL}/api/admin/users/create-with-case`,
          createUserData,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        
        toast.success('Usuario y caso creados exitosamente');
        
        // El magic link ahora viene en la respuesta del backend
        if (data.magicLink && isMountedRef.current) {
          // Guardar datos para el modal
          setMagicLinkData({
            userName: newUserData.name,
            magicLink: data.magicLink,
            caseId: data.case.id
          });
          
          // Copiar automáticamente al portapapeles
          try {
            await navigator.clipboard.writeText(data.magicLink);
            if (isMountedRef.current) {
              setCopied(true);
            }
          } catch (clipboardError) {
            console.error('Error copying to clipboard:', clipboardError);
            if (isMountedRef.current) {
              setCopied(false);
            }
          }
          
          // Pequeño delay para asegurar que React termine de renderizar
          setTimeout(() => {
            if (isMountedRef.current) {
              setShowMagicLinkModal(true);
            }
          }, 100);
        } else if (isMountedRef.current) {
          toast.warning('Usuario creado, pero no se pudo generar el magic link automáticamente.');
          // Delay antes de navegar para evitar race conditions
          setTimeout(() => {
            navigate(`/admin/visa-cases/${data.case.id}`);
          }, 300);
        }
      } else {
        // Validar que se haya seleccionado un usuario
        if (!formData.userId) {
          toast.error('Por favor selecciona un cliente');
          setLoading(false);
          return;
        }
        
        // Crear caso para usuario existente
        const submitData = { 
          userId: formData.userId,
          templateId: formData.templateId,
          visaType: formData.visaType,
          notes: formData.notes
        };
        
        // Solo agregar coordinatorId si no es 'none'
        if (formData.coordinator && formData.coordinator !== 'none') {
          submitData.coordinatorId = formData.coordinator;
        }
        
        // Solo agregar salesRepId si no es 'none'
        if (formData.salesRep && formData.salesRep !== 'none') {
          submitData.salesRepId = formData.salesRep;
        }
        
        const { data } = await axios.post(
          `${BACKEND_URL}/api/admin/visa-cases`,
          submitData,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        toast.success('Caso de visa creado exitosamente');
        // Delay para permitir que el toast se muestre antes de navegar
        setTimeout(() => {
          navigate(`/admin/visa-cases/${data.case._id || data.case.id}`);
        }, 300);
      }
    } catch (error) {
      console.error('Error creating visa case:', error);
      toast.error(error.response?.data?.detail || 'Error al crear el caso');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          onClick={() => navigate('/admin/visa-cases')}
          className="border-gray-900 text-gray-900 font-semibold hover:bg-gray-900 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Crear Caso de Visa</h1>
          <p className="text-gray-900 font-semibold mt-1">Sistema Pay As You Advance Visa™</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-gray-900 font-bold text-xl">Información del Caso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Client Selection Mode Toggle */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => setCreateNewUser(false)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    !createNewUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Seleccionar Usuario Existente
                </button>
                <button
                  type="button"
                  onClick={() => setCreateNewUser(true)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    createNewUser
                      ? 'bg-success text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Crear Nuevo Usuario
                </button>
              </div>

              {!createNewUser ? (
                // Seleccionar usuario existente
                <div className="space-y-2">
                  <Label htmlFor="userId" className="text-gray-900 font-semibold text-base">
                    Cliente <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={userPopoverOpen}
                        className="w-full justify-between border-gray-300 text-gray-700 hover:bg-gray-100 h-auto min-h-[40px]"
                      >
                        {formData.userId ? (
                          (() => {
                            const selectedUser = users.find(u => (u._id || u.id) === formData.userId);
                            if (!selectedUser) return <span className="text-gray-500">Selecciona un cliente...</span>;
                            return (
                              <div className="flex items-center gap-2 truncate">
                                <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                <div className="flex flex-col items-start text-left overflow-hidden">
                                  <span className="font-medium truncate w-full">{selectedUser.name}</span>
                                  {selectedUser.phone && (
                                    <span className="text-xs text-gray-500 truncate w-full">{selectedUser.phone}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-gray-500">Escribe para buscar cliente...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Buscar por nombre, teléfono o email..." 
                          value={userSearchQuery}
                          onValueChange={setUserSearchQuery}
                        />
                        <CommandList className="max-h-[300px] overflow-y-auto">
                          {userSearchQuery.length < 3 ? (
                            <CommandEmpty>Escribe al menos 3 caracteres para buscar...</CommandEmpty>
                          ) : searchingUsers ? (
                            <CommandEmpty>
                              <div className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Buscando...
                              </div>
                            </CommandEmpty>
                          ) : searchResults.length === 0 ? (
                            <CommandEmpty>No se encontraron clientes con "{userSearchQuery}"</CommandEmpty>
                          ) : (
                            <CommandGroup heading={`${searchResults.length} resultado(s) encontrado(s)`}>
                              {searchResults.map((user) => (
                                <CommandItem
                                  key={user._id || user.id}
                                  value={`${user.name} ${user.phone || ''} ${user.email || ''}`}
                                  onSelect={() => {
                                    handleChange('userId', user._id || user.id);
                                    // Agregar el usuario seleccionado a la lista local si no existe
                                    if (!users.find(u => (u._id || u.id) === (user._id || user.id))) {
                                      setUsers(prev => [...prev, user]);
                                    }
                                    setUserPopoverOpen(false);
                                    setUserSearchQuery('');
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${formData.userId === (user._id || user.id) ? 'opacity-100' : 'opacity-0'}`}
                                  />
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className="flex flex-col flex-1">
                                      <span className="font-medium">{user.name}</span>
                                      <div className="flex gap-2 text-xs text-gray-500">
                                        {user.phone && <span>📱 {user.phone}</span>}
                                        {user.email && <span>📧 {user.email}</span>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {user.casesCount || 0} caso{(user.casesCount || 0) !== 1 ? 's' : ''}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        {user.userState || 'U1'}
                                      </Badge>
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-sm text-gray-900 font-semibold">
                    Escribe nombre, teléfono o email para buscar el cliente
                  </p>
                </div>
              ) : (
                // Crear nuevo usuario
                <div className="space-y-4 border-2 border-success rounded-lg p-4 bg-green-50">
                  <h3 className="font-bold text-gray-900 text-lg">Datos del Nuevo Usuario</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="newUserName" className="text-gray-900 font-semibold text-base">
                      Nombre Completo <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="newUserName"
                      placeholder="Juan Pérez"
                      value={newUserData.name}
                      onChange={(e) => setNewUserData(prev => ({...prev, name: e.target.value}))}
                      className="border-gray-300 text-gray-900 font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newUserPhone" className="text-gray-900 font-semibold text-base">
                      Teléfono <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="newUserPhone"
                      type="tel"
                      placeholder="584124248787"
                      value={newUserData.phone}
                      onChange={(e) => {
                        // Solo permitir números, sin espacios ni símbolos
                        const value = e.target.value.replace(/[^\d]/g, '');
                        setNewUserData(prev => ({...prev, phone: value}));
                      }}
                      className="border-gray-300 text-gray-900 font-medium"
                      maxLength={15}
                    />
                    <p className="text-sm text-gray-600 font-medium">
                      Incluir código de área sin espacios. Ejemplo: 584124248787
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newUserEmail" className="text-gray-900 font-semibold text-base">
                      Email (Opcional)
                    </Label>
                    <Input
                      id="newUserEmail"
                      type="email"
                      placeholder="juan@example.com"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData(prev => ({...prev, email: e.target.value}))}
                      className="border-gray-300 text-gray-900 font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newUserCV" className="text-gray-900 font-semibold text-base">
                      CV/Resume <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="newUserCV"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewUserData(prev => ({...prev, cvFile: file}));
                        }
                      }}
                      className="border-gray-300 text-gray-900 font-medium cursor-pointer"
                    />
                    <p className="text-sm text-gray-900 font-semibold">
                      Formatos aceptados: PDF, DOC, DOCX (máx. 10MB)
                    </p>
                  </div>

                  <p className="text-sm text-red-600 font-bold">
                    ⚠️ El teléfono y el CV son OBLIGATORIOS
                  </p>
                </div>
              )}
            </div>

            {/* Tipo de Caso - Fijo (EB-2 NIW) */}
            <div className="space-y-2">
              <Label className="text-gray-900 font-semibold text-base">
                Tipo de Caso
              </Label>
              <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Info className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <p className="text-lg font-bold text-blue-900">
                      EB-2 NIW (National Interest Waiver)
                    </p>
                    <p className="text-sm text-blue-800">
                      Visa de inmigrante basada en empleo para profesionales con habilidades excepcionales o títulos avanzados que beneficien el interés nacional de EE.UU.
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-blue-700 font-semibold mt-2">
                      <span>💰 ${masterCaseStats.totalAmount.toLocaleString()} USD</span>
                      <span>📊 {masterCaseStats.stages} etapas</span>
                      <span>📦 {masterCaseStats.deliverables} entregables</span>
                      <span>📄 {masterCaseStats.documents} documentos</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-900 font-semibold">
                Este es el caso maestro configurado en el sistema
              </p>
            </div>

            {/* Coordinator */}
            <div className="space-y-2">
              <Label htmlFor="coordinatorId" className="text-gray-900 font-semibold text-base">
                Coordinadora Asignada
              </Label>
              <Popover open={coordinatorPopoverOpen} onOpenChange={setCoordinatorPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={coordinatorPopoverOpen}
                    className="w-full justify-between border-gray-300 text-gray-700 hover:bg-gray-100 h-auto min-h-[40px]"
                  >
                    {formData.coordinator && formData.coordinator !== 'none' ? (
                      (() => {
                        const coordinator = staff.find(s => s._id === formData.coordinator);
                        if (!coordinator) return <span className="text-gray-500">Seleccionar coordinadora...</span>;
                        return (
                          <div className="flex items-center gap-2 truncate">
                            <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <div className="flex flex-col items-start text-left overflow-hidden">
                              <span className="font-medium truncate w-full">{coordinator.name}</span>
                              <span className="text-xs text-gray-500 truncate w-full">{coordinator.email}</span>
                            </div>
                          </div>
                        );
                      })()
                    ) : formData.coordinator === 'none' ? (
                      <span className="text-gray-500">Sin asignar</span>
                    ) : (
                      <span className="text-gray-500">Seleccionar coordinadora...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar por nombre o email..." />
                    <CommandList className="max-h-[300px] overflow-y-auto">
                      <CommandEmpty>No se encontraron coordinadores.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none-option"
                          onSelect={() => {
                            handleChange('coordinator', 'none');
                            setCoordinatorPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${formData.coordinator === 'none' ? 'opacity-100' : 'opacity-0'}`}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">Sin asignar</span>
                            <span className="text-xs text-gray-500">No asignar coordinador</span>
                          </div>
                        </CommandItem>
                        {staff
                          .filter(s => ['coordinator', 'manager', 'admin', 'super_admin', 'advisor'].includes(s.role))
                          .map((staffMember) => {
                            const isCurrentUser = admin && (
                              staffMember._id === (admin._id || admin.id) || 
                              staffMember.email === admin.email
                            );
                            
                            return (
                              <CommandItem
                                key={staffMember._id}
                                value={`${staffMember.name} ${staffMember.email} ${staffMember.role}`}
                                onSelect={() => {
                                  handleChange('coordinator', staffMember._id);
                                  setCoordinatorPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${formData.coordinator === staffMember._id ? 'opacity-100' : 'opacity-0'}`}
                                />
                                <div className="flex items-center gap-2 flex-1">
                                  <div className="flex flex-col flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{staffMember.name}</span>
                                      {isCurrentUser && (
                                        <Badge className="text-xs bg-blue-500 text-white">
                                          Tú
                                        </Badge>
                                      )}
                                      <Badge variant="secondary" className="text-xs">
                                        {staffMember.role}
                                      </Badge>
                                    </div>
                                    <span className="text-xs text-gray-500">{staffMember.email}</span>
                                  </div>
                                </div>
                              </CommandItem>
                            );
                          })
                        }
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-sm text-gray-900 font-semibold">
                {admin?.role === 'coordinator' || admin?.role === 'advisor' 
                  ? 'Por defecto se te asigna a ti. Puedes cambiarlo o dejarlo sin asignar.'
                  : 'Selecciona un coordinador o déjalo sin asignar.'}
              </p>
            </div>

            {/* Sales Representative (Vendedor) */}
            <div className="space-y-2">
              <Label htmlFor="salesRepId" className="text-gray-900 font-semibold text-base">
                Vendedor Asignado
              </Label>
              <Popover open={salesRepPopoverOpen} onOpenChange={setSalesRepPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={salesRepPopoverOpen}
                    className="w-full justify-between border-gray-300 text-gray-700 hover:bg-gray-100 h-auto min-h-[40px]"
                  >
                    {formData.salesRep && formData.salesRep !== 'none' ? (
                      (() => {
                        const salesRep = staff.find(s => s._id === formData.salesRep);
                        if (!salesRep) return <span className="text-gray-500">Seleccionar vendedor...</span>;
                        return (
                          <div className="flex items-center gap-2 truncate">
                            <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <div className="flex flex-col items-start text-left overflow-hidden">
                              <span className="font-medium truncate w-full">{salesRep.name}</span>
                              <span className="text-xs text-gray-500 truncate w-full">{salesRep.email}</span>
                            </div>
                          </div>
                        );
                      })()
                    ) : formData.salesRep === 'none' ? (
                      <span className="text-gray-500">Sin asignar</span>
                    ) : (
                      <span className="text-gray-500">Seleccionar vendedor...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar por nombre o email..." />
                    <CommandList className="max-h-[300px] overflow-y-auto">
                      <CommandEmpty>No se encontraron vendedores.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none-option"
                          onSelect={() => {
                            handleChange('salesRep', 'none');
                            setSalesRepPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${formData.salesRep === 'none' ? 'opacity-100' : 'opacity-0'}`}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">Sin asignar</span>
                            <span className="text-xs text-gray-500">No asignar vendedor</span>
                          </div>
                        </CommandItem>
                        {staff.map((staffMember) => {
                          const isCurrentUser = admin && (
                            staffMember._id === (admin._id || admin.id) || 
                            staffMember.email === admin.email
                          );
                          
                          return (
                            <CommandItem
                              key={staffMember._id}
                              value={`${staffMember.name} ${staffMember.email} ${staffMember.role}`}
                              onSelect={() => {
                                handleChange('salesRep', staffMember._id);
                                setSalesRepPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${formData.salesRep === staffMember._id ? 'opacity-100' : 'opacity-0'}`}
                              />
                              <div className="flex items-center gap-2 flex-1">
                                <div className="flex flex-col flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{staffMember.name}</span>
                                    {isCurrentUser && (
                                      <Badge className="text-xs bg-blue-500 text-white">
                                        Tú
                                      </Badge>
                                    )}
                                    <Badge variant="secondary" className="text-xs">
                                      {staffMember.role}
                                    </Badge>
                                  </div>
                                  <span className="text-xs text-gray-500">{staffMember.email}</span>
                                </div>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-sm text-gray-900 font-semibold">
                Selecciona un vendedor para asignar al caso o déjalo sin asignar.
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-gray-900 font-semibold text-base">
                Notas Iniciales
              </Label>
              <Textarea
                id="notes"
                placeholder="Agrega notas iniciales sobre el caso (opcional)"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={4}
                className="text-gray-900 font-medium"
              />
              <p className="text-sm text-gray-900 font-semibold">
                Información adicional relevante para el caso
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Info className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-blue-900 mb-3 text-lg">
                    ¿Qué sucede al crear el caso?
                  </h4>
                  <ul className="text-sm text-blue-900 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-success font-bold">✅</span>
                      <span>Se crearán automáticamente las <strong className="text-blue-700">{masterCaseStats.stages} etapas</strong> del proceso</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-success font-bold">📄</span>
                      <span>Se generarán <strong className="text-blue-700">{masterCaseStats.deliverables} entregables</strong> distribuidos en las etapas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-success font-bold">📋</span>
                      <span>Se creará el checklist con <strong className="text-blue-700">{masterCaseStats.documents} documentos requeridos</strong> del cliente</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-success font-bold">🔓</span>
                      <span>El cliente recibirá acceso a su dashboard</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-success font-bold">🚀</span>
                      <span>La Etapa 1 estará desbloqueada automáticamente</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/visa-cases')}
                disabled={loading}
                className="text-gray-700 hover:text-gray-900"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                disabled={loading || (!createNewUser && !formData.userId)}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {createNewUser ? 'Crear Usuario y Caso' : 'Crear Caso de Visa'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Magic Link Modal */}
      <Dialog open={showMagicLinkModal} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle2 className="h-7 w-7 text-success" />
              ¡Usuario Creado Exitosamente!
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              El usuario <strong className="text-gray-900">{magicLinkData?.userName}</strong> ha sido creado junto con su caso de visa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Magic Link Display */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ExternalLink className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-blue-900">Magic Link de Acceso</h3>
              </div>
              
              <div className="bg-white border border-blue-200 rounded-md p-3 mb-3">
                <code className="text-sm text-blue-800 break-all font-mono">
                  {magicLinkData?.magicLink}
                </code>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(magicLinkData?.magicLink);
                      setCopied(true);
                      toast.success('Link copiado al portapapeles');
                      setTimeout(() => setCopied(false), 2000);
                    } catch (err) {
                      toast.error('Error al copiar el link');
                    }
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar Link
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={() => {
                    window.open(magicLinkData?.magicLink, '_blank');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir Link
                </Button>
              </div>
            </div>

            {/* Important Info */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-2">Información Importante:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Comparte este link con el cliente para que acceda sin contraseña</li>
                    <li>El link fue enviado automáticamente al sistema de automatización N8N</li>
                    <li>El caso incluye <strong>11 etapas, 23 entregables y 13 documentos</strong></li>
                    <li>El cliente tendrá acceso inmediato a su dashboard</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!isMountedRef.current) return;
                setShowMagicLinkModal(false);
                setTimeout(() => {
                  if (isMountedRef.current) {
                    setCopied(false);
                  }
                }, 200);
              }}
            >
              Cerrar
            </Button>
            <Button
              className="bg-success hover:bg-green-700"
              onClick={() => {
                if (!isMountedRef.current) return;
                setShowMagicLinkModal(false);
                setCopied(false);
                // Delay para permitir que el modal se cierre completamente antes de navegar
                setTimeout(() => {
                  if (isMountedRef.current) {
                    navigate(`/admin/visa-cases/${magicLinkData?.caseId}`);
                  }
                }, 300);
              }}
            >
              Ver Caso Creado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VisaCaseCreate;
