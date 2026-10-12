import React, { useState, useContext, useEffect } from "react";
import clsx from "clsx";
import moment from "moment";
import {
  makeStyles,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  MenuItem,
  IconButton,
  Menu,
  useTheme,
  useMediaQuery,
} from "@material-ui/core";

import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import AccountCircle from "@material-ui/icons/AccountCircle";
import HelpIcon from '@mui/icons-material/Help';
import ApiIcon from '@mui/icons-material/Api';
import CachedIcon from "@material-ui/icons/Cached";
import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import UserLanguageSelector from "../components/UserLanguageSelector";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import AnnouncementsPopover from "../components/AnnouncementsPopover";
import { SocketContext } from "../context/Socket/SocketContext";
import ChatPopover from "../pages/Chat/ChatPopover";
import { useDate } from "../hooks/useDate";
import ColorModeContext from "../layout/themeContext";
import Brightness4Icon from '@material-ui/icons/Brightness4';
import Brightness7Icon from '@material-ui/icons/Brightness7';
import ExitToAppIcon from "@material-ui/icons/ExitToApp";
import { useHistory } from "react-router-dom";
import usePlans from "../hooks/usePlans";

const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100vh",
    backgroundColor: theme.palette.fancyBackground,
  },
  toolbar: {
    paddingRight: 24,
    minHeight: 54,
    color: theme.palette.dark.main,
    background: theme.palette.barraSuperior,
  },
  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 8px",
    minHeight: "48px",
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  menuButton: {
    [theme.breakpoints.up("sm")]: {
      marginRight: 36,
    }
  },
  menuButtonHidden: {
    display: "none",
  },
  title: {
    flexGrow: 1,
    fontSize: 14,
    color: "white",
  },
  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    ...theme.scrollbarStylesSoft
  },
  drawerPaperClose: {
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: 88,
  },
  appBarSpacer: {
    minHeight: "54px",
  },
  content: {
    flex: 1,
    overflow: "auto",
  },
  containerWithScroll: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  iconButton: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginLeft: theme.spacing(1),
    width: 36,
    height: 36,
    padding: 6,
    borderRadius: 10,
    transition: "all 0.2s ease-in-out",
    '&:hover': {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      transform: "scale(1.05)",
    },
    '& svg': {
      fontSize: 20,
      color: "#fff"
    }
  },
}));

const LoggedInLayout = ({ children }) => {
  const { getPlanCompany } = usePlans();
  const classes = useStyles();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState("permanent");
  const { user } = useContext(AuthContext);
  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const greaterThenSm = useMediaQuery(theme.breakpoints.up("sm"));

  const logoLight = `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/interno.png`;
  const logoDark = `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/logo_w.png`;
  const initialLogo = theme.palette.type === 'light' ? logoLight : logoDark;
  const [logoImg, setLogoImg] = useState(initialLogo);
  const [volume, setVolume] = useState(localStorage.getItem("volume") || 1);
  const { dateToClient } = useDate();
  const socketManager = useContext(SocketContext);
  const [showExternalApi, setShowExternalApi] = useState(false);
  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };
  useEffect(() => {
    if (document.body.offsetWidth > 1800) {
      setDrawerOpen(true);
    }
  }, []);

  useEffect(() => {
    if (document.body.offsetWidth < 1000) {
      setDrawerVariant("temporary");
    } else {
      setDrawerVariant("permanent");
    }
  }, [drawerOpen]);
  useEffect(() => {
    async function fetchData() {
      const companyId = user?.companyId;
      if (!companyId) return;

      try {
        const planConfigs = await getPlanCompany(undefined, companyId);
        if (planConfigs?.plan) {
          setShowExternalApi(planConfigs.plan.useExternalApi);
        }
      } catch (err) {
        console.warn("No se pudo obtener la configuración de plan de la empresa:", err?.message);
      }
    }

    if (user?.companyId) {
      fetchData();
    }
  }, [user]);
  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const userId = localStorage.getItem("userId");
    if (!companyId || !userId) return;

    const socket = socketManager.getSocket(companyId);

    socket.on(`company-${companyId}-auth`, (data) => {
      if (data.user.id === +userId) {
        toastError("Tu cuenta ha sido accedida desde otro dispositivo.");
        setTimeout(() => {
          localStorage.clear();
          window.location.reload();
        }, 1000);
      }
    });

    socket.emit("userStatus");
    const interval = setInterval(() => {
      socket.emit("userStatus");
    }, 1000 * 60 * 5);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [socketManager]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };
  const history = useHistory();
  const handleRefreshPage = () => window.location.reload(false);

  const toggleColorMode = () => {
    colorMode.toggleColorMode();
    setLogoImg((prevLogo) => (prevLogo === logoLight ? logoDark : logoLight));
  };

  if (loading) return <BackdropLoading />;

  return (
    <div className={classes.root}>
      <Drawer
        variant={drawerVariant}
        className={drawerOpen ? classes.drawerPaper : classes.drawerPaperClose}
        classes={{ paper: clsx(classes.drawerPaper, !drawerOpen && classes.drawerPaperClose) }}
        open={drawerOpen}
      >
        <div className={classes.toolbarIcon}>
          <IconButton style={{ margin: 9, backgroundColor: "#e5e5e5", width: 35, height: 35 }} onClick={() => setDrawerOpen(!drawerOpen)}>
            <ChevronLeftIcon />
          </IconButton>
        </div>
        <Divider />
        <List className={classes.containerWithScroll}>
          <MainListItems drawerClose={() => setDrawerOpen(false)} collapsed={!drawerOpen} />
        </List>
        <Divider />
      </Drawer>

      <UserModal open={userModalOpen} onClose={() => setUserModalOpen(false)} userId={user?.id} />

      <AppBar position="absolute" className={clsx(classes.appBar, drawerOpen && classes.appBarShift)} color="primary">
        <Toolbar variant="dense" className={classes.toolbar}>
          <IconButton edge="start" onClick={() => setDrawerOpen(!drawerOpen)} className={clsx(classes.menuButton, drawerOpen && classes.menuButtonHidden)}>
            <MenuIcon />
          </IconButton>

          <Typography component="h2" variant="h6" color="inherit" noWrap className={classes.title} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={`${logoImg}?r=${Math.random()}`} alt="logo" style={{ height: 40 }} />
            {greaterThenSm && user?.profile === "admin" && user?.company?.dueDate ? (
              <>Bienvenido a <b>{user?.company?.name}</b> -- (Vigencia hasta: {dateToClient(user?.company?.dueDate)})</>
            ) : (
              <></>
            )}
          </Typography>

          {user.id && <NotificationsPopOver volume={volume} />}
          <AnnouncementsPopover visibleOnlyIfUnread />
          <ChatPopover visibleOnlyIfUnread />
          <IconButton onClick={handleRefreshPage} className={classes.iconButton}><CachedIcon /></IconButton>
          <div>
            <IconButton aria-label="account of current user" aria-controls="menu-appbar" aria-haspopup="true" onClick={handleMenu} className={classes.iconButton}>
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              getContentAnchorEl={null}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              open={menuOpen}
              onClose={handleCloseMenu}
            >
              <MenuItem disableGutters style={{ paddingLeft: 16, paddingRight: 16 }}>
                <NotificationsVolume volume={volume} setVolume={setVolume} />
              </MenuItem>
              <MenuItem onClick={handleOpenUserModal}>
                <AccountCircle style={{ marginRight: 8 }} />
                {i18n.t("mainDrawer.appBar.user.profile")}
              </MenuItem>
              <MenuItem onClick={toggleColorMode}>
                {theme.mode === 'dark' ? (
                  <>
                    <Brightness7Icon style={{ marginRight: 8 }} />
                    Modo Claro
                  </>
                ) : (
                  <>
                    <Brightness4Icon style={{ marginRight: 8 }} />
                    Modo Oscuro
                  </>
                )}
              </MenuItem>
              <UserLanguageSelector iconOnly={false} />
              {showExternalApi && (
                <MenuItem onClick={() => { handleCloseMenu(); history.push("/messages-api"); }}>
                  <ApiIcon style={{ marginRight: 8 }} />
                  {i18n.t("mainDrawer.listItems.messagesAPI")}
                </MenuItem>
              )}
              <MenuItem onClick={() => { handleCloseMenu(); history.push("/helps"); }}>
                <HelpIcon style={{ marginRight: 8 }} />
                {i18n.t("mainDrawer.listItems.helps")}
              </MenuItem>
              <MenuItem onClick={handleClickLogout}>
                <ExitToAppIcon style={{ marginRight: 8 }} />
                {i18n.t("Salir")}
              </MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>

      <main className={classes.content} style={{ overflow: "hidden" }}>
        <div className={classes.appBarSpacer} />
        {children}
      </main>
    </div>
  );
};

export default LoggedInLayout;
