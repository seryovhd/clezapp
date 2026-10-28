import React, { useContext, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import clsx from "clsx";
import { toast } from "react-toastify";

import {
  Paper,
  makeStyles,
  Typography,
  Box,
  useTheme,
  Collapse,
  Tooltip,
  Avatar,
} from "@material-ui/core";
import WarningIcon from "@material-ui/icons/Warning";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

import { AuthContext } from "../../context/Auth/AuthContext";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { getInitials } from "../../helpers/getInitials";
import { generateColor } from "../../helpers/colorGenerator";
import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInputCustom/";
import MessagesList, { getTicketMessagesCache } from "../MessagesList";
import { TagsContainer } from "../TagsContainer";
import TicketActionButtons from "../TicketActionButtonsCustom";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import LockOutlinedIcon from "@material-ui/icons/LockOutlined";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },

  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: -drawerWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  },

  headerAreaWrapper: {
    position: "relative",
    flexShrink: 0,
    zIndex: 20,
  },

  compactHeaderBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 46,
    maxHeight: 50,
    padding: "2px 14px",
    backgroundColor: theme.palette.tabHeaderBackground || (theme.palette.type === "dark" ? "#202c33" : "#f0f2f5"),
    borderBottom: theme.palette.divider ? `1px solid ${theme.palette.divider}` : "1px solid rgba(0, 0, 0, 0.12)",
    gap: 8,
  },

  compactContactInfo: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    minWidth: 0,
    flex: 1,
    overflow: "hidden",
    userSelect: "none",
    borderRadius: 6,
    padding: "2px 6px",
    transition: "background-color 0.15s ease",
    "&:hover": {
      backgroundColor: theme.palette.type === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
    },
  },

  compactTitle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.88rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#e9edef" : "#111b21",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  compactTicketId: {
    color: theme.palette.type === "dark" ? "#8696a0" : "#667781",
    fontWeight: 500,
    fontSize: "0.82rem",
  },

  compactAssignee: {
    fontSize: "0.78rem",
    color: theme.palette.type === "dark" ? "#aebac1" : "#54656f",
    fontWeight: "normal",
    marginLeft: 4,
    whiteSpace: "nowrap",
  },

  compactActions: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },

  slidingTabWrapper: {
    display: "flex",
    justifyContent: "center",
    position: "relative",
    height: 0,
    zIndex: 25,
  },

  slidingTab: {
    position: "absolute",
    top: 0,
    transform: "translateY(-50%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 54,
    height: 18,
    backgroundColor: theme.palette.type === "dark" ? "#202c33" : "#ffffff",
    border: theme.palette.type === "dark" ? "1px solid #3b4a54" : "1px solid #cbd5e1",
    borderRadius: 9,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    color: theme.palette.type === "dark" ? "#8696a0" : "#54656f",
    "&:hover": {
      backgroundColor: theme.palette.type === "dark" ? "#2a3942" : "#f1f5f9",
      color: theme.palette.type === "dark" ? "#00a884" : "#008069",
      transform: "translateY(-50%) scale(1.1)",
      boxShadow: "0 3px 8px rgba(0,0,0,0.18)",
    },
  },

  slidingTabIcon: {
    fontSize: 18,
    lineHeight: 1,
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();
  const theme = useTheme();
  const isDark = (theme.palette?.type || theme.mode) === 'dark';

  const { user } = useContext(AuthContext);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [hoursRemaining, setHoursRemaining] = useState(null);
  const [is24HoursExceeded, setIs24HoursExceeded] = useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(() => {
    const saved = localStorage.getItem("ticketHeaderExpanded");
    return saved !== null ? saved === "true" : true;
  });

  const handleToggleHeader = () => {
    setIsHeaderExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("ticketHeaderExpanded", String(next));
      return next;
    });
  };

  const socketManager = useContext(SocketContext);
  const isAssignedToOtherUser = ticket?.userId && ticket?.userId !== user?.id && user?.profile !== "admin" || ticket?.status === "pending";

 
  const calculate24HourWindow = React.useCallback(async (targetTicketId) => {
    try {
      let messages = null;
      const cached = getTicketMessagesCache(targetTicketId);
      if (cached && Array.isArray(cached.messages) && cached.messages.length > 0) {
        messages = cached.messages;
      } else {
        const { data } = await api.get(`/messages/${targetTicketId}`, {
          params: { pageNumber: 1 }
        });
        messages = data?.messages;
      }

      const customerMessages = messages?.filter(msg => !msg.fromMe) || [];
      const lastCustomerMessage = customerMessages.length > 0 
        ? customerMessages[customerMessages.length - 1] // El último del array (más reciente)
        : null;
      
      if (lastCustomerMessage && lastCustomerMessage.createdAt) {
        const lastMessageTime = new Date(lastCustomerMessage.createdAt);
        const now = new Date();
        const hoursElapsed = (now - lastMessageTime) / (1000 * 60 * 60); // Convertir a horas
        const hoursLeft = 24 - hoursElapsed;
        const exceeded = hoursElapsed >= 24;
        
        setHoursRemaining(Math.max(0, Math.floor(hoursLeft)));
        setIs24HoursExceeded(exceeded);
      } else {
        setHoursRemaining(24);
        setIs24HoursExceeded(false);
      }
    } catch (err) {
      console.error("Error calculando ventana de 24 horas:", err);
      setHoursRemaining(null);
      setIs24HoursExceeded(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    let isMounted = true;
    const abortController = new AbortController();

    const fetchTicket = async () => {
      try {
        const { data } = await api.get("/tickets/u/" + ticketId, {
          signal: abortController.signal
        });
        if (!isMounted) return;

        const { queueId, whatsappId, userId } = data;
        const { queues, profile, id, whatsappId: userWhatsapp } = user;

        const queueAllowed = !queueId || queues.some((q) => q.id === queueId);

        const hasWhatsappPermission = whatsappId != null &&
          (Array.isArray(userWhatsapp)
            ? userWhatsapp.map(String).includes(String(whatsappId))
            : String(userWhatsapp) === String(whatsappId));
        const isAssigned = userId === id;

        if (!queueAllowed && profile !== "admin" && !hasWhatsappPermission && !isAssigned) {
          toast.error("Acceso no permitido");
          history.push("/tickets");
          return;
        }

        setContact(data.contact);
        setTicket(data);
        
        if (data.whatsapp?.type === "whatsapp_business" || data.whatsapp?.type === "facebook_messenger") {
          calculate24HourWindow(data.id);
        }
        
        setLoading(false);
      } catch (err) {
        if (isMounted) {
          setLoading(false);
          if (!api.isCancel?.(err) && err?.name !== "CanceledError" && err?.name !== "AbortError") {
            toastError(err);
          }
        }
      }
    };

    fetchTicket();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [ticketId, user, history, calculate24HourWindow]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on("ready", () => {
      if (ticket?.id) {
        socket.emit("joinChatBox", `${ticket.id}`);
      }
    });

    socket.on(`company-${companyId}-ticket`, (data) => {
      const isTarget =
        data?.ticket &&
        (data.ticket.id === ticket?.id ||
          (ticket?.uuid && String(data.ticket.uuid) === String(ticket.uuid)) ||
          String(data.ticket.uuid) === String(ticketId));

      if (data.action === "update" && isTarget) {
        setTicket(data.ticket);
        if (data.ticket.whatsapp?.type === "whatsapp_business" || data.ticket.whatsapp?.type === "facebook_messenger") {
          calculate24HourWindow(data.ticket.id);
        }
      }

      if (data.action === "delete" && (data.ticketId === ticket?.id || String(data.ticketId) === String(ticket?.id))) {
        history.push("/tickets");
      }
    });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data.action === "update") {
        setContact((prevState) => {
          if (prevState?.id === data.contact?.id) {
            return { ...prevState, ...data.contact };
          }
          return prevState;
        });
      }
    });

    socket.on(`company-${companyId}-appMessage`, (data) => {
      const isTargetMsg =
        data?.message &&
        (data.message.ticketId === ticket?.id ||
          String(data.message.ticketId) === String(ticket?.id) ||
          String(data.message.ticketId) === String(ticketId));

      if (data.action === "create" && isTargetMsg) {
        if (!data.message.fromMe && (ticket?.whatsapp?.type === "whatsapp_business" || ticket?.whatsapp?.type === "facebook_messenger")) {
          calculate24HourWindow(ticket?.id || data.message.ticketId);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId, ticket, history, socketManager, calculate24HourWindow]);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const renderTicketInfo = () => {
    if (ticket?.user !== undefined || ticket?.id || contact?.id) {
      return (
        <TicketInfo
          contact={contact}
          ticket={ticket}
          onClick={handleDrawerOpen}
        />
      );
    }
  };

  const renderMessagesList = () => {
    const isCurrentTicket =
      ticket?.uuid === ticketId || String(ticket?.id) === String(ticketId);

    const resolvedTicketId =
      isCurrentTicket && ticket?.id
        ? ticket.id
        : (!isNaN(Number(ticketId)) && Number(ticketId) > 0 ? Number(ticketId) : ticket?.id || undefined);

    return (
      <>
        <MessagesList
          ticket={isCurrentTicket ? ticket : {}}
          ticketId={ticketId}
          isGroup={isCurrentTicket ? ticket?.isGroup : false}
        ></MessagesList>
        <MessageInput 
          ticketId={resolvedTicketId} 
          ticketStatus={ticket?.status || "open"}
          is24HoursExceeded={is24HoursExceeded}
        />
      </>
    );
  };


if (isAssignedToOtherUser && !loading) {
  return (
    <div className={classes.root}>
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            padding: "2rem",
            textAlign: "center",
            color: isDark ? "#8696a0" : "#666"
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem", color: isDark ? "#8696a0" : "#bbb" }}>
            🔒
          </div>
          <h2 style={{ margin: 0, color: isDark ? "#e9edef" : "#111b21" }}>No tienes permisos para ver ni responder en este ticket.</h2>
          <p style={{ marginTop: 8, fontStyle: "italic", color: isDark ? "#8696a0" : "#666" }}>
            Este ticket está asignado a otro agente.
          </p>
        </div>
      </Paper>
    </div>
  );
}



  const currentContact = contact?.id ? contact : (ticket?.contact || {});
  const displayName = currentContact?.name || currentContact?.number || "Contacto";

  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
      >
        <div className={classes.headerAreaWrapper}>
          <Collapse in={!isHeaderExpanded} timeout={250}>
            <div className={classes.compactHeaderBar}>
              <div
                className={classes.compactContactInfo}
                onClick={handleDrawerOpen}
                title="Ver información del contacto"
              >
                <Avatar
                  src={currentContact?.profilePicUrl}
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: generateColor(currentContact?.number),
                    color: "#fff",
                    fontWeight: "bold",
                    fontSize: "0.75rem",
                    marginRight: 8,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(currentContact?.name)}
                </Avatar>
                <Typography variant="body2" className={classes.compactTitle} noWrap>
                  <span>{displayName}</span>
                  <span className={classes.compactTicketId}>#{ticket?.id}</span>
                  {ticket?.user?.name && (
                    <span className={classes.compactAssignee}>
                      ({ticket?.user?.name})
                    </span>
                  )}
                </Typography>
              </div>

              <div className={classes.compactActions}>
                <TicketActionButtons ticket={ticket} />
              </div>
            </div>
          </Collapse>

          <Collapse in={isHeaderExpanded} timeout={250}>
            <TicketHeader loading={loading && !ticket?.id}>
              {renderTicketInfo()}
              <TicketActionButtons ticket={ticket} />
            </TicketHeader>
            <Paper style={{ boxShadow: "none", flexShrink: 0 }}>
              <TagsContainer ticket={ticket} />
            </Paper>
          </Collapse>

          <div className={classes.slidingTabWrapper}>
            <Tooltip
              title={isHeaderExpanded ? "Ocultar cabecera y etiquetas" : "Mostrar cabecera y etiquetas"}
              placement="bottom"
            >
              <div
                className={classes.slidingTab}
                onClick={handleToggleHeader}
                role="button"
                tabIndex={0}
              >
                {isHeaderExpanded ? (
                  <ExpandLessIcon className={classes.slidingTabIcon} />
                ) : (
                  <ExpandMoreIcon className={classes.slidingTabIcon} />
                )}
              </div>
            </Tooltip>
          </div>
        </div>
        {(() => {
          const isBusiness = ticket?.whatsapp?.type === "whatsapp_business" || ticket?.whatsapp?.type === "facebook_messenger";
          const shouldShow = isBusiness && !loading;
          
          console.log("🔍 [RENDER DEBUG] Evaluando alerta business:", {
            ticket: ticket,
            whatsapp: ticket?.whatsapp,
            whatsappType: ticket?.whatsapp?.type,
            isBusiness: isBusiness,
            loading: loading,
            shouldShow: shouldShow
          });
          
          const getWarningMessage = () => {
            const channelName = ticket?.whatsapp?.type === "facebook_messenger" ? "Facebook Messenger" : "WhatsApp Business API";
            
            if (hoursRemaining === null) {
              return `⏰ Límite de 24 horas: Tienes 24 horas para responder al cliente (límite de ${channelName}).`;
            }
            if (is24HoursExceeded) {
              return "⛔ Tiempo agotado: Han pasado más de 24 horas desde el último mensaje del cliente. No puedes enviar mensajes.";
            }
            return `⏰ Límite de 24 horas: Quedan ${hoursRemaining} ${hoursRemaining === 1 ? 'hora' : 'horas'} para responder al cliente.`;
          };

          const backgroundColor = is24HoursExceeded ? "#f8d7da" : "#fff3cd";
          const borderColor = is24HoursExceeded ? "#dc3545" : "#ffc107";
          const textColor = is24HoursExceeded ? "#721c24" : "#856404";

          return shouldShow ? (
          <Paper 
            style={{
              boxShadow: "none", 
              padding: "6px 12px",
              margin: "0 0 0px 0",
              backgroundColor: backgroundColor,
              borderLeft: `3px solid ${borderColor}`,
              borderRadius: "4px"
            }}
          >
            <Box display="flex" alignItems="center" style={{ margin: 0, padding: 0 }}>
              <WarningIcon style={{ color: textColor, marginRight: "6px", fontSize: "18px", flexShrink: 0 }} />
              <Typography 
                variant="caption" 
                style={{ 
                  color: textColor,
                  lineHeight: 1.2,
                  fontSize: "12px",
                  margin: 0,
                  padding: 0
                }}
              >
                <strong>{getWarningMessage()}</strong>
              </Typography>
            </Box>
          </Paper>
          ) : null;
        })()}
        <ReplyMessageProvider>{renderMessagesList()}</ReplyMessageProvider>
      </Paper>
      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        contact={contact}
        loading={loading}
        ticket={ticket}
      />
    </div>
  );
};

export default Ticket;
