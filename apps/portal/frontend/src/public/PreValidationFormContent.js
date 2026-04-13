import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, ChevronDown, Search, Check, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Latin American countries with their states/provinces and major cities
const LATAM_DATA = {
  'Argentina': {
    states: ['Buenos Aires', 'Córdoba', 'Santa Fe', 'Mendoza', 'Tucumán', 'Entre Ríos', 'Salta', 'Misiones', 'Chaco', 'Corrientes', 'Santiago del Estero', 'San Juan', 'Jujuy', 'Río Negro', 'Neuquén', 'Formosa', 'Chubut', 'San Luis', 'Catamarca', 'La Rioja', 'La Pampa', 'Santa Cruz', 'Tierra del Fuego'],
    cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'San Miguel de Tucumán', 'La Plata', 'Mar del Plata', 'Salta', 'Santa Fe']
  },
  'Bolivia': {
    states: ['La Paz', 'Santa Cruz', 'Cochabamba', 'Potosí', 'Chuquisaca', 'Oruro', 'Tarija', 'Beni', 'Pando'],
    cities: ['La Paz', 'Santa Cruz de la Sierra', 'Cochabamba', 'Sucre', 'Oruro', 'Tarija', 'Potosí']
  },
  'Brasil': {
    states: ['São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Bahia', 'Paraná', 'Rio Grande do Sul', 'Pernambuco', 'Ceará', 'Pará', 'Santa Catarina', 'Goiás', 'Maranhão', 'Amazonas', 'Espírito Santo', 'Paraíba', 'Mato Grosso', 'Rio Grande do Norte', 'Alagoas', 'Piauí', 'Distrito Federal'],
    cities: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Porto Alegre']
  },
  'Chile': {
    states: ['Región Metropolitana', 'Valparaíso', 'Biobío', 'Maule', 'La Araucanía', 'O\'Higgins', 'Los Lagos', 'Coquimbo', 'Antofagasta', 'Los Ríos', 'Atacama', 'Tarapacá', 'Ñuble', 'Arica y Parinacota', 'Aysén', 'Magallanes'],
    cities: ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco', 'Rancagua', 'Talca', 'Arica', 'Iquique']
  },
  'Colombia': {
    states: ['Bogotá D.C.', 'Antioquia', 'Valle del Cauca', 'Atlántico', 'Santander', 'Cundinamarca', 'Bolívar', 'Nariño', 'Norte de Santander', 'Córdoba', 'Tolima', 'Cauca', 'Boyacá', 'Magdalena', 'Huila', 'Cesar', 'Meta', 'Risaralda', 'Caldas', 'Sucre'],
    cities: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta', 'Bucaramanga', 'Pereira', 'Santa Marta', 'Ibagué', 'Manizales']
  },
  'Costa Rica': {
    states: ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón'],
    cities: ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Liberia', 'Puntarenas', 'Limón']
  },
  'Cuba': {
    states: ['La Habana', 'Santiago de Cuba', 'Holguín', 'Camagüey', 'Villa Clara', 'Granma', 'Guantánamo', 'Las Tunas', 'Pinar del Río', 'Sancti Spíritus', 'Matanzas', 'Cienfuegos', 'Ciego de Ávila'],
    cities: ['La Habana', 'Santiago de Cuba', 'Camagüey', 'Holguín', 'Santa Clara', 'Guantánamo', 'Bayamo']
  },
  'Ecuador': {
    states: ['Guayas', 'Pichincha', 'Manabí', 'Los Ríos', 'Azuay', 'El Oro', 'Esmeraldas', 'Tungurahua', 'Chimborazo', 'Loja', 'Imbabura', 'Santo Domingo', 'Cotopaxi', 'Santa Elena'],
    cities: ['Guayaquil', 'Quito', 'Cuenca', 'Santo Domingo', 'Machala', 'Manta', 'Portoviejo', 'Ambato', 'Riobamba', 'Loja']
  },
  'El Salvador': {
    states: ['San Salvador', 'Santa Ana', 'San Miguel', 'La Libertad', 'Sonsonate', 'Usulután', 'Ahuachapán', 'La Paz', 'La Unión', 'Cuscatlán', 'Chalatenango', 'Morazán', 'San Vicente', 'Cabañas'],
    cities: ['San Salvador', 'Santa Ana', 'San Miguel', 'Mejicanos', 'Santa Tecla', 'Soyapango', 'Apopa']
  },
  'Guatemala': {
    states: ['Guatemala', 'Quetzaltenango', 'Escuintla', 'Alta Verapaz', 'San Marcos', 'Huehuetenango', 'Petén', 'Suchitepéquez', 'Chimaltenango', 'Sacatepéquez', 'Jutiapa', 'Izabal'],
    cities: ['Ciudad de Guatemala', 'Mixco', 'Villa Nueva', 'Quetzaltenango', 'Escuintla', 'Petapa', 'San Juan Sacatepéquez']
  },
  'Honduras': {
    states: ['Francisco Morazán', 'Cortés', 'Yoro', 'Atlántida', 'Olancho', 'Choluteca', 'Comayagua', 'El Paraíso', 'Copán', 'Santa Bárbara', 'Lempira', 'Colón'],
    cities: ['Tegucigalpa', 'San Pedro Sula', 'Choloma', 'La Ceiba', 'El Progreso', 'Choluteca', 'Comayagua']
  },
  'México': {
    states: ['Ciudad de México', 'Estado de México', 'Jalisco', 'Nuevo León', 'Veracruz', 'Puebla', 'Guanajuato', 'Chiapas', 'Michoacán', 'Oaxaca', 'Chihuahua', 'Tamaulipas', 'Guerrero', 'Baja California', 'Sinaloa', 'Coahuila', 'Sonora', 'Hidalgo', 'San Luis Potosí', 'Tabasco', 'Yucatán', 'Querétaro', 'Morelos', 'Durango', 'Zacatecas', 'Aguascalientes', 'Quintana Roo', 'Nayarit', 'Tlaxcala', 'Campeche', 'Colima', 'Baja California Sur'],
    cities: ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez', 'Zapopan', 'Mérida', 'San Luis Potosí', 'Aguascalientes', 'Hermosillo', 'Saltillo', 'Mexicali', 'Culiacán', 'Querétaro', 'Morelia', 'Chihuahua', 'Cancún']
  },
  'Nicaragua': {
    states: ['Managua', 'Matagalpa', 'León', 'Chinandega', 'Masaya', 'Estelí', 'Granada', 'Jinotega', 'Nueva Segovia', 'Rivas', 'Carazo', 'Boaco', 'Chontales', 'Madriz'],
    cities: ['Managua', 'León', 'Masaya', 'Matagalpa', 'Chinandega', 'Estelí', 'Granada', 'Jinotega']
  },
  'Panamá': {
    states: ['Panamá', 'Panamá Oeste', 'Chiriquí', 'Colón', 'Coclé', 'Veraguas', 'Herrera', 'Los Santos', 'Bocas del Toro', 'Darién'],
    cities: ['Ciudad de Panamá', 'San Miguelito', 'David', 'Colón', 'La Chorrera', 'Arraiján', 'Santiago']
  },
  'Paraguay': {
    states: ['Central', 'Alto Paraná', 'Itapúa', 'Caaguazú', 'San Pedro', 'Cordillera', 'Paraguarí', 'Guairá', 'Concepción', 'Canindeyú', 'Presidente Hayes', 'Amambay', 'Caazapá', 'Misiones', 'Ñeembucú'],
    cities: ['Asunción', 'Ciudad del Este', 'San Lorenzo', 'Luque', 'Capiatá', 'Lambaré', 'Fernando de la Mora', 'Encarnación']
  },
  'Perú': {
    states: ['Lima', 'La Libertad', 'Piura', 'Cajamarca', 'Puno', 'Junín', 'Cusco', 'Arequipa', 'Lambayeque', 'Ancash', 'Loreto', 'San Martín', 'Ica', 'Huánuco', 'Ayacucho', 'Ucayali', 'Apurímac', 'Amazonas', 'Tacna', 'Pasco', 'Tumbes', 'Moquegua', 'Callao', 'Madre de Dios'],
    cities: ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Iquitos', 'Cusco', 'Chimbote', 'Huancayo', 'Tacna', 'Juliaca', 'Ica']
  },
  'Puerto Rico': {
    states: ['San Juan', 'Bayamón', 'Carolina', 'Ponce', 'Caguas', 'Guaynabo', 'Mayagüez', 'Arecibo'],
    cities: ['San Juan', 'Bayamón', 'Carolina', 'Ponce', 'Caguas', 'Guaynabo', 'Mayagüez', 'Arecibo']
  },
  'República Dominicana': {
    states: ['Distrito Nacional', 'Santo Domingo', 'Santiago', 'San Cristóbal', 'La Vega', 'Puerto Plata', 'San Pedro de Macorís', 'Duarte', 'La Romana', 'San Juan', 'Espaillat', 'La Altagracia'],
    cities: ['Santo Domingo', 'Santiago de los Caballeros', 'Santo Domingo Este', 'Santo Domingo Norte', 'San Pedro de Macorís', 'La Romana', 'San Cristóbal', 'Puerto Plata']
  },
  'Uruguay': {
    states: ['Montevideo', 'Canelones', 'Maldonado', 'Salto', 'Colonia', 'Paysandú', 'Rivera', 'San José', 'Tacuarembó', 'Cerro Largo', 'Rocha', 'Artigas', 'Soriano', 'Lavalleja', 'Durazno', 'Río Negro', 'Florida', 'Treinta y Tres', 'Flores'],
    cities: ['Montevideo', 'Salto', 'Ciudad de la Costa', 'Paysandú', 'Las Piedras', 'Rivera', 'Maldonado', 'Tacuarembó']
  },
  'Venezuela': {
    states: ['Distrito Capital', 'Miranda', 'Zulia', 'Carabobo', 'Lara', 'Aragua', 'Anzoátegui', 'Bolívar', 'Táchira', 'Mérida', 'Falcón', 'Barinas', 'Monagas', 'Portuguesa', 'Sucre', 'Trujillo', 'Guárico', 'Nueva Esparta', 'Yaracuy', 'Apure', 'Cojedes', 'Delta Amacuro', 'Amazonas', 'Vargas'],
    cities: ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Maracay', 'Ciudad Guayana', 'Barcelona', 'Maturín', 'Petare', 'San Cristóbal', 'Mérida', 'Barinas']
  }
};

const COUNTRY_LIST = Object.keys(LATAM_DATA).sort();

// Searchable Select Component
const SearchableSelect = ({ 
  label, 
  value, 
  onChange, 
  options, 
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  required = false,
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2" ref={dropdownRef}>
      <Label className="text-gray-300">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-left transition-colors
            ${disabled 
              ? 'bg-navy-light/50 border-navy-light text-gray-500 cursor-not-allowed' 
              : 'bg-navy-light border-navy-light text-white hover:border-gold-primary/50'
            }`}
        >
          <span className={value ? 'text-white' : 'text-gray-500'}>
            {value || placeholder}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-navy-secondary border border-navy-light rounded-md shadow-lg max-h-60 overflow-hidden">
            <div className="p-2 border-b border-navy-light">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 bg-navy-light border border-navy-light rounded text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-gold-primary/50"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      onChange(option);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-navy-light transition-colors
                      ${value === option ? 'text-gold-primary bg-navy-light' : 'text-gray-300'}`}
                  >
                    {option}
                    {value === option && <Check className="h-4 w-4" />}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">No se encontraron resultados</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Empty family member template
const emptyFamilyMember = {
  lastName: '',
  firstName: '',
  middleName: '',
  dateOfBirth: '',
  countryOfBirth: '',
  relationship: ''
  // Note: adjustmentOfStatus and visaAbroad are auto-filled based on processing type
};

const PreValidationFormContent = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(null);
  const [answers, setAnswers] = useState({
    // Processing type
    processing_type: '', // 'consular' or 'usa'
    // Consular processing fields
    consular_city: '',
    consular_country: '',
    // USA processing / Foreign address fields
    foreign_country_residence: '',
    street_address: '',
    apt_suite: '',
    city: '',
    state: '',
    province: '',
    zip_code: '',
    postal_code: '',
    country: '',
    // Beneficiary info (Part 3)
    beneficiary_last_name: '',
    beneficiary_first_name: '',
    beneficiary_middle_name: '',
    beneficiary_dob: '',
    beneficiary_city_of_birth: '',
    beneficiary_state_of_birth: '',
    beneficiary_country_of_birth: '',
    beneficiary_nationality: '',
    // Other fields
    uscis_account: '',
    ssn: '',
    a_number: '',
    email: '',
    phone: '',
    // Family info
    has_family: '', // 'yes' or 'no'
    family_count: '', // '1' to '6' - number of family members
  });
  const [familyMembers, setFamilyMembers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/uscis-forms/public/form/${token}`);
        setFormData(response.data);
      } catch (error) {
        console.error('Error fetching form:', error);
        toast.error('Error al cargar el formulario');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchFormData();
    }
  }, [token]);

  const handleChange = (field, value) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const handleFamilyMemberChange = (index, field, value) => {
    setFamilyMembers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addFamilyMember = () => {
    if (familyMembers.length < 6) {
      setFamilyMembers(prev => [...prev, { ...emptyFamilyMember }]);
    }
  };

  const removeFamilyMember = (index) => {
    setFamilyMembers(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    // Processing type is required
    if (!answers.processing_type) {
      toast.error('Debe seleccionar dónde se procesará la visa');
      return false;
    }

    // Consular processing validation
    if (answers.processing_type === 'consular') {
      if (!answers.consular_city || !answers.consular_country) {
        toast.error('Para proceso consular, debe indicar la ciudad y país del consulado');
        return false;
      }
    }

    // USA processing validation - requires foreign address
    if (answers.processing_type === 'usa') {
      const requiredUsaFields = [
        { field: 'foreign_country_residence', name: 'País de residencia actual' },
        { field: 'street_address', name: 'Calle y Número' },
        { field: 'city', name: 'Ciudad' },
        { field: 'country', name: 'País de la dirección' }
      ];
      for (const { field, name } of requiredUsaFields) {
        if (!answers[field] || answers[field].trim() === '') {
          toast.error(`El campo "${name}" es obligatorio para ajuste de estatus`);
          return false;
        }
      }
    }

    // Beneficiary info validation (required after processing type is selected)
    if (answers.processing_type) {
      const requiredBeneficiaryFields = [
        { field: 'beneficiary_last_name', name: 'Apellido del Beneficiario' },
        { field: 'beneficiary_first_name', name: 'Nombre del Beneficiario' },
        { field: 'beneficiary_dob', name: 'Fecha de Nacimiento' },
        { field: 'beneficiary_city_of_birth', name: 'Ciudad de Nacimiento' },
        { field: 'beneficiary_country_of_birth', name: 'País de Nacimiento' },
        { field: 'beneficiary_nationality', name: 'País de Ciudadanía o Nacionalidad' }
      ];
      for (const { field, name } of requiredBeneficiaryFields) {
        if (!answers[field] || answers[field].trim() === '') {
          toast.error(`El campo "${name}" es obligatorio`);
          return false;
        }
      }
    }

    // Basic required fields - SSN is required, USCIS Account and A-Number are optional
    const required = [
      { field: 'ssn', name: 'Número de Seguro Social' },
      { field: 'email', name: 'Correo Electrónico' },
      { field: 'phone', name: 'Número de Teléfono' }
    ];
    
    for (const { field, name } of required) {
      if (!answers[field] || answers[field].trim() === '') {
        toast.error(`El campo "${name}" es obligatorio`);
        return false;
      }
    }

    // Validate no hyphens in numeric fields (only if they have values)
    const fieldsToCheck = [
      { field: 'uscis_account', name: 'Número de cuenta USCIS' },
      { field: 'ssn', name: 'Número de Seguro Social' },
      { field: 'a_number', name: 'Código A' }
    ];
    for (const { field, name } of fieldsToCheck) {
      if (answers[field] && answers[field].trim() !== '' && answers[field].includes('-')) {
        toast.error(`El campo "${name}" no debe contener guiones`);
        return false;
      }
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(answers.email)) {
      toast.error('Por favor ingrese un email válido');
      return false;
    }

    // Validate family members if has_family is yes
    if (answers.has_family === 'yes') {
      if (!answers.family_count) {
        toast.error('Seleccione cuántos familiares acompañarán al beneficiario');
        return false;
      }
      
      if (familyMembers.length > 0) {
        for (let i = 0; i < familyMembers.length; i++) {
          const member = familyMembers[i];
          if (!member.lastName || !member.firstName || !member.relationship) {
            toast.error(`Complete los datos obligatorios de la Persona ${i + 1} (Apellido, Nombre, Relación)`);
            return false;
          }
          if (!member.dateOfBirth) {
            toast.error(`Complete la Fecha de Nacimiento de la Persona ${i + 1}`);
            return false;
          }
          if (!member.countryOfBirth) {
            toast.error(`Seleccione el País de Nacimiento de la Persona ${i + 1}`);
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      // Determine Adjustment of Status and Visa Abroad values based on processing type
      const isConsular = answers.processing_type === 'consular';
      const isUsa = answers.processing_type === 'usa';
      
      // For beneficiary: if consular -> Adjustment NO, Visa Abroad YES
      // If USA -> Adjustment YES, Visa Abroad NO (they will adjust status in US)
      const beneficiaryAdjustment = isUsa ? 'Sí' : 'No';
      const beneficiaryVisaAbroad = isConsular ? 'Sí' : 'No';

      // Format answers for submission with correct field names matching N8N template questions
      const formattedAnswers = [
        // Processing type selection
        { 
          question: '¿Dónde procesará la visa el beneficiario?', 
          answer: isConsular 
            ? '1.a. Aplicará para visa en embajada o consulado de EE.UU.' 
            : '2.a. Está en EE.UU. y solicitará ajuste de estatus' 
        },
        
        // Part 1 - Petitioner Info (same as beneficiary for self-petitioner)
        { question: '1.a. Apellido (si es individuo)', answer: answers.beneficiary_last_name },
        { question: '1.b. Nombre (si es individuo)', answer: answers.beneficiary_first_name },
        { question: '1.c. Segundo Nombre (si es individuo)', answer: answers.beneficiary_middle_name || '' },
        
        // Part 1 - USCIS Account and SSN
        { question: '8. USCIS Online Account Number (si aplica)', answer: answers.uscis_account },
        { question: '7. Número de Seguro Social de EE.UU. (si aplica)', answer: answers.ssn },
        
        // Part 3 - Beneficiary Info
        { question: '1.a. Apellido del Beneficiario', answer: answers.beneficiary_last_name },
        { question: '1.b. Nombre del Beneficiario', answer: answers.beneficiary_first_name },
        { question: '1.c. Segundo Nombre del Beneficiario', answer: answers.beneficiary_middle_name || '' },
        { question: '3. Fecha de Nacimiento', answer: answers.beneficiary_dob },
        { question: '4. Ciudad/Pueblo de Nacimiento', answer: answers.beneficiary_city_of_birth },
        { question: '5. Estado o Provincia de Nacimiento', answer: answers.beneficiary_state_of_birth || '' },
        { question: '6. País de Nacimiento', answer: answers.beneficiary_country_of_birth },
        { question: '7. País de Ciudadanía o Nacionalidad', answer: answers.beneficiary_nationality },
        { question: '8. Número de Registro de Extranjero (A-Number)', answer: answers.a_number },
        
        // Part 8 - Contact Info
        { question: '5. Dirección de Email', answer: answers.email },
        { question: '3. Teléfono de Día', answer: answers.phone },
      ];

      // Add consular processing fields
      if (isConsular) {
        formattedAnswers.push(
          { question: '1.a. Ciudad o Pueblo', answer: answers.consular_city },
          { question: '1.c. País', answer: answers.consular_country }
        );
      }

      // Add USA processing / foreign address fields (removed 3.e postal code as per requirement)
      if (isUsa) {
        formattedAnswers.push(
          { question: '2.b. País de residencia actual del beneficiario', answer: answers.foreign_country_residence },
          { question: '3.a. Número y Nombre de la Calle', answer: answers.street_address },
          { question: '3.b. Apartamento', answer: answers.apt_suite || '' },
          { question: '3.c. Ciudad', answer: answers.city },
          { question: '3.d. Provincia', answer: answers.state || answers.province || '' },
          { question: '3.f. País', answer: answers.country }
        );
      }

      // Add family members if any
      if (answers.has_family === 'yes' && familyMembers.length > 0) {
        formattedAnswers.push({ 
          question: '¿El beneficiario tiene cónyuge o hijos que lo acompañarán?', 
          answer: 'Sí' 
        });
        
        formattedAnswers.push({
          question: '¿Cuántos familiares acompañarán al beneficiario?',
          answer: answers.family_count
        });

        // Map for question number patterns per person - MUST MATCH TEMPLATE QUESTIONS EXACTLY
        const personQuestionMap = [
          { lastName: 'Persona 1 - Apellido', firstName: 'Persona 1 - Nombre', middleName: 'Persona 1 - Segundo Nombre', dob: 'Persona 1 - Fecha de Nacimiento', country: 'Persona 1 - País de Nacimiento', relationship: 'Persona 1 - Relación con el Beneficiario', adjustment: 'Persona 1 - Adjustment of Status', visa: 'Persona 1 - Visa Abroad' },
          { lastName: 'Persona 2 - Apellido', firstName: 'Persona 2 - Nombre', middleName: 'Persona 2 - Segundo Nombre', dob: 'Persona 2 - Fecha de Nacimiento', country: 'Persona 2 - País de Nacimiento', relationship: 'Persona 2 - Relación con el Beneficiario', adjustment: 'Persona 2 - Adjustment of Status', visa: 'Persona 2 - Visa Abroad' },
          { lastName: 'Persona 3 - Apellido', firstName: 'Persona 3 - Nombre', middleName: 'Persona 3 - Segundo Nombre', dob: 'Persona 3 - Fecha de Nacimiento', country: 'Persona 3 - País de Nacimiento', relationship: 'Persona 3 - Relación con el Beneficiario', adjustment: 'Persona 3 - Adjustment of Status', visa: 'Persona 3 - Visa Abroad' },
          { lastName: 'Persona 4 - Apellido', firstName: 'Persona 4 - Nombre', middleName: 'Persona 4 - Segundo Nombre', dob: 'Persona 4 - Fecha de Nacimiento', country: 'Persona 4 - País de Nacimiento', relationship: 'Persona 4 - Relación con el Beneficiario', adjustment: 'Persona 4 - Adjustment of Status', visa: 'Persona 4 - Visa Abroad' },
          { lastName: 'Persona 5 - Apellido', firstName: 'Persona 5 - Nombre', middleName: 'Persona 5 - Segundo Nombre', dob: 'Persona 5 - Fecha de Nacimiento', country: 'Persona 5 - País de Nacimiento', relationship: 'Persona 5 - Relación con el Beneficiario', adjustment: 'Persona 5 - Adjustment of Status', visa: 'Persona 5 - Visa Abroad' },
          { lastName: 'Persona 6 - Apellido', firstName: 'Persona 6 - Nombre', middleName: 'Persona 6 - Segundo Nombre', dob: 'Persona 6 - Fecha de Nacimiento', country: 'Persona 6 - País de Nacimiento', relationship: 'Persona 6 - Relación con el Beneficiario', adjustment: 'Persona 6 - Adjustment of Status', visa: 'Persona 6 - Visa Abroad' },
        ];

        familyMembers.forEach((member, index) => {
          if (index < 6) {
            const qMap = personQuestionMap[index];
            
            // Auto-fill Adjustment and Visa based on processing type:
            // - Proceso Consular: Adjustment = No, Visa Abroad = Yes
            // - Dentro de EEUU: Adjustment = No, Visa Abroad = No
            let adjustmentAnswer = 'No';
            let visaAnswer = 'No';
            
            if (isConsular) {
              adjustmentAnswer = 'No';
              visaAnswer = 'Sí';
            } else {
              // Dentro de EEUU
              adjustmentAnswer = 'No';
              visaAnswer = 'No';
            }
            
            // Normalize relationship to match template options (Spouse, Child, Son, Daughter)
            let normalizedRelationship = member.relationship;
            if (member.relationship === 'Cónyuge') {
              normalizedRelationship = 'Spouse';
            } else if (member.relationship === 'Hijo/a') {
              normalizedRelationship = 'Child';
            }
            
            formattedAnswers.push(
              { question: qMap.lastName, answer: member.lastName },
              { question: qMap.firstName, answer: member.firstName },
              { question: qMap.middleName, answer: member.middleName || '' },
              { question: qMap.dob, answer: member.dateOfBirth || '' },
              { question: qMap.country, answer: member.countryOfBirth || '' },
              { question: qMap.relationship, answer: normalizedRelationship },
              // Auto-filled based on processing type
              { question: qMap.adjustment, answer: adjustmentAnswer },
              { question: qMap.visa, answer: visaAnswer }
            );
          }
        });
      } else {
        formattedAnswers.push({ 
          question: '¿El beneficiario tiene cónyuge o hijos?', 
          answer: 'No tiene cónyuge ni hijos' 
        });
      }

      await axios.post(`${BACKEND_URL}/api/uscis-forms/public/form/${token}/submit`, {
        client_name: formData?.client_name || '',
        client_email: answers.email,
        answers: formattedAnswers
      });

      setSubmitted(true);
      toast.success('Respuestas enviadas exitosamente');
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(error.response?.data?.detail || 'Error al enviar las respuestas');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-gold-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
        <Card className="bg-navy-secondary border-navy-light max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">¡Gracias!</h2>
            <p className="text-gray-300 mb-4">
              Un coordinador de tu caso verificará las respuestas y continuará con el proceso.
            </p>
            <p className="text-sm text-gray-400">
              Esta información es para validar antes de diligenciar el formulario, mantente atento a los siguientes pasos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-primary flex flex-col">
      {/* Top Header Bar with Logo */}
      <div className="bg-navy-secondary border-b border-navy-light sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_migrasuite/artifacts/vr2qwbqg_Recurso%2012LOGO.png" 
                alt="URPE Logo" 
                className="h-10 w-auto"
              />
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Formulario de Pre-Validación</p>
              <p className="text-gold-primary font-medium">{formData?.form_code || 'USCIS'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <Card className="bg-navy-secondary border-navy-light">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-white text-2xl mb-1">
                  Pre-Validación de Información
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Por favor complete la siguiente información básica. Esta información es necesaria para validar antes de diligenciar el formulario completo.
                </CardDescription>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 shrink-0">
                <span className="text-amber-400 text-sm font-medium">Pre-Validación</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* ============== Processing Type ============== */}
              <div className="space-y-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h3 className="text-lg font-semibold text-white">
                  Información de Procesamiento
                </h3>
                
                <div className="space-y-2">
                  <Label className="text-gray-300">
                    ¿Dónde se procesará la visa del beneficiario? <span className="text-red-400">*</span>
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('processing_type', 'consular');
                        // Clear USA fields when switching
                        handleChange('foreign_country_residence', '');
                        handleChange('street_address', '');
                        handleChange('apt_suite', '');
                        handleChange('city', '');
                        handleChange('state', '');
                        handleChange('country', '');
                      }}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        answers.processing_type === 'consular'
                          ? 'border-gold-primary bg-gold-primary/10'
                          : 'border-navy-light hover:border-gold-primary/50'
                      }`}
                    >
                      <div className="font-semibold text-white mb-1">Proceso Consular</div>
                      <div className="text-sm text-gray-400">
                        Aplicará para visa en embajada o consulado de EE.UU. en el extranjero
                      </div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('processing_type', 'usa');
                        // Clear consular fields when switching
                        handleChange('consular_city', '');
                        handleChange('consular_country', '');
                      }}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        answers.processing_type === 'usa'
                          ? 'border-gold-primary bg-gold-primary/10'
                          : 'border-navy-light hover:border-gold-primary/50'
                      }`}
                    >
                      <div className="font-semibold text-white mb-1">Dentro de EE.UU.</div>
                      <div className="text-sm text-gray-400">
                        Está en EE.UU. y solicitará ajuste de estatus
                      </div>
                    </button>
                  </div>
                </div>

                {/* Consular Processing Fields */}
                {answers.processing_type === 'consular' && (
                  <div className="space-y-4 mt-4 p-4 bg-navy-light/50 rounded-lg">
                    <p className="text-sm text-amber-400">
                      📍 Indique la ciudad y país donde procesará la visa en el consulado
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-gray-300">
                          1.a Ciudad o Pueblo del Consulado <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          type="text"
                          value={answers.consular_city}
                          onChange={(e) => handleChange('consular_city', e.target.value)}
                          placeholder="Ej: Bogotá, Lima, Ciudad de México"
                          className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                          required={answers.processing_type === 'consular'}
                        />
                      </div>
                      <SearchableSelect
                        label="1.b País del Consulado"
                        value={answers.consular_country}
                        onChange={(val) => handleChange('consular_country', val)}
                        options={COUNTRY_LIST}
                        placeholder="Seleccione un país"
                        searchPlaceholder="Buscar país..."
                        required={answers.processing_type === 'consular'}
                      />
                    </div>
                  </div>
                )}

                {/* USA Processing Fields - Foreign Address */}
                {answers.processing_type === 'usa' && (
                  <div className="space-y-4 mt-4 p-4 bg-navy-light/50 rounded-lg">
                    <p className="text-sm text-amber-400">
                      ⚠️ Importante: Debe proporcionar la dirección de su <strong>última residencia en su país anterior</strong>
                    </p>
                    
                    <SearchableSelect
                      label="2.b Último País de Residencia (antes de llegar a EE.UU.)"
                      value={answers.foreign_country_residence}
                      onChange={(val) => handleChange('foreign_country_residence', val)}
                      options={COUNTRY_LIST}
                      placeholder="Seleccione un país"
                      searchPlaceholder="Buscar país..."
                      required={answers.processing_type === 'usa'}
                    />

                    <h4 className="text-white font-medium pt-2">Dirección de su última residencia en el extranjero (Items 3.a - 3.d, 3.f)</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-gray-300">
                          3.a Calle y Número <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          type="text"
                          value={answers.street_address}
                          onChange={(e) => handleChange('street_address', e.target.value)}
                          placeholder="Street Number and Name"
                          className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                          required={answers.processing_type === 'usa'}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-300">3.b Apartamento/Suite/Piso</Label>
                        <Input
                          type="text"
                          value={answers.apt_suite}
                          onChange={(e) => handleChange('apt_suite', e.target.value)}
                          placeholder="Apt/Ste/Flr (opcional)"
                          className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                        />
                      </div>

                      <SearchableSelect
                        label="3.f País"
                        value={answers.country}
                        onChange={(val) => {
                          handleChange('country', val);
                          handleChange('state', '');
                          handleChange('city', '');
                        }}
                        options={COUNTRY_LIST}
                        placeholder="Seleccione un país"
                        searchPlaceholder="Buscar país..."
                        required={answers.processing_type === 'usa'}
                      />

                      <SearchableSelect
                        label="3.d Estado / Provincia"
                        value={answers.state || answers.province}
                        onChange={(val) => {
                          handleChange('state', val);
                          handleChange('province', val);
                          handleChange('city', '');
                        }}
                        options={answers.country && LATAM_DATA[answers.country] 
                          ? LATAM_DATA[answers.country].states 
                          : []}
                        placeholder={answers.country ? "Seleccione estado/provincia" : "Primero seleccione un país"}
                        searchPlaceholder="Buscar estado/provincia..."
                        required={answers.processing_type === 'usa'}
                        disabled={!answers.country}
                      />

                      <SearchableSelect
                        label="3.c Ciudad"
                        value={answers.city}
                        onChange={(val) => handleChange('city', val)}
                        options={answers.country && LATAM_DATA[answers.country] 
                          ? LATAM_DATA[answers.country].cities 
                          : []}
                        placeholder={answers.country ? "Seleccione una ciudad" : "Primero seleccione un país"}
                        searchPlaceholder="Buscar ciudad..."
                        required={answers.processing_type === 'usa'}
                        disabled={!answers.country}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ============== Beneficiary Information (Part 3) ============== */}
              {/* Only show after processing type is selected */}
              {answers.processing_type && (
                <div className="space-y-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <h3 className="text-lg font-semibold text-white">
                    Información del Beneficiario
                  </h3>
                  <p className="text-sm text-gray-400">
                    Complete la información personal del beneficiario. Esta información se usará para llenar la Parte 1 y Parte 3 del formulario I-140.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1.a Last Name */}
                    <div className="space-y-2">
                      <Label className="text-gray-300">
                        1.a. Apellido <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        type="text"
                        value={answers.beneficiary_last_name}
                        onChange={(e) => handleChange('beneficiary_last_name', e.target.value)}
                        placeholder="Apellido del beneficiario"
                        className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                        required
                      />
                    </div>

                    {/* 1.b First Name */}
                    <div className="space-y-2">
                      <Label className="text-gray-300">
                        1.b. Nombre <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        type="text"
                        value={answers.beneficiary_first_name}
                        onChange={(e) => handleChange('beneficiary_first_name', e.target.value)}
                        placeholder="Nombre del beneficiario"
                        className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                        required
                      />
                    </div>

                    {/* 1.c Middle Name */}
                    <div className="space-y-2">
                      <Label className="text-gray-300">
                        1.c. Segundo Nombre <span className="text-gray-500 text-xs">(opcional)</span>
                      </Label>
                      <Input
                        type="text"
                        value={answers.beneficiary_middle_name}
                        onChange={(e) => handleChange('beneficiary_middle_name', e.target.value)}
                        placeholder="Segundo nombre (si aplica)"
                        className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* 3. Date of Birth */}
                    <div className="space-y-2">
                      <Label className="text-gray-300">
                        3. Fecha de Nacimiento <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={answers.beneficiary_dob}
                        onChange={(e) => handleChange('beneficiary_dob', e.target.value)}
                        className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                        required
                      />
                    </div>

                    {/* 4. City of Birth */}
                    <div className="space-y-2">
                      <Label className="text-gray-300">
                        4. Ciudad / Pueblo de Nacimiento <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        type="text"
                        value={answers.beneficiary_city_of_birth}
                        onChange={(e) => handleChange('beneficiary_city_of_birth', e.target.value)}
                        placeholder="Ej: Bogotá, Lima, Ciudad de México"
                        className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                        required
                      />
                    </div>

                    {/* 5. State/Province of Birth */}
                    <div className="space-y-2">
                      <Label className="text-gray-300">
                        5. Estado o Provincia de Nacimiento <span className="text-gray-500 text-xs">(opcional)</span>
                      </Label>
                      <Input
                        type="text"
                        value={answers.beneficiary_state_of_birth}
                        onChange={(e) => handleChange('beneficiary_state_of_birth', e.target.value)}
                        placeholder="Ej: Cundinamarca, Lima, CDMX"
                        className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                      />
                    </div>

                    {/* 6. Country of Birth */}
                    <SearchableSelect
                      label="6. País de Nacimiento"
                      value={answers.beneficiary_country_of_birth}
                      onChange={(val) => {
                        handleChange('beneficiary_country_of_birth', val);
                        // Auto-fill nationality with same value if empty
                        if (!answers.beneficiary_nationality) {
                          handleChange('beneficiary_nationality', val);
                        }
                      }}
                      options={COUNTRY_LIST}
                      placeholder="Seleccione un país"
                      searchPlaceholder="Buscar país..."
                      required={true}
                    />

                    {/* 7. Country of Citizenship / Nationality */}
                    <SearchableSelect
                      label="7. País de Ciudadanía o Nacionalidad"
                      value={answers.beneficiary_nationality}
                      onChange={(val) => handleChange('beneficiary_nationality', val)}
                      options={COUNTRY_LIST}
                      placeholder="Seleccione un país"
                      searchPlaceholder="Buscar país..."
                      required={true}
                    />
                  </div>
                </div>
              )}

              {/* ============== Other Information Fields ============== */}
              <div className="space-y-4 pt-4 border-t border-navy-light">
                <h3 className="text-lg font-semibold text-white">Información Adicional</h3>
                
                {/* USCIS Account Number - OPTIONAL */}
                <div className="space-y-2">
                  <Label className="text-gray-300">
                    Número de Cuenta USCIS <span className="text-gray-500 text-xs">(opcional)</span>
                  </Label>
                  <Input
                    type="text"
                    value={answers.uscis_account}
                    onChange={(e) => handleChange('uscis_account', e.target.value)}
                    placeholder="Sin guiones (dejar vacío si no aplica)"
                    className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                  />
                  <p className="text-xs text-gray-500">Parte 1 / Other Information, Item 8</p>
                </div>

                {/* SSN - REQUIRED */}
                <div className="space-y-2">
                  <Label className="text-gray-300">
                    Número de Seguro Social (SSN) <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={answers.ssn}
                    onChange={(e) => handleChange('ssn', e.target.value)}
                    placeholder="9 dígitos sin guiones"
                    className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                    maxLength={9}
                    required
                  />
                  <p className="text-xs text-gray-500">Parte 1 / Other Information, Item 7</p>
                </div>

                {/* A-Number - OPTIONAL */}
                <div className="space-y-2">
                  <Label className="text-gray-300">
                    Código A - Alien Registration Number <span className="text-gray-500 text-xs">(opcional)</span>
                  </Label>
                  <Input
                    type="text"
                    value={answers.a_number}
                    onChange={(e) => handleChange('a_number', e.target.value)}
                    placeholder="9 dígitos sin guiones ni A- (dejar vacío si no aplica)"
                    className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                    maxLength={15}
                  />
                  <p className="text-xs text-gray-500">Parte 3, Item 8</p>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label className="text-gray-300">
                    Confirma tu Correo Electrónico <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={answers.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="tu@email.com"
                    className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                    required
                  />
                  <p className="text-xs text-gray-500">Parte 8, Item 5</p>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label className="text-gray-300">
                    Confirma tu Número de Teléfono <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="tel"
                    value={answers.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="Incluye código de país ej: 584247118223"
                    className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                    maxLength={20}
                    required
                  />
                  <p className="text-xs text-gray-500">Parte 8, Items 3 y 4 - Incluye código de país</p>
                </div>
              </div>

              {/* ============== Family Information (Part 7) ============== */}
              <div className="space-y-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Información de Cónyuge e Hijos
                </h3>
                
                {/* Question 1: Does beneficiary have spouse/children? */}
                <div className="space-y-2">
                  <Label className="text-gray-300">
                    ¿El beneficiario tiene cónyuge o hijos que lo acompañarán? <span className="text-red-400">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('has_family', 'yes');
                      }}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        answers.has_family === 'yes'
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-navy-light hover:border-green-500/50'
                      }`}
                    >
                      <div className={`font-semibold ${answers.has_family === 'yes' ? 'text-green-400' : 'text-white'}`}>Sí</div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('has_family', 'no');
                        handleChange('family_count', '');
                        setFamilyMembers([]);
                      }}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        answers.has_family === 'no'
                          ? 'border-gold-primary bg-gold-primary/10'
                          : 'border-navy-light hover:border-gold-primary/50'
                      }`}
                    >
                      <div className="font-semibold text-white">No</div>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Si la respuesta es No, pase a la siguiente sección</p>
                </div>

                {/* Question 2: How many family members? (Only show if has_family === 'yes') */}
                {answers.has_family === 'yes' && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-gray-300">
                      ¿Cuántos familiares acompañarán al beneficiario? <span className="text-red-400">*</span>
                    </Label>
                    <select
                      value={answers.family_count}
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 0;
                        handleChange('family_count', e.target.value);
                        // Create the exact number of family member slots
                        const newMembers = [];
                        for (let i = 0; i < count; i++) {
                          newMembers.push({ ...emptyFamilyMember });
                        }
                        setFamilyMembers(newMembers);
                      }}
                      className="w-full px-3 py-2 rounded-md bg-navy-light border border-navy-light text-white"
                    >
                      <option value="">Seleccione una opción</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                      <option value="6">6</option>
                    </select>
                  </div>
                )}

                {/* Family Members Form - Only show after selecting count */}
                {answers.has_family === 'yes' && answers.family_count && familyMembers.length > 0 && (
                  <div className="space-y-4 mt-4">
                    {familyMembers.map((member, index) => (
                      <div key={index} className="p-4 bg-navy-light/50 rounded-lg space-y-4">
                        <h4 className="text-white font-medium border-b border-navy-light pb-2">
                          Persona {index + 1} {member.relationship && `(${member.relationship})`}
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-gray-300">
                              Apellido <span className="text-red-400">*</span>
                            </Label>
                            <Input
                              type="text"
                              value={member.lastName}
                              onChange={(e) => handleFamilyMemberChange(index, 'lastName', e.target.value)}
                              placeholder="Ej: GARCIA"
                              className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-gray-300">
                              Nombre <span className="text-red-400">*</span>
                            </Label>
                            <Input
                              type="text"
                              value={member.firstName}
                              onChange={(e) => handleFamilyMemberChange(index, 'firstName', e.target.value)}
                              placeholder="Ej: MARIA"
                              className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-gray-300">Segundo Nombre</Label>
                            <Input
                              type="text"
                              value={member.middleName}
                              onChange={(e) => handleFamilyMemberChange(index, 'middleName', e.target.value)}
                              placeholder="Opcional"
                              className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-gray-300">
                              Fecha de Nacimiento <span className="text-red-400">*</span>
                            </Label>
                            <Input
                              type="date"
                              value={member.dateOfBirth}
                              onChange={(e) => handleFamilyMemberChange(index, 'dateOfBirth', e.target.value)}
                              className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
                            />
                          </div>
                          
                          <SearchableSelect
                            label="País de Nacimiento"
                            value={member.countryOfBirth}
                            onChange={(val) => handleFamilyMemberChange(index, 'countryOfBirth', val)}
                            options={COUNTRY_LIST}
                            placeholder="Seleccione país"
                            searchPlaceholder="Buscar..."
                            required={true}
                          />
                          
                          <div className="space-y-2">
                            <Label className="text-gray-300">
                              Relación <span className="text-red-400">*</span>
                            </Label>
                            <select
                              value={member.relationship}
                              onChange={(e) => handleFamilyMemberChange(index, 'relationship', e.target.value)}
                              className="w-full px-3 py-2 rounded-md bg-navy-light border border-navy-light text-white"
                            >
                              <option value="">Seleccione...</option>
                              <option value="Cónyuge">Cónyuge</option>
                              <option value="Hijo/a">Hijo/a</option>
                            </select>
                          </div>
                        </div>
                        
                        {/* Auto-filled fields are hidden from client but still sent with form data */}
                        {/* The values are determined by processing type:
                            - Proceso Consular: Adjustment=No, Visa Abroad=Yes
                            - Dentro de EEUU: Adjustment=No, Visa Abroad=No
                        */}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info Note */}
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  ℹ️ Esta información es para validar antes de diligenciar el formulario, mantente atento a los siguientes pasos.
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gold-primary hover:bg-gold-dark text-navy-primary font-semibold px-8"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Información'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="bg-navy-secondary border-t border-navy-light mt-auto">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500">
            <p>© {new Date().getFullYear()} URPE Immigration Services. Todos los derechos reservados.</p>
            <p>Documento confidencial • No compartir sin autorización</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreValidationFormContent;
