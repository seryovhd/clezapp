import Setting from "../models/Setting";

export const showHubToken = async (companyId: number): Promise<string> => {
  const notificameHubToken = await Setting.findOne({
    where: {
      key: "hubToken",
      companyId: companyId
    }
  });

  if (!notificameHubToken) {
    throw new Error(`ERROR: TOKEN NO ENCONTRADO PARA companyId ${companyId}`);
  }

  // console.log("TOKEN ENCONTRADO:: ", notificameHubToken.value);  // HUB DEPURACIÓN
  return notificameHubToken.value;
};
