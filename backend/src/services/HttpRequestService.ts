// HTTP Request functionality has been removed from flows
// This service is no longer used

/*
import { logger } from "../utils/logger";

interface HttpRequestConfig {
  url: string;
  method: string;
  headers: Array<{ key: string; value: string }>;
  body?: string;
  useVariables?: boolean;
  saveResponseTo?: string;
}

interface HttpRequestResponse {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
}

export const executeHttpRequest = async (
  config: HttpRequestConfig,
  variables: Record<string, any> = {}
): Promise<HttpRequestResponse> => {
  const {
    url,
    method = 'GET',
    headers = [],
    body,
    useVariables = true
  } = config;

  let finalUrl = url;
  let finalBody = body;

  if (useVariables) {
    // ✅ CORRECCIÓN MEJORADA: Reemplazar variables con manejo de objetos anidados
    const getNestedValue = (obj: any, path: string) => {
      try {
        const keys = path.split('.').filter(Boolean);
        let value = obj;

        for (const k of keys) {
          if (value === undefined || value === null) break;

          // Si el valor actual es un string que parece JSON, intentar parsearlo
          if (typeof value === 'string' && value.trim().startsWith('{') && value.trim().endsWith('}')) {
            try {
              value = JSON.parse(value);
              console.log(`🔄 Parseando string como JSON para ${k}`);
            } catch {
              // Si no se puede parsear, mantener como string
            }
          }

          value = value[k];
        }

        return value;
      } catch (error) {
        console.log(`❌ Error accediendo a ${path}:`, error.message);
        return undefined;
      }
    };

    finalUrl = finalUrl.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const variableValue = getNestedValue(variables, key.trim());
      console.log(`🔁 Reemplazando variable en URL {{${key}}} ->`, variableValue);
      return variableValue !== undefined ? String(variableValue) : "";
    });

    if (finalBody && method !== 'GET') {
      finalBody = finalBody.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const variableValue = getNestedValue(variables, key.trim());
        console.log(`🔁 Reemplazando variable en body {{${key}}} ->`, variableValue);
        return variableValue !== undefined ? String(variableValue) : "";
      });
    }
  }

  console.log("🔧 Request final preparado:", {
    url: finalUrl,
    method,
    headersCount: headers.length,
    hasBody: !!finalBody,
    finalBody: finalBody ? finalBody.substring(0, 200) + '...' : 'No body'
  });

  const headersObj: Record<string, string> = {};
  headers.forEach((header: any) => {
    if (header.key && header.value) {
      let headerValue = header.value;

      if (useVariables) {
        headerValue = headerValue.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
          const getNestedValue = (obj: any, path: string) => {
            try {
              const keys = path.split('.').filter(Boolean);
              let value = obj;

              for (const k of keys) {
                if (value === undefined || value === null) break;

                if (typeof value === 'string' && value.trim().startsWith('{') && value.trim().endsWith('}')) {
                  try {
                    value = JSON.parse(value);
                  } catch {
                    // Mantener como string si no se puede parsear
                  }
                }

                value = value[k];
              }

              return value;
            } catch (error) {
              return undefined;
            }
          };

          const variableValue = getNestedValue(variables, key.trim());
          // ✅ CORRECCIÓN: También en headers usar string vacío
          return variableValue !== undefined ? String(variableValue) : "";
        });
      }

      headersObj[header.key] = headerValue;
    }
  });

  const options: any = {
    method: method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      ...headersObj
    },
    timeout: 30000
  };

  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && finalBody) {
    try {
      // ✅ VERIFICAR SI EL BODY ES JSON VÁLIDO después del reemplazo
      JSON.parse(finalBody);
      options.body = finalBody;
    } catch (error: any) {
      console.error('❌ Body JSON inválido después del reemplazo:', finalBody);
      console.log('💡 Esto puede pasar si las variables crean JSON inválido');

      // ✅ INTENTAR CORREGIR EL JSON si es posible
      try {
        // Intentar escapar comillas y hacer el JSON válido
        const correctedBody = finalBody
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');

        JSON.parse(correctedBody);
        options.body = correctedBody;
        console.log('✅ Body corregido y parseado correctamente');
      } catch (correctError) {
        // Si no se puede corregir, enviar como texto plano
        console.log('⚠️ Enviando body como texto plano');
        options.headers['Content-Type'] = 'text/plain';
        options.body = finalBody;
      }
    }
  }

  console.log("🚀 Enviando HTTP Request...");
  console.log("📤 URL:", finalUrl);
  console.log("🔧 Options:", {
    method: options.method,
    headers: options.headers,
    hasBody: !!options.body
  });

  try {
    const response = await fetch(finalUrl, options);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    let data;

    try {
      // SOLUCIÓN SIMPLE: Siempre obtener el texto primero y luego intentar parsear como JSON
      const responseText = await response.text();
      console.log("📥 Respuesta recibida:", responseText);
      // Intentar parsear como JSON
      try {
        data = JSON.parse(responseText);
        console.log("✅ Respuesta parseada como JSON correctamente");
      } catch (parseError) {
        // Si falla el parseo JSON, usar el texto original
        console.log('⚠️ No se pudo parsear como JSON, usando texto');
        data = responseText;
      }
    } catch (error: any) {
      // Fallback seguro
      throw new Error(`Error reading response: ${error.message}`);
    }

    console.log("📊 Tipo de data recibida:", typeof data);
    console.log("📊 Es array?:", Array.isArray(data));
    if (Array.isArray(data)) {
      console.log("📊 Primer elemento:", JSON.stringify(data[0]).substring(0, 200));
    }

    console.log("✅ Request exitoso:", {
      status: response.status,
      dataSize: typeof data === 'string' ? data.length : JSON.stringify(data).length
    });

    return {
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    console.error('❌ Error en HTTP Request:', error);
    throw error;
  }
};

export const testHttpRequest = async (config: HttpRequestConfig, variables: any = {}) => {
  try {
    const result = await executeHttpRequest(config, variables);
    return {
      success: true,
      data: result
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
};
*/