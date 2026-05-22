import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

/**
 * Genera un archivo Excel (.xlsx) estilizado y profesional a partir de un listado de ofertas de empleo.
 * 
 * @param {Array<Object>} jobs Lista de ofertas de empleo obtenidas de la base de datos.
 * @param {string} filePath Ruta absoluta donde se guardará el archivo.
 * @returns {Promise<string>} La ruta del archivo generado.
 */
export async function writeExcelFile(jobs, filePath) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Ofertas de Empleo');

  // 1. Configurar columnas y metadatos base
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Título', key: 'title', width: 35 },
    { header: 'Empresa', key: 'company', width: 25 },
    { header: 'Ubicación', key: 'location', width: 25 },
    { header: 'Modalidad', key: 'modality', width: 14 },
    { header: 'Idioma', key: 'language', width: 10 },
    { header: 'Estado', key: 'status', width: 14 },
    { header: 'Puntuación', key: 'score', width: 14 },
    { header: 'Enlace', key: 'link', width: 40 }
  ];

  // 2. Agregar filas con los datos de las ofertas
  for (const job of jobs) {
    const row = worksheet.addRow({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      modality: job.modality ? String(job.modality).toUpperCase() : '-',
      language: job.language ? String(job.language).toUpperCase() : '-',
      status: getStatusLabel(job.status),
      score: typeof job.score === 'number' ? Math.round(job.score) : 0,
      link: job.link ? { text: 'Ver vacante ↗', hyperlink: job.link } : '-'
    });

    // Dar estilo de hipervínculo a la columna de Enlace
    const linkCell = row.getCell('link');
    if (job.link) {
      linkCell.font = {
        color: { argb: 'FF2563EB' }, // Azul moderno (Tailwind blue-600)
        underline: true
      };
    }
  }

  // 3. Estilos y formatos celda por celda
  const headerRow = worksheet.getRow(1);
  headerRow.height = 26; // Cabecera más alta

  // Estilos de cabecera
  headerRow.eachCell((cell) => {
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' } // Texto blanco
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Fondo Slate-900 (Gris oscuro moderno/premium)
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: false
    };
  });

  // Estilos de las celdas de datos
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, // Slate-200
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Omitir cabecera

    // Zebra striping (filas pares fondo gris muy claro)
    const isEven = rowNumber % 2 === 0;
    const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF'; // Slate-50 / Blanco

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor }
      };

      // Configuración de alineación según el tipo de columna
      const columnKey = worksheet.columns[colNumber - 1].key;
      const centeredKeys = ['id', 'modality', 'language', 'status', 'score', 'link'];
      
      cell.alignment = {
        vertical: 'middle',
        horizontal: centeredKeys.includes(columnKey) ? 'center' : 'left',
        wrapText: true // Evita que la información se corte
      };

      // Formato para la puntuación (número entero)
      if (columnKey === 'score') {
        cell.numFmt = '#,##0';
      }
      if (columnKey === 'id') {
        cell.numFmt = '0';
      }
    });
  });

  // 4. Auto-ajustar el ancho de las columnas según su contenido
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) {
        maxLength = Math.max(maxLength, String(cell.value || '').length);
        return;
      }
      
      let valString = '';
      if (cell.value && typeof cell.value === 'object' && cell.value.text) {
        valString = String(cell.value.text);
      } else if (cell.value != null) {
        valString = String(cell.value);
      }
      
      // Si la celda tiene saltos de línea (wrapText), medimos la línea más larga
      const lines = valString.split('\n');
      for (const line of lines) {
        if (line.length > maxLength) {
          maxLength = line.length;
        }
      }
    });

    // Añadir margen y limitar anchos máximos/mínimos para que luzca ordenado
    const calculatedWidth = maxLength + 4;
    
    if (column.key === 'id') {
      column.width = Math.max(8, calculatedWidth);
    } else if (column.key === 'link') {
      column.width = 16; // El enlace dice "Ver vacante ↗" por lo que no requiere tanto ancho
    } else if (['title', 'company', 'location'].includes(column.key)) {
      column.width = Math.min(50, Math.max(22, calculatedWidth)); // Ancho razonable para texto
    } else {
      column.width = Math.min(25, Math.max(12, calculatedWidth));
    }
  });

  // 4.5 Ajustar la altura de las filas dinámicamente según la cantidad de líneas estimadas por celda
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Cabecera ya tiene altura fija de 26

    let maxLines = 1;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const col = worksheet.columns[colNumber - 1];
      
      let valString = '';
      if (cell.value && typeof cell.value === 'object' && cell.value.text) {
        valString = String(cell.value.text);
      } else if (cell.value != null) {
        valString = String(cell.value);
      }

      const colWidth = col.width || 15;
      
      // Contar saltos de línea explícitos e implícitos por el wrapText
      const explicitLines = valString.split('\n');
      let cellLinesCount = 0;
      
      for (const line of explicitLines) {
        // Estimar caracteres por línea según el ancho (colWidth - 2)
        const charsPerLine = Math.max(10, colWidth - 2);
        cellLinesCount += Math.ceil(line.length / charsPerLine) || 1;
      }
      
      if (cellLinesCount > maxLines) {
        maxLines = cellLinesCount;
      }
    });

    // Cada línea de texto requiere unos 15 puntos de altura, mínimo 22 para que se lea holgado
    row.height = Math.max(22, maxLines * 15);
  });

  // 5. Congelar fila superior
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2', selectTo: 'A2' }
  ];

  // 6. Activar autofiltros
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columns.length }
  };

  // Asegurar que exista la carpeta de exportación
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Guardar el archivo
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

/**
 * Traduce el estado interno a una etiqueta amigable en español.
 */
function getStatusLabel(status) {
  switch (status) {
    case 'new':
      return 'NUEVO';
    case 'reviewing':
      return 'EN REVISIÓN';
    case 'applied':
      return 'POSTULADO';
    case 'ignored':
      return 'DESCARTADO';
    default:
      return String(status || '').toUpperCase();
  }
}
