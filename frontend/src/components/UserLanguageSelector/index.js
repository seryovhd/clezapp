import React, { useContext, useState } from "react";
import { IconButton, Menu, MenuItem, Box } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import LanguageIcon from "@material-ui/icons/Language";

// Objeto con los datos de cada idioma
const languageData = {
  "pt-BR": { name: "Português (BR)" },
  "en": { name: "English" },
  "es": { name: "Español" },
  "fr": { name: "Frances" }
};

const UserLanguageSelector = ({ iconOnly = false }) => {
  const [languageMenuAnchorEl, setLanguageMenuAnchorEl] = useState(null);
  const { user } = useContext(AuthContext);

  const handleOpenLanguageMenu = (event) => {
    setLanguageMenuAnchorEl(event.currentTarget);
  };

  const handleCloseLanguageMenu = () => {
    setLanguageMenuAnchorEl(null);
  };

  const handleChangeLanguage = async (language) => {
    try {
      await i18n.changeLanguage(language);
      localStorage.setItem("language", language);
    } catch (error) {
      console.error("Error al cambiar idioma:", error);
    }
    handleCloseLanguageMenu();
    window.location.reload(false);
  };

  const currentLanguage = user?.language || i18n.language || "es";

  return (
    <>
      <MenuItem onClick={handleOpenLanguageMenu}>
        <LanguageIcon style={{ marginRight: 8 }} />
        Idioma
      </MenuItem>

      <Menu
        anchorEl={languageMenuAnchorEl}
        keepMounted
        open={Boolean(languageMenuAnchorEl)}
        onClose={handleCloseLanguageMenu}
      >
        {Object.entries(languageData).map(([code, { name }]) => (
          <MenuItem
            key={code}
            onClick={() => handleChangeLanguage(code)}
            selected={currentLanguage === code}
          >
            {name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default UserLanguageSelector;
