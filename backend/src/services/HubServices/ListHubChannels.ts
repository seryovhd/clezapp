import { showHubToken } from "../../helpers/showHubToken";
const { Client } = require("notificamehubsdk");
require("dotenv").config();

const ListChannels = async (companyId: number) => {
  try {
    // Obtención del token
    const notificameHubToken = await showHubToken(companyId);

    if (!notificameHubToken) {
      throw new Error("NOTIFICAMEHUB_TOKEN_NOT_FOUND");
    }

    // Inicialización del cliente con el token obtenido
    const client = new Client(notificameHubToken);

    // Solicitud para listar canales
    const response = await client.listChannels();

    // Validación de la respuesta
    if (!response || !Array.isArray(response)) {
      throw new Error("INVALID_RESPONSE_FORMAT");
    }

    // console.log("📬 RESPUESTA::: ", response); // HUB DEPURACIÓN
    return response;
  } catch (error: any) {
    // Manejo de errores con más detalles
    console.error("❌ ERROR AL LISTAR LOS CANALES:", error.message || error);
    throw new Error(`Error al obtener los canales: ${error.message || error}`);
  }
};

export default ListChannels;
