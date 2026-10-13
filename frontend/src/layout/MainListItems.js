import React, { useContext, useEffect, useReducer, useState } from "react";
import { Link as RouterLink, useHistory } from "react-router-dom";

import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import { Badge } from "@material-ui/core";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import AutorenewIcon from '@material-ui/icons/Autorenew';
import SearchIcon from '@material-ui/icons/Search';
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import CodeRoundedIcon from "@material-ui/icons/CodeRounded";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import AnnouncementIcon from "@material-ui/icons/Announcement";
import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";
import { SocketContext } from "../context/Socket/SocketContext";
import { isArray } from "lodash";
import api from "../services/api";
import toastError from "../errors/toastError";
import { makeStyles } from "@material-ui/core/styles";
import { AttachFile, DeviceHubOutlined } from '@material-ui/icons';
import usePlans from "../hooks/usePlans";
import Typography from "@material-ui/core/Typography";
import useVersion from "../hooks/useVersion";
import {
  TbMessageCircleBolt, TbBrandWhatsapp, TbChartTreemap, TbPencilStar, TbAddressBook, TbClockEdit, TbMessageChatbot,
  TbHelpSquareRounded, TbLayoutDashboard, TbFileSettings, TbNews, TbPasswordUser, TbLogout,
} from "react-icons/tb";
import clsx from "clsx";
import Tooltip from "@material-ui/core/Tooltip";
const useStyles = makeStyles((theme) => ({
  listItemPadding: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  containerWithScroll: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: "#ccc transparent",
    '&::-webkit-scrollbar': {
      width: '6px'
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'transparent'
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: '#ccc',
      borderRadius: '4px',
      boxShadow: 'none'
    },
    '&::-webkit-scrollbar-thumb:hover': {
      backgroundColor: '#aaa'
    }
  },
  tooltipCustom: {
    fontSize: 14,
    backgroundColor: '#333',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: '4px',
  }
}));

function ListItemLink(props) {
  const { icon, primary, to, className, collapsed } = props;
  const classes = useStyles();

  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  const listItemContent = (
    <ListItem
      button
      dense
      component={renderLink}
      className={clsx(classes.listItemPadding, className)}
      aria-label={primary}
      style={collapsed ? { justifyContent: "center", paddingLeft: 0, paddingRight: 0 } : {}}
    >
      {icon ? (
        <ListItemIcon style={collapsed ? { minWidth: 0, justifyContent: "center" } : {}}>
          {icon}
        </ListItemIcon>
      ) : null}
      {!collapsed && <ListItemText primary={primary} />}
    </ListItem>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip
          title={<span style={{ fontSize: 14 }}>{primary}</span>}
          placement="right"
          arrow
          classes={{ tooltip: classes.tooltipCustom }}
        >
          {listItemContent}
        </Tooltip>
      ) : (
        listItemContent
      )}
    </li>
  );
}
const reducer = (state, action) => {
  if (action.type === "LOAD_CHATS") {
    const chats = action.payload;
    const newChats = [];

    if (isArray(chats)) {
      chats.forEach((chat) => {
        const chatIndex = state.findIndex((u) => u.id === chat.id);
        if (chatIndex !== -1) {
          state[chatIndex] = chat;
        } else {
          newChats.push(chat);
        }
      });
    }

    return [...state, ...newChats];
  }

  if (action.type === "UPDATE_CHATS") {
    const chat = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chat.id);

    if (chatIndex !== -1) {
      state[chatIndex] = chat;
      return [...state];
    } else {
      return [chat, ...state];
    }
  }

  if (action.type === "DELETE_CHAT") {
    const chatId = action.payload;

    const chatIndex = state.findIndex((u) => u.id === chatId);
    if (chatIndex !== -1) {
      state.splice(chatIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "CHANGE_CHAT") {
    const changedChats = state.map((chat) => {
      if (chat.id === action.payload.chat.id) {
        return action.payload.chat;
      }
      return chat;
    });
    return changedChats;
  }
};

const MainListItems = (props) => {
  const classes = useStyles();
  const { drawerClose, collapsed } = props;
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user, handleLogout } = useContext(AuthContext);
  const [connectionWarning, setConnectionWarning] = useState(false);
  const [openCampaignSubmenu, setOpenCampaignSubmenu] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false); const history = useHistory();
  const [showSchedules, setShowSchedules] = useState(false);
  const [showInternalChat, setShowInternalChat] = useState(false);

  const [invisible, setInvisible] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const { getPlanCompany } = usePlans();

  const [version, setVersion] = useState(false);


  const { getVersion } = useVersion();

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    async function fetchVersion() {
      const _version = await getVersion();
      setVersion(_version.version);
    }
    fetchVersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    async function fetchData() {
      const companyId = user?.companyId;
      if (!companyId) return;

      try {
        const planConfigs = await getPlanCompany(undefined, companyId);
        if (planConfigs?.plan) {
          setShowCampaigns(planConfigs.plan.useCampaigns);
          setShowKanban(planConfigs.plan.useKanban);
          setShowIntegrations(planConfigs.plan.useIntegrations);
          setShowSchedules(planConfigs.plan.useSchedules);
          setShowInternalChat(planConfigs.plan.useInternalChat);
        }
      } catch (e) {
        console.warn("Error cargando configuración de plan en menú:", e);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);



  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const handleChatEvent = (data) => {
      if (!data?.action) return;
      if (["new-message", "update"].includes(data.action)) {
        dispatch({ type: "CHANGE_CHAT", payload: data });
      }
    };

    socket.on(`company-${companyId}-chat`, handleChatEvent);

    return () => {
      socket.off(`company-${companyId}-chat`, handleChatEvent); // 🔁 Limpieza correcta
    };
  }, [socketManager]);

  useEffect(() => {
    let unreadsCount = 0;
    if (chats.length > 0) {
      for (let chat of chats) {
        for (let chatUser of chat.users) {
          if (chatUser.userId === user.id) {
            unreadsCount += chatUser.unreads;
          }
        }
      }
    }
    if (unreadsCount > 0) {
      setInvisible(false);
    } else {
      setInvisible(true);
    }
  }, [chats, user.id]);

  useEffect(() => {
    if (localStorage.getItem("cshow")) {
      setShowCampaigns(true);
    }
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_CHATS", payload: data.records });
    } catch (err) {
      toastError(err);
    }
  };

  const handleClickLogout = () => {
    //handleCloseMenu();
    handleLogout();
  };

  return (
    <div onClick={drawerClose} className={classes.containerWithScroll}>
      <Can
        role={user.profile}
        perform={"drawer-service-items:view"}
        className={classes.containerWithScroll}
        no={() => (
          <>
            <ListSubheader
              hidden={collapsed}
              style={{
                position: "relative",
                fontSize: "17px",
                textAlign: "left",
                paddingLeft: 20
              }}
              inset
              color="inherit">
              <Typography variant="overline" style={{ fontWeight: 'normal' }}>  {i18n.t("mainDrawer.listItems.tickets")} </Typography>
            </ListSubheader>
            <>

              <ListItemLink
                to="/tickets"
                primary={i18n.t("mainDrawer.listItems.tickets")}
                icon={<TbBrandWhatsapp style={{ height: "25px", width: "25px" }} />}
                collapsed={collapsed}
              />
              {showInternalChat && (
                <>
                  <ListItemLink
                    to="/chats"
                    primary={i18n.t("mainDrawer.listItems.chats")}
                    icon={<TbMessageChatbot style={{ height: "25px", width: "25px" }} />}
                    collapsed={collapsed}
                  />
                </>
              )}
              <ListItemLink
                to="/quick-messages"
                primary={i18n.t("mainDrawer.listItems.quickMessages")}
                icon={<TbMessageCircleBolt style={{ height: "25px", width: "25px" }} />}
                collapsed={collapsed}
              />
              <ListItemLink
                to="/kanban"
                primary="Kanban"
                icon={<TbChartTreemap style={{ height: "25px", width: "25px" }} />}
                collapsed={collapsed}
              />
              {/*               <ListItemLink
                to="/todolist"
                primary={i18n.t("mainDrawer.menuNew.tasks")}
                icon={<TbPencilStar style={{ height: "25px", width: "25px" }} />}
                collapsed={collapsed}
              /> */}
              <ListItemLink
                to="/contacts"
                primary={i18n.t("mainDrawer.listItems.contacts")}
                icon={<TbAddressBook style={{ height: "25px", width: "25px" }} />}
                collapsed={collapsed}
              />
              {showSchedules && (
                <>
                  <ListItemLink
                    to="/schedules"
                    primary={i18n.t("mainDrawer.listItems.schedules")}
                    icon={<TbClockEdit style={{ height: "25px", width: "25px" }} />}
                    collapsed={collapsed}
                  />
                </>
              )}
              <ListItemLink
                to="/tags"
                primary={i18n.t("mainDrawer.listItems.tags")}
                icon={<LocalOfferIcon style={{ height: "25px", width: "25px" }} />}
                collapsed={collapsed}
              />
            </>
          </>
        )}
      />

      <Can
        role={user.profile}
        perform={"drawer-admin-items:view"}
        yes={() => (
          <>
            <ListSubheader
              hidden={collapsed}
              style={{
                position: "relative",
                fontSize: "17px",
                textAlign: "left",
                paddingLeft: 20
              }}
              inset
              color="inherit">

              <Typography variant="overline" style={{ fontWeight: 'normal' }}>  {i18n.t("mainDrawer.listItems.dashboard")} </Typography>
            </ListSubheader>

            <ListItemLink
              small
              to="/"
              primary="Dashboard"
              icon={<TbLayoutDashboard style={{ height: "25px", width: "25px", color: "#FF5722" }} />}
              collapsed={collapsed}
            />

            <ListItemLink
              to="/reportes"
              primary={i18n.t("Reportes")}
              icon={<SearchIcon style={{ height: "25px", width: "25px", color: "#FF5722" }} />}
              collapsed={collapsed}
            />

          </>
        )}
      />
      <Can
        role={user.profile}
        perform="drawer-admin-items:view"
        yes={() => (
          <>

            {showCampaigns && (
              <>
                <ListSubheader
                  hidden={collapsed}
                  style={{
                    position: "relative",
                    fontSize: "17px",
                    textAlign: "left",
                    paddingLeft: 20
                  }}
                  inset
                  color="inherit">
                  <Typography variant="overline" style={{ fontWeight: 'normal' }}>  {i18n.t("mainDrawer.listItems.campaigns")} </Typography>
                </ListSubheader>

                <ListItemLink
                  small
                  to="/campaigns"
                  primary={i18n.t("Campañas")}
                  icon={<TbNews style={{ height: "25px", width: "25px", color: "#009688" }} />}
                  collapsed={collapsed}
                />

                <ListItemLink
                  small
                  to="/contact-lists"
                  primary={i18n.t("Listas de Contactos")}
                  icon={<TbPasswordUser style={{ height: "25px", width: "25px", color: "#009688" }} />}
                  collapsed={collapsed}
                />


                <ListItemLink
                  small
                  to="/campaigns-config"
                  primary={i18n.t("Configuraciones")}
                  icon={<TbFileSettings style={{ height: "25px", width: "25px", color: "#009688" }} />}
                  collapsed={collapsed}
                />
              </>
            )}

            <ListSubheader
              hidden={collapsed}
              style={{
                position: "relative",
                fontSize: "17px",
                textAlign: "left",
                paddingLeft: 20
              }}
              inset
              color="inherit">
              <Typography variant="overline" style={{ fontWeight: 'normal' }}>  {i18n.t("mainDrawer.listItems.administration")} </Typography>
            </ListSubheader>

            {user.super && (
              <ListItemLink
                to="/announcements"
                primary={i18n.t("mainDrawer.listItems.annoucements")}
                icon={<AnnouncementIcon />}
                collapsed={collapsed}
              />
            )}
            <ListItemLink
              to="/connections"
              primary={i18n.t("mainDrawer.listItems.connections")}
              icon={
                <Badge badgeContent={connectionWarning ? "!" : 0} color="error">
                  <SyncAltIcon />
                </Badge>
              }
              collapsed={collapsed}
            />
            {/*             <ListItemLink
              to="/files"
              primary={i18n.t("mainDrawer.listItems.files")}
              icon={<AttachFile />}
              collapsed={collapsed}
            /> */}
            {showIntegrations && (
              <ListItemLink
                to="/queue-integration"
                primary={i18n.t("mainDrawer.listItems.queueIntegration")}
                icon={<DeviceHubOutlined />}
                collapsed={collapsed}
              />
            )}
            <ListItemLink
              to="/users"
              primary={i18n.t("mainDrawer.listItems.users")}
              icon={<PeopleAltOutlinedIcon />}
              collapsed={collapsed}
            />
            <ListItemLink
              to="/queues"
              primary={i18n.t("mainDrawer.listItems.queues")}
              icon={<AccountTreeOutlinedIcon />}
              collapsed={collapsed}
            />
            {/*             <ListItemLink
                to="/financeiro"
                primary={i18n.t("mainDrawer.listItems.financeiro")}
                icon={<LocalAtmIcon />}
              /> */}

            <ListItemLink
              to="/settings"
              primary={i18n.t("mainDrawer.listItems.settings")}
              icon={<SettingsOutlinedIcon />}
              collapsed={collapsed}
            />

            {user.super && (
              <ListSubheader
                hidden={collapsed}
                style={{
                  position: "relative",
                  fontSize: "17px",
                  textAlign: "left",
                  paddingLeft: 20
                }}
                inset
                color="inherit">
                <Typography variant="overline" style={{ fontWeight: 'normal' }}>  {i18n.t("Sistema")} </Typography>
              </ListSubheader>
            )}
            {user.super && (
              <ListItemLink
                to="/LogLauncher"
                primary={i18n.t("mainDrawer.listItems.LogLauncher")}
                icon={<AutorenewIcon />}
                collapsed={collapsed}
              />
            )}


            {!collapsed && (
              <React.Fragment>
                <Divider />
                {/* 
                // IMAGEM NO MENU
                <Hidden only={['sm', 'xs']}>
                  <img style={{ width: "100%", padding: "10px" }} src={logo} alt="image" />            
                </Hidden> 
                */}
                <Typography
                  style={{
                    fontSize: "12px",
                    padding: "10px",
                    textAlign: "right",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "4px"
                  }}
                >
                  {`${version}`}
                  <span style={{
                    backgroundColor: "#ecfdf5",    // Verde muy claro, casi blanco
                    color: "#059669",              // Verde esmeralda oscuro (pro)
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    lineHeight: "normal",
                    border: "1px solid #d1fae5"     // Borde verde muy suave
                  }}>
                    PRO
                  </span>

                </Typography>
              </React.Fragment>
            )}
          </>
        )}
      />
    </div>
  );
};

export default MainListItems;
