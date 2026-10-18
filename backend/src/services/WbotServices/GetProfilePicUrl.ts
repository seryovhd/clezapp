import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import EvolutionApiService from "../EvolutionApiServices/EvolutionApiService";

const GetProfilePicUrl = async (
  number: string,
  companyId: number
): Promise<string> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  if (!defaultWhatsapp) {
    return `${process.env.FRONTEND_URL}/nopicture.png`;
  }

  if (
    defaultWhatsapp.connectionType === "evolution" ||
    defaultWhatsapp.type === "evolution"
  ) {
    return await EvolutionApiService.getProfilePictureUrl(defaultWhatsapp, number);
  }

  const wbot = getWbot(defaultWhatsapp.id);

  if (!wbot) {
    return `${process.env.FRONTEND_URL}/nopicture.png`;
  }

  let profilePicUrl: string;
  try {
    profilePicUrl = await wbot.profilePictureUrl(`${number}@s.whatsapp.net`, "image");
  } catch (error) {
    try {
      profilePicUrl = await wbot.profilePictureUrl(`${number}@s.whatsapp.net`, "preview");
    } catch {
      profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
    }
  }

  return profilePicUrl;
};

export default GetProfilePicUrl;
