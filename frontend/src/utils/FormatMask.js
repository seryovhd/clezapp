class FormatMask {
  setPhoneFormatMask(phoneToFormat) {
    if (!phoneToFormat || typeof phoneToFormat !== 'string') {
      return null;
    }

    const number = phoneToFormat.replace(/\D/g, "");
    
    if (!number || number.length < 10) {
      return null;
    }

    // DETECCIÓN ESPECIAL PARA REPÚBLICA DOMINICANA
    if (number.startsWith('1') && (number.length === 11)) {
      // Verificar si es código dominicano (809, 829, 849)
      const dominicanAreaCodes = ['809', '829', '849'];
      const areaCode = number.substring(1, 4); // Extraer 809, 829, etc.
      
      if (dominicanAreaCodes.includes(areaCode)) {
        const match = number.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
        if (match) {
          return `+${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
          // Resultado: +1 809 123 4567
        }
      }
    }

    // Resto de tus formatos existentes...
    if (number.length <= 12) {
      const phoneNumberFormatted = number.match(/^(\d{2})(\d{2})(\d{4})(\d{4})$/);
      if (phoneNumberFormatted) {
        return `+${phoneNumberFormatted[1]} (${phoneNumberFormatted[2]}) ${phoneNumberFormatted[3]}-${phoneNumberFormatted[4]}`;
      }
    } else if (number.length === 13) {
      const phoneNumberFormatted = number.match(/^(\d{2})(\d{2})(\d{5})(\d{4})$/);
      if (phoneNumberFormatted) {
        return `+${phoneNumberFormatted[1]} (${phoneNumberFormatted[2]}) ${phoneNumberFormatted[3]}-${phoneNumberFormatted[4]}`;
      }
    }

    return `+${number}`;
  }

  // Versión más completa con soporte internacional
  setPhoneFormatMaskInternational(phoneToFormat) {
    if (!phoneToFormat || typeof phoneToFormat !== 'string') {
      return null;
    }

    const number = phoneToFormat.replace(/\D/g, "");
    
    if (!number || number.length < 8) {
      return null;
    }

    // MAPEO COMPLETO DE FORMATOS
    const countryFormats = {
      // Caribe con código +1
      '1809': 'dominicana', // República Dominicana
      '1829': 'dominicana', 
      '1849': 'dominicana',
      '1876': 'jamaica',    // Jamaica
      '1869': 'stkitts',    // St. Kitts & Nevis
      
      // Latinoamérica
      '55': 'brasil',       // Brasil
      '52': 'mexico',       // México
      '57': 'colombia',     // Colombia
      '54': 'argentina',    // Argentina
      '56': 'chile',        // Chile
      '51': 'peru',         // Perú
      '58': 'venezuela',    // Venezuela
      
      // Norteamérica
      '1': 'norteamerica',  // EEUU/Canadá (genérico)
    };

    // Buscar formato específico (4 dígitos para códigos especiales)
    let formatType = countryFormats[number.substring(0, 4)] || 
                     countryFormats[number.substring(0, 2)] || 
                     countryFormats[number.substring(0, 1)] || 
                     'generic';

    switch (formatType) {
      case 'dominicana':
        const domMatch = number.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
        return domMatch ? `+${domMatch[1]} ${domMatch[2]} ${domMatch[3]} ${domMatch[4]}` : `+${number}`;
      
      case 'brasil':
        if (number.length === 13) {
          const brMatch = number.match(/^(\d{2})(\d{2})(\d{5})(\d{4})$/);
          return brMatch ? `+${brMatch[1]} (${brMatch[2]}) ${brMatch[3]}-${brMatch[4]}` : `+${number}`;
        } else {
          const brMatch = number.match(/^(\d{2})(\d{2})(\d{4})(\d{4})$/);
          return brMatch ? `+${brMatch[1]} (${brMatch[2]}) ${brMatch[3]}-${brMatch[4]}` : `+${number}`;
        }
      
      case 'mexico':
      case 'colombia':
      case 'argentina':
        const latamMatch = number.match(/^(\d{2})(\d{3})(\d{3})(\d{4})$/);
        return latamMatch ? `+${latamMatch[1]} (${latamMatch[2]}) ${latamMatch[3]}-${latamMatch[4]}` : `+${number}`;
      
      case 'norteamerica':
        const usMatch = number.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
        return usMatch ? `+${usMatch[1]} (${usMatch[2]}) ${usMatch[3]}-${usMatch[4]}` : `+${number}`;
      
      default:
        return `+${number}`;
    }
  }

  removeMask(number) {
    if (!number) return '';
    return number.replace(/\D/g, "");
  }

  maskPhonePattern(phoneNumber) {
    if (!phoneNumber) return '+1 (999) 999-9999';
    
    const cleanNumber = this.removeMask(phoneNumber);
    
    // Detectar República Dominicana
    if (cleanNumber.startsWith('1809') || cleanNumber.startsWith('1829') || cleanNumber.startsWith('1849')) {
      return '+1 809 999 9999';
    }
    
    const countryCode = cleanNumber.substring(0, 2);
    
    if (countryCode === '55') {
      return cleanNumber.length < 13 ? '+55 (99) 9999-9999' : '+55 (99) 99999-9999';
    } else if (['52', '57', '54'].includes(countryCode)) {
      return '+52 (999) 999-9999';
    } else if (cleanNumber.startsWith('1')) {
      return '+1 (999) 999-9999';
    } else {
      return '+999 9999-9999';
    }
  }
}

export { FormatMask };