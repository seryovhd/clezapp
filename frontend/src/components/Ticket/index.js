import React, { useContext, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import clsx from "clsx";
import { toast } from "react-toastify";

import { Paper, makeStyles, Typography, Box, useTheme } from "@material-ui/core";
import WarningIcon from "@material-ui/icons/Warning";

import { AuthContext } from "../../context/Auth/AuthContext";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInputCustom/";
import MessagesList from "../MessagesList";
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

  const socketManager = useContext(SocketContext);
  const isAssignedToOtherUser = ticket?.userId && ticket?.userId !== user?.id && user?.profile !== "admin" || ticket?.status === "pending";

 
  const calculate24HourWindow = React.useCallback(async (ticketId) => {
    try {

      const { data } = await api.get(`/messages/${ticketId}`, {
        params: { pageNumber: 1 }
      });

      const customerMessages = data.messages?.filter(msg => !msg.fromMe) || [];
      const lastCustomerMessage = customerMessages.length > 0 
        ? customerMessages[customerMessages.length - 1] // El último del array (más reciente)
        : null;
      
      console.log("🔍 [24H DEBUG] Mensajes del ticket:", {
        totalMessages: data.messages?.length || 0,
        customerMessagesCount: customerMessages.length,
        ticketId: ticketId,
        lastCustomerMessage: lastCustomerMessage ? {
          id: lastCustomerMessage.id,
          createdAt: lastCustomerMessage.createdAt,
          body: lastCustomerMessage.body?.substring(0, 50)
        } : null
      });
      
      if (lastCustomerMessage && lastCustomerMessage.createdAt) {
        const lastMessageTime = new Date(lastCustomerMessage.createdAt);
        const now = new Date();
        const hoursElapsed = (now - lastMessageTime) / (1000 * 60 * 60); // Convertir a horas
        const hoursLeft = 24 - hoursElapsed;
        const exceeded = hoursElapsed >= 24;
        
        setHoursRemaining(Math.max(0, Math.floor(hoursLeft)));
        setIs24HoursExceeded(exceeded);
        
        console.log("🔍 [24H DEBUG] Tiempo calculado:", {
          lastMessageTime: lastMessageTime.toISOString(),
          now: now.toISOString(),
          hoursElapsed: hoursElapsed.toFixed(2),
          hoursRemaining: Math.max(0, Math.floor(hoursLeft)),
          isExceeded: exceeded,
          willBlockButton: exceeded
        });
      } else {
        console.log("🔍 [24H DEBUG] No hay mensajes del cliente, asumiendo ventana abierta");
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
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {
          const { data } = await api.get("/tickets/u/" + ticketId);
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
          
          console.log("🔍 [TICKET DEBUG] Ticket cargado:", {
            ticketId: data.id,
            whatsapp: data.whatsapp,
            whatsappType: data.whatsapp?.type,
            isBusiness: data.whatsapp?.type === "whatsapp_business",
            loading: false,
            whatsappKeys: data.whatsapp ? Object.keys(data.whatsapp) : []
          });
          console.log("🔍 [TICKET DEBUG] Objeto whatsapp completo:", JSON.stringify(data.whatsapp, null, 2));
          
            if (data.whatsapp?.type === "whatsapp_business" || data.whatsapp?.type === "facebook_messenger") {
              calculate24HourWindow(data.id);
            }
          
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
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
      if (data.action === "update" && data.ticket.id === ticket.id) {
        console.log("🔍 [SOCKET DEBUG] Ticket actualizado:", {
          ticketId: data.ticket.id,
          whatsapp: data.ticket.whatsapp,
          whatsappType: data.ticket.whatsapp?.type,
          isBusiness: data.ticket.whatsapp?.type === "whatsapp_business"
        });
        setTicket(data.ticket);
        if (data.ticket.whatsapp?.type === "whatsapp_business" || data.ticket.whatsapp?.type === "facebook_messenger") {
          calculate24HourWindow(data.ticket.id);
        }
      }

      if (data.action === "delete" && data.ticketId === ticket.id) {
        history.push("/tickets");
      }
    });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data.action === "update") {
        setContact((prevState) => {
          if (prevState.id === data.contact?.id) {
            return { ...prevState, ...data.contact };
          }
          return prevState;
        });
      }
    });

    socket.on(`company-${companyId}-appMessage`, (data) => {
      if (data.action === "create" && data.message.ticketId === ticket.id) {
        if (!data.message.fromMe && (ticket?.whatsapp?.type === "whatsapp_business" || ticket?.whatsapp?.type === "facebook_messenger")) {
          calculate24HourWindow(ticket.id);
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
    if (ticket.user !== undefined) {
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
    return (
      <>
        <MessagesList
          ticket={ticket}
          ticketId={ticket.id}
          isGroup={ticket.isGroup}
        ></MessagesList>
        <MessageInput 
          ticketId={ticket.id} 
          ticketStatus={ticket.status}
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



  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
      >
        <TicketHeader loading={loading}>
          {renderTicketInfo()}
          <TicketActionButtons ticket={ticket} />
        </TicketHeader>
        <Paper style={{boxShadow: "none"}}>
          <TagsContainer ticket={ticket} />
        </Paper>
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
