import React, { useState, useEffect } from "react";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from 'react-toastify';
import { QueryClient, QueryClientProvider } from "react-query";
import { esES } from "@material-ui/core/locale";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
import { useMediaQuery } from "@material-ui/core";
import ColorModeContext from "./layout/themeContext";
import { SocketContext, SocketManager } from './context/Socket/SocketContext';
import NotificationHandler from './components/NotificationHandler/NotificationHandler';
import Routes from "./routes";

const queryClient = new QueryClient();

const App = () => {
    const [locale, setLocale] = useState();

    const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
    const preferredTheme = window.localStorage.getItem("preferredTheme");
    const [mode, setMode] = useState(preferredTheme ? preferredTheme : prefersDarkMode ? "dark" : "light");

    const colorMode = React.useMemo(
        () => ({
            toggleColorMode: () => {
                setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
            },
        }),
        []
    );

    const theme = createTheme(
        {
            overrides: {
                MuiCssBaseline: {
                    "@global": {
                        body: {
                            backgroundColor: mode === "light" ? "#f0f2f5" : "#0b141a",
                            color: mode === "light" ? "#111b21" : "#e9edef",
                            transition: "background-color 0.2s ease, color 0.2s ease",
                        },
                    },
                },
                MuiTypography: {
                    root: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                    },
                    colorTextPrimary: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                    },
                    colorTextSecondary: {
                        color: mode === "light" ? "#667781" : "#8696a0",
                    },
                },
                MuiTableCell: {
                    root: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                        borderBottom: mode === "light" ? "1px solid #e9edef" : "1px solid #222d34",
                    },
                    head: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                        fontWeight: 600,
                        backgroundColor: mode === "light" ? "#f0f2f5" : "#111b21",
                    },
                },
                MuiInputBase: {
                    root: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                    },
                    input: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                        "&::placeholder": {
                            color: mode === "light" ? "#8696a0" : "#8696a0",
                            opacity: 0.8,
                        },
                    },
                },
                MuiFormLabel: {
                    root: {
                        color: mode === "light" ? "#54656f" : "#8696a0",
                        "&$focused": {
                            color: "#00a884",
                        },
                    },
                },
                MuiInputLabel: {
                    root: {
                        color: mode === "light" ? "#54656f" : "#8696a0",
                        "&$focused": {
                            color: "#00a884",
                        },
                    },
                },
                MuiListItemIcon: {
                    root: {
                        color: mode === "light" ? "#54656f" : "#aebac1",
                    },
                },
                MuiListSubheader: {
                    root: {
                        color: mode === "light" ? "#54656f" : "#8696a0",
                    },
                },
                MuiListItemText: {
                    primary: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                    },
                    secondary: {
                        color: mode === "light" ? "#667781" : "#8696a0",
                    },
                },
                MuiIconButton: {
                    root: {
                        color: mode === "light" ? "#54656f" : "#aebac1",
                    },
                },
                MuiSelect: {
                    icon: {
                        color: mode === "light" ? "#54656f" : "#aebac1",
                    },
                    select: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                    },
                },
                MuiTab: {
                    root: {
                        color: mode === "light" ? "#54656f" : "#aebac1",
                        "&$selected": {
                            color: mode === "light" ? "#008069" : "#00a884",
                        },
                    },
                },
                MuiPaper: {
                    root: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                    },
                },
                MuiCardHeader: {
                    title: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                    },
                    subheader: {
                        color: mode === "light" ? "#667781" : "#8696a0",
                    },
                },
                MuiDialogTitle: {
                    root: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                    },
                },
                MuiDialogContentText: {
                    root: {
                        color: mode === "light" ? "#667781" : "#8696a0",
                    },
                },
                MuiMenuItem: {
                    root: {
                        color: mode === "light" ? "#111b21" : "#e9edef",
                    },
                },
                MuiButton: {
                    root: {
                        textTransform: "none", 
                        borderRadius: 20,
                        padding: "6px 16px",
                    },
                    containedPrimary: {
                        fontWeight: "bold",
                    },
                    outlinedPrimary: {
                        fontWeight: "bold", 
                    },
                    textPrimary: {
                        fontWeight: "bold",
                    },
                },
            },
            scrollbarStyles: {
                "&::-webkit-scrollbar": {
                    width: '4px',
                    height: '4px',
                    borderRadius: "8px",
                },
                "&::-webkit-scrollbar-thumb": {
                    boxShadow: 'inset 0 0 6px rgba(0, 0, 0, 0.3)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2) !important',
                    borderRadius: "8px",
                },
            },
            scrollbarStylesSoft: {
                "&::-webkit-scrollbar": {
                    width: "6px",
                    borderRadius: "8px",
                },
                "&::-webkit-scrollbar-thumb": {
                    backgroundColor: mode === "light" ? "#d1d7db" : "#374248",
                    borderRadius: "8px",
                },
            },
            palette: {
                type: mode,
                primary: { main: mode === "light" ? "#00a884" : "#00a884" },
                secondary: { main: mode === "light" ? "#25d366" : "#25d366" },
                sair: { main: mode === "light" ? "#008069" : "#202c33" },
                vcard: { main: mode === "light" ? "#00a884" : "#8696a0" },
                textPrimary: mode === "light" ? "#111b21" : "#e9edef",
                borderPrimary: mode === "light" ? "#00a884" : "#00a884",
                dark: { main: mode === "light" ? "#111b21" : "#e9edef" },
                light: { main: mode === "light" ? "#f0f2f5" : "#111b21" },
                tabHeaderBackground: mode === "light" ? "#f0f2f5" : "#111b21",
                ticketlist: mode === "light" ? "#ffffff" : "#111b21",
                optionsBackground: mode === "light" ? "#ffffff" : "#111b21",
                options: mode === "light" ? "#f0f2f5" : "#202c33",
                fontecor: mode === "light" ? "#008069" : "#00a884",
                fancyBackground: mode === "light" ? "#f0f2f5" : "#0b141a",
                bordabox: mode === "light" ? "#e9edef" : "#222d34",
                newmessagebox: mode === "light" ? "#f0f2f5" : "#202c33",
                inputdigita: mode === "light" ? "#ffffff" : "#2a3942",
                contactdrawer: mode === "light" ? "#ffffff" : "#111b21",
                announcements: mode === "light" ? "#f0f2f5" : "#202c33",
                login: mode === "light" ? "#ffffff" : "#111b21",
                announcementspopover: mode === "light" ? "#ffffff" : "#202c33",
                chatlist: mode === "light" ? "#ffffff" : "#111b21",
                boxlist: mode === "light" ? "#f0f2f5" : "#202c33",
                boxchatlist: mode === "light" ? "#ffffff" : "#111b21",
                total: mode === "light" ? "#ffffff" : "#111b21",
                messageIcons: mode === "light" ? "#54656f" : "#aebac1",
                inputBackground: mode === "light" ? "#ffffff" : "#2a3942",
                barraSuperior: mode === "light" ? "linear-gradient(to right, #008069, #00a884)" : "#202c33",
                boxticket: mode === "light" ? "#efeae2" : "#0b141a",
                campaigntab: mode === "light" ? "#f0f2f5" : "#202c33",
                mediainput: mode === "light" ? "#f0f2f5" : "#202c33",
                contadordash: mode === "light" ? "#ffffff" : "#202c33",
                ticketoptions: mode === "light" ? "#ffffff" : "#202c33",
                background: {
                    default: mode === "light" ? "#f0f2f5" : "#0b141a",
                    paper: mode === "light" ? "#ffffff" : "#111b21",
                },
                text: {
                    primary: mode === "light" ? "#111b21" : "#e9edef",
                    secondary: mode === "light" ? "#667781" : "#8696a0",
                },
                divider: mode === "light" ? "#e9edef" : "#222d34",
            },
            mode,
        },
        locale
    );

    useEffect(() => {
        const i18nlocale = localStorage.getItem("i18nextLng");
        const browserLocale = i18nlocale.substring(0, 2) + i18nlocale.substring(3, 5);
        if (browserLocale === "esES") {
            setLocale(esES);
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem("preferredTheme", mode);
    }, [mode]);

    return (
        <ColorModeContext.Provider value={{ colorMode }}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <QueryClientProvider client={queryClient}>
                    <SocketContext.Provider value={SocketManager}>
                        <NotificationHandler />
                        <ToastContainer />
                        <Routes />
                    </SocketContext.Provider>
                </QueryClientProvider>
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
};

export default App;