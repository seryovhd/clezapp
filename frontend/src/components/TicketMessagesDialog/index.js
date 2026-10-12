import React, { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  makeStyles,
} from "@material-ui/core";
import { useHistory } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import MessagesList from "../MessagesList";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import { SocketContext } from "../../context/Socket/SocketContext";

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
  buttonContainer: {
    display: "flex",
    gap: theme.spacing(1),
    justifyContent: "flex-end",
    padding: theme.spacing(1, 2),
  },
  closeButton: {
    color: theme.palette.text.secondary,
    borderColor: theme.palette.divider,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  acceptButton: {
    backgroundColor: theme.palette.grey[100],
    color: theme.palette.success.main,
    border: `1px solid ${theme.palette.success.light}`,
    '&:hover': {
      backgroundColor: theme.palette.success.light,
      color: theme.palette.success.contrastText,
    },
    '&:disabled': {
      backgroundColor: theme.palette.grey[200],
      color: theme.palette.grey[500],
      border: `1px solid ${theme.palette.grey[300]}`,
    },
  },
  closeTicketButton: {
    backgroundColor: theme.palette.grey[100],
    color: theme.palette.error.main,
    border: `1px solid ${theme.palette.error.light}`,
    '&:hover': {
      backgroundColor: theme.palette.error.light,
      color: theme.palette.error.contrastText,
    },
    '&:disabled': {
      backgroundColor: theme.palette.grey[200],
      color: theme.palette.grey[500],
      border: `1px solid ${theme.palette.grey[300]}`,
    },
  },
  ticketClosedBadge: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.contrastText,
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.spacing(0.5),
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  ticketAcceptedBadge: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.contrastText,
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.spacing(0.5),
    fontSize: '0.875rem',
    fontWeight: 500,
  },
}));

export default function TicketMessagesDialog({ open, onClose, ticketId }) {
  const history = useHistory();
  const classes = useStyles();

  const { user } = useContext(AuthContext);
  const [, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const socketManager = useContext(SocketContext);

  useEffect(() => {
    let delayDebounceFn = null;

    if (open) {
      setLoading(true);
      delayDebounceFn = setTimeout(() => {
        const fetchTicket = async () => {
          try {
            const { data } = await api.get("/tickets/" + ticketId);
            const { queueId, whatsappId, userId } = data;
            const { queues, profile, id, whatsappId: userWhatsapp } = user;

            const queueAllowed = queues.find((q) => q.id === queueId);
            const hasWhatsappPermission =
              whatsappId != null &&
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
            setLoading(false);
          } catch (err) {
            setLoading(false);
            toastError(err);
          }
        };

        fetchTicket();
      }, 500);
    }

    return () => {
      if (delayDebounceFn !== null) {
        clearTimeout(delayDebounceFn);
      }
    };
  }, [ticketId, user, history, open]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    let socket = null;

    if (open) {
      socket = socketManager.getSocket(companyId);

      socket.on("ready", () => {
        if (ticket?.id) {
          socket.emit("joinChatBox", `${ticket.id}`);
        }
      });

      socket.on(`company-${companyId}-ticket`, (data) => {
        if (data.action === "update" && data.ticket.id === ticket.id) {
          setTicket(data.ticket);
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
    }

    return () => {
      if (socket !== null) {
        socket.disconnect();
      }
    };
  }, [ticketId, ticket, history, open, socketManager]);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  // Función para aceptar el ticket
  const handleAcceptTicket = async () => {
    try {
      await api.put(`/tickets/${ticketId}`, {
        status: "open",
        userId: user.id
      });
      toast.success("Ticket aceptado exitosamente");
      // No cerramos el diálogo para que el usuario pueda interactuar inmediatamente
    } catch (err) {
      toastError(err);
    }
  };

  // Función para cerrar el ticket
  const handleCloseTicket = async () => {
    try {
      await api.put(`/tickets/${ticketId}`, { status: "closed" });
      toast.success("Ticket cerrado exitosamente");
      onClose();
    } catch (err) {
      toastError(err);
    }
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
      <Box className={classes.root}>
        <MessagesList
          ticket={ticket}
          ticketId={ticket.id}
          isGroup={ticket.isGroup}
        />
      </Box>
    );
  };

  // Determinar el estado del ticket para mostrar los botones apropiados
  const isTicketPending = ticket.status === "pending";
  const isTicketOpen = ticket.status === "open";
  const isTicketClosed = ticket.status === "closed";
  const isTicketAssignedToMe = ticket.userId === user?.id;

  return (
    <Dialog maxWidth="md" onClose={onClose} open={open}>
      <TicketHeader loading={loading}>{renderTicketInfo()}</TicketHeader>
      <ReplyMessageProvider>{renderMessagesList()}</ReplyMessageProvider>
      <DialogActions>
        <Box className={classes.buttonContainer}>
          <Button
            onClick={handleAcceptTicket}
            variant="contained"
            className={classes.acceptButton}
            disabled={loading}
            startIcon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            }
          >
            Aceptar Ticket
          </Button>

          <Button
            onClick={handleCloseTicket}
            variant="outlined"
            className={classes.closeTicketButton}
            disabled={loading}
            startIcon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            }
          >
            Cerrar Ticket
          </Button>
          <Button
            onClick={onClose}
            color="primary"
            variant="outlined"
            className={classes.closeButton}
          >
            Cerrar Vista
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}