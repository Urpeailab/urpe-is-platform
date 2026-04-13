/**
 * Utility functions for exporting data to CSV and Excel formats
 */

/**
 * Convert array of objects to CSV string
 */
export const convertToCSV = (data, columns = null) => {
  if (!data || data.length === 0) {
    return '';
  }

  // Use provided columns or extract from first object
  const headers = columns || Object.keys(data[0]);
  
  // Create header row
  const headerRow = headers.join(',');
  
  // Create data rows
  const dataRows = data.map(item => {
    return headers.map(header => {
      const value = item[header];
      // Handle values that contain commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
};

/**
 * Download CSV file
 */
export const downloadCSV = (data, filename = 'export.csv', columns = null) => {
  const csv = convertToCSV(data, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    
    // Safely remove link with validation to prevent NotFoundError
    if (link.parentNode === document.body) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }
};

/**
 * Convert data to Excel-compatible format and download
 * Uses HTML table approach for better compatibility
 */
export const downloadExcel = (data, filename = 'export.xlsx', sheetName = 'Data') => {
  if (!data || data.length === 0) {
    return;
  }

  const headers = Object.keys(data[0]);
  
  // Create HTML table
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">';
  html += '<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>';
  html += `<x:ExcelWorksheet><x:Name>${sheetName}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>`;
  html += '</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>';
  html += '<table border="1">';
  
  // Header row
  html += '<thead><tr>';
  headers.forEach(header => {
    html += `<th style="background-color: #eab308; color: black; font-weight: bold; padding: 8px;">${header}</th>`;
  });
  html += '</tr></thead>';
  
  // Data rows
  html += '<tbody>';
  data.forEach(item => {
    html += '<tr>';
    headers.forEach(header => {
      const value = item[header] || '';
      html += `<td style="padding: 6px;">${value}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></body></html>';
  
  // Create blob and download
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    
    // Safely remove link with validation to prevent NotFoundError
    if (link.parentNode === document.body) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }
};

/**
 * Export users data
 */
export const exportUsers = (users, format = 'csv') => {
  const exportData = users.map(user => ({
    'ID': user.id || user._id,
    'Nombre': user.name || '',
    'Email': user.email || '',
    'Teléfono': user.phone || '',
    'Estado': user.userState || '',
    'Profesión': user.profession || '',
    'País': user.country || '',
    'Fecha de Registro': user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '',
    'Asesor Asignado': user.assignedAdvisor?.name || 'Sin asignar'
  }));
  
  const filename = `usuarios_${new Date().toISOString().split('T')[0]}`;
  
  if (format === 'excel') {
    downloadExcel(exportData, `${filename}.xlsx`, 'Usuarios');
  } else {
    downloadCSV(exportData, `${filename}.csv`);
  }
};


/**
 * Export staff data
 */
export const exportStaff = (staff, format = 'csv') => {
  const exportData = staff.map(member => ({
    'ID': member._id || member.id || '',
    'Nombre': member.name || '',
    'Email': member.email || '',
    'Teléfono': member.phone || '',
    'Rol': member.role || '',
    'Departamento': member.department || '',
    'LinkedIn': member.linkedin || '',
    'Estado': member.status || '',
    'Fecha de Creación': member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '',
    'Último Login': member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : ''
  }));
  
  const filename = `personal_${new Date().toISOString().split('T')[0]}`;
  
  if (format === 'excel') {
    downloadExcel(exportData, `${filename}.xlsx`, 'Personal');
  } else {
    downloadCSV(exportData, `${filename}.csv`);
  }
};


/**
 * Export audit logs
 */
export const exportAuditLogs = (logs, format = 'csv') => {
  const exportData = logs.map(log => ({
    'ID': log.id,
    'Acción': log.action,
    'Recurso': log.resource,
    'ID Recurso': log.resourceId || '',
    'Staff': log.staffName,
    'Email Staff': log.staffEmail,
    'Descripción': log.description,
    'IP Address': log.ipAddress,
    'Fecha y Hora': new Date(log.timestamp).toLocaleString(),
    'Metadata': JSON.stringify(log.metadata || {})
  }));
  
  const filename = `audit_logs_${new Date().toISOString().split('T')[0]}`;
  
  if (format === 'excel') {
    downloadExcel(exportData, `${filename}.xlsx`, 'Audit Logs');
  } else {
    downloadCSV(exportData, `${filename}.csv`);
  }
};

/**
 * Export dashboard statistics
 */
export const exportDashboardStats = (stats, format = 'csv') => {
  const exportData = [
    {
      'Métrica': 'Total Usuarios',
      'Valor': stats?.users?.total || 0,
      'Activos': stats?.users?.active || 0
    },
    {
      'Métrica': 'Staff',
      'Valor': stats?.staff?.total || 0,
      'Activos': stats?.staff?.active || 0
    },
    {
      'Métrica': 'Webinars',
      'Valor': stats?.webinars?.total || 0,
      'Activos': '-'
    },
    {
      'Métrica': 'Actividad (24h)',
      'Valor': stats?.activity?.last24h || 0,
      'Activos': '-'
    }
  ];
  
  const filename = `dashboard_stats_${new Date().toISOString().split('T')[0]}`;
  
  if (format === 'excel') {
    downloadExcel(exportData, `${filename}.xlsx`, 'Estadísticas');
  } else {
    downloadCSV(exportData, `${filename}.csv`);
  }
};
