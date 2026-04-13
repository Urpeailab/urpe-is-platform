# 🔐 Flujo de Autenticación en URPE

## Resumen Ejecutivo

Cuando un usuario hace login en URPE, sus datos se almacenan en **dos lugares principales**:

1. **MongoDB** (Base de datos permanente) - Guarda todos los datos del usuario
2. **localStorage del navegador** - Guarda temporalmente la sesión activa

---

## 📊 Diagrama del Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    USUARIO HACE LOGIN                            │
│                  (email + password)                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND - AuthContext.js                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  1. signIn(email, password)                               │   │
│  │  2. axios.post('/api/auth/signin', {email, password})     │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND - server.py                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  1. Busca usuario en MongoDB:                             │   │
│  │     await db.users.find_one({"email": email})             │   │
│  │                                                            │   │
│  │  2. Verifica password (hashed con bcrypt):                │   │
│  │     pwd_context.verify(password, user_doc['password'])    │   │
│  │                                                            │   │
│  │  3. Genera JWT Token:                                     │   │
│  │     - Incluye: id, email, name, userState, type           │   │
│  │     - Expiración: 24 horas                                │   │
│  │     - Algoritmo: HS256                                    │   │
│  │                                                            │   │
│  │  4. Retorna datos del usuario + token                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│         RESPUESTA DEL BACKEND (Ejemplo)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  {                                                         │   │
│  │    "id": "691865d0f10dfde8e712f0de",                      │   │
│  │    "email": "cliente-test@urpe.com",                      │   │
│  │    "name": "Cliente Test",                                │   │
│  │    "phone": "+52123456789",                               │   │
│  │    "userState": "U1",                                     │   │
│  │    "language": "es",                                      │   │
│  │    "createdAt": "2025-01-15T10:30:00Z",                   │   │
│  │    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."    │   │
│  │  }                                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│         FRONTEND - Guarda en localStorage                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  localStorage.setItem('urpe_user', JSON.stringify({       │   │
│  │    id: "691865d0f10dfde8e712f0de",                        │   │
│  │    email: "cliente-test@urpe.com",                        │   │
│  │    name: "Cliente Test",                                  │   │
│  │    phone: "+52123456789",                                 │   │
│  │    userState: "U1",                                       │   │
│  │    language: "es",                                        │   │
│  │    token: "eyJhbGciOiJIUzI1NiI..."                        │   │
│  │  }))                                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              USUARIO AUTENTICADO                                 │
│         Puede acceder al dashboard y features                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📍 1. Dónde se Guarda la Data del Login

### A) Base de Datos MongoDB (Permanente)

**Ubicación**: Colección `users` en MongoDB
**Servidor**: Según configuración en `.env` (MONGO_URL)

**Estructura de un usuario en MongoDB**:
```javascript
{
  "_id": ObjectId("691865d0f10dfde8e712f0de"),
  "email": "cliente-test@urpe.com",
  "name": "Cliente Test",
  "phone": "+52123456789",
  "password": "$2b$12$abcdef...",  // Hash bcrypt
  "userState": "U1",  // U1 = Visitante, U3 = Registrado
  "language": "es",
  "eligible": false,
  "report": null,
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

**Campos importantes**:
- `_id`: ID único de MongoDB
- `email`: Email del usuario (único)
- `password`: Password hasheado con bcrypt (NUNCA se guarda en texto plano)
- `userState`: Estado del usuario (U1, U3, etc.)
- `eligible`: Si completó el test de elegibilidad
- `report`: Datos del reporte de elegibilidad

### B) localStorage del Navegador (Temporal)

**Ubicación**: `localStorage` del navegador del usuario
**Clave**: `'urpe_user'`

**Estructura guardada en localStorage**:
```javascript
{
  "id": "691865d0f10dfde8e712f0de",
  "email": "cliente-test@urpe.com",
  "name": "Cliente Test",
  "phone": "+52123456789",
  "userState": "U1",
  "language": "es",
  "createdAt": "2025-01-15T10:30:00Z",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MTg2NWQwZjEwZGZkZThlNzEyZjBkZSIsImVtYWlsIjoiY2xpZW50ZS10ZXN0QHVycGUuY29tIiwibmFtZSI6IkNsaWVudGUgVGVzdCIsInVzZXJTdGF0ZSI6IlUxIiwidHlwZSI6InVzZXIiLCJleHAiOjE3MDU0MDc2MDAsImlhdCI6MTcwNTMyMTIwMH0.abc123def456..."
}
```

**Nota Importante**: El password NUNCA se guarda en localStorage, solo el token JWT.

---

## 🔄 2. Flujo Paso a Paso

### Paso 1: Usuario envía credenciales

**Frontend** (`SignIn.js` o modal de login):
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  const result = await signIn(email, password);
  if (result.success) {
    navigate('/dashboard');
  }
};
```

### Paso 2: AuthContext hace la petición

**Frontend** (`/app/frontend/src/contexts/AuthContext.js`):
```javascript
const signIn = async (email, password) => {
  try {
    // POST a /api/auth/signin
    const response = await axios.post(`${API}/auth/signin`, { 
      email, 
      password 
    });
    
    const userData = response.data;
    
    // Guarda en estado de React
    setUser(userData);
    
    // Guarda en localStorage
    localStorage.setItem('urpe_user', JSON.stringify(userData));
    
    return { success: true, data: userData };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.detail || 'Sign in failed' 
    };
  }
};
```

### Paso 3: Backend procesa el login

**Backend** (`/app/backend/server.py`):
```python
@api_router.post("/auth/signin")
async def signin(credentials: UserSignIn):
    # 1. Busca usuario en MongoDB
    user_doc = await db.users.find_one({"email": credentials.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # 2. Verifica password (bcrypt)
    if not pwd_context.verify(credentials.password, user_doc.get('password', '')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # 3. Genera JWT token
    payload = {
        'id': str(user_doc['_id']),
        'email': user_doc['email'],
        'name': user_doc['name'],
        'userState': user_doc.get('userState', 'U1'),
        'type': 'user',
        'exp': datetime.utcnow() + timedelta(hours=24),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    
    # 4. Retorna datos sin password
    return {
        'id': str(user_doc['_id']),
        'email': user_doc['email'],
        'name': user_doc['name'],
        'phone': user_doc.get('phone', ''),
        'userState': user_doc.get('userState', 'U1'),
        'language': user_doc.get('language', 'en'),
        'token': token
    }
```

### Paso 4: Frontend guarda la sesión

**Frontend** (`AuthContext.js`):
```javascript
// Guarda en memoria (estado de React)
setUser(userData);

// Guarda en localStorage (persiste al refrescar)
localStorage.setItem('urpe_user', JSON.stringify(userData));
```

### Paso 5: Al refrescar la página

**Frontend** (`AuthContext.js` - useEffect):
```javascript
useEffect(() => {
  // Recupera sesión guardada
  const savedUser = localStorage.getItem('urpe_user');
  if (savedUser) {
    setUser(JSON.parse(savedUser));
  }
  setLoading(false);
}, []);
```

---

## 🔒 3. Seguridad

### A) Password Hashing

**Tecnología**: bcrypt
**Ubicación**: Backend (`server.py`)

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Al crear usuario:
hashed_password = pwd_context.hash(password)

# Al verificar login:
is_valid = pwd_context.verify(password_ingresado, password_hasheado_en_db)
```

**Ejemplo de password hasheado**:
```
Original: "test123"
Hasheado: "$2b$12$KIXx7ZqN5Y4Qy.x5x5x5xeOGZqN5Y4Qy.x5x5x5xeOGZqN5Y4Qy.x5"
```

### B) JWT (JSON Web Token)

**Ubicación**: Backend genera, Frontend guarda

**Estructura del JWT**:
```javascript
// Header
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload (datos del usuario)
{
  "id": "691865d0f10dfde8e712f0de",
  "email": "cliente-test@urpe.com",
  "name": "Cliente Test",
  "userState": "U1",
  "type": "user",
  "exp": 1705407600,  // Expira en 24h
  "iat": 1705321200   // Creado en...
}

// Signature (firmado con JWT_SECRET)
```

**Uso del Token**:
```javascript
// Frontend envía el token en cada request
axios.get('/api/client/my-case', {
  headers: {
    'Authorization': `Bearer ${user.token}`
  }
});

// Backend verifica el token
def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    return payload
```

---

## 🎯 4. Estados de Usuario (userState)

```
┌──────────────────────────────────────────────────────┐
│  U1 (Visitante)                                       │
│  - Completó test de elegibilidad                     │
│  - No tiene cuenta registrada                        │
│  - Ve dashboard limitado                             │
│  - Ve opción "Formularios Gratuitos"                 │
└────────────────┬─────────────────────────────────────┘
                 │ REGISTRO (email + password)
                 ▼
┌──────────────────────────────────────────────────────┐
│  U3 (Registrado)                                      │
│  - Cuenta completa con email/password                │
│  - Acceso completo al dashboard                      │
│  - Puede gestionar documentos                        │
│  - Puede ver su caso de visa                         │
└──────────────────────────────────────────────────────┘
```

---

## 📱 5. Cómo Acceder a los Datos del Usuario

### A) En Componentes de React

```javascript
import { useAuth } from '../contexts/AuthContext';

function MiComponente() {
  const { user } = useAuth();
  
  // Acceder a datos
  console.log(user.email);      // "cliente-test@urpe.com"
  console.log(user.name);       // "Cliente Test"
  console.log(user.userState);  // "U1" o "U3"
  console.log(user.token);      // JWT token
  
  // Verificar si está autenticado
  if (!user) {
    return <Navigate to="/signin" />;
  }
  
  return <div>Hola, {user.name}!</div>;
}
```

### B) Directamente desde localStorage

```javascript
// Obtener usuario guardado
const savedUser = localStorage.getItem('urpe_user');
const user = JSON.parse(savedUser);

console.log(user.email);
console.log(user.token);
```

### C) En el Backend (desde JWT)

```python
from fastapi import Depends
from jose import jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('id')
        
        # Buscar usuario actualizado en BD
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## 🚪 6. Cerrar Sesión (Logout)

**Frontend** (`AuthContext.js`):
```javascript
const signOut = () => {
  // Limpia estado de React
  setUser(null);
  
  // Limpia localStorage
  localStorage.removeItem('urpe_user');
  
  // Opcional: redirigir al login
  // navigate('/signin');
};
```

**Uso en componente**:
```javascript
const { signOut } = useAuth();

const handleLogout = () => {
  signOut();
  navigate('/');
};
```

---

## 🔍 7. Verificar Sesión Actual

### Desde DevTools del Navegador

1. Abre DevTools (F12)
2. Ve a la pestaña "Application" o "Almacenamiento"
3. Busca "Local Storage" → `http://localhost:3000`
4. Encuentra la clave `urpe_user`
5. Verás el JSON completo con todos los datos

### Desde Console del Navegador

```javascript
// Ver usuario actual
const user = JSON.parse(localStorage.getItem('urpe_user'));
console.log(user);

// Ver solo el token
console.log(user.token);

// Verificar estado
console.log(user.userState); // "U1" o "U3"
```

---

## 🔧 8. Archivos Clave

```
📁 URPE Application
│
├── 📁 backend/
│   ├── server.py                 ← Endpoints de auth (signin, signup)
│   └── .env                      ← JWT_SECRET, JWT_ALGORITHM
│
├── 📁 frontend/
│   ├── src/
│   │   ├── contexts/
│   │   │   └── AuthContext.js   ← Gestión de autenticación
│   │   ├── pages/
│   │   │   ├── SignIn.js        ← Página de login
│   │   │   └── SignUp.js        ← Página de registro
│   │   └── components/
│   │       └── RegisterModal.js  ← Modal de registro (U1 → U3)
│   └── .env                      ← REACT_APP_BACKEND_URL
│
└── 📁 mongodb/
    └── users collection          ← Base de datos de usuarios
```

---

## 🎓 Resumen Final

1. **Login**: Usuario envía email + password → Backend verifica → Genera JWT → Retorna datos + token
2. **Almacenamiento MongoDB**: Datos permanentes del usuario (email, password hasheado, userState, etc.)
3. **Almacenamiento localStorage**: Sesión temporal (datos del usuario + JWT token)
4. **JWT Token**: Se usa para autenticar todas las peticiones al backend
5. **Seguridad**: Password hasheado con bcrypt, token firmado con JWT
6. **Persistencia**: Al refrescar página, AuthContext recupera datos de localStorage
7. **Logout**: Limpia estado de React y localStorage

---

## 🆘 Problemas Comunes

### "Token inválido" o "Unauthorized"
- El token expiró (24h de duración)
- El JWT_SECRET cambió en el backend
- **Solución**: Hacer logout y login de nuevo

### "Usuario no encontrado"
- Email incorrecto
- Usuario no existe en MongoDB
- **Solución**: Verificar email o crear cuenta

### "Sesión perdida al refrescar"
- localStorage bloqueado o limpiado
- Navegación privada/incógnito
- **Solución**: Verificar configuración del navegador

### "No puedo acceder al dashboard"
- Token no se está enviando en headers
- userState incorrecto
- **Solución**: Verificar que `user.token` existe y se envía en requests
