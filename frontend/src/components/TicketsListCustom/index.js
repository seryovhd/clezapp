import React, { useState, useEffect, useContext, useRef } from "react";
import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";
import TicketListItem from "../TicketListItemCustom";
import TicketsListSkeleton from "../TicketsListSkeleton";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";

const useStyles = makeStyles((theme) => ({
  ticketsListWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    overflowX: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  ticketsList: {
    flex: 1,
    maxHeight: "100%",
    overflowY: "scroll",
    overflowX: "hidden",
    scrollBehavior: "smooth",
    ...theme.scrollbarStyles,
    borderTop: "2px solid rgba(0, 0, 0, 0.12)",
  },
  noTicketsText: {
    textAlign: "center",
    color: "rgb(104, 121, 146)",
    fontSize: "14px",
    lineHeight: "1.4",
  },
  noTicketsTitle: {
    textAlign: "center",
    fontSize: "16px",
    fontWeight: "600",
    margin: "0px",
  },
  noTicketsDiv: {
    display: "flex",
    height: "100px",
    margin: 40,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
}));

const TicketsListCustom = (props) => {
  const {
    status,
    selectedQueueIds,
    updateCount,
    style,
    showAll = false,
    searchParam,
    tags,
    users,
    dateRange
  } = props;

  const classes = useStyles();
  const [pageNumber, setPageNumber] = useState(1);
  const [ticketsList, setTicketsList] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const socketReloadTimer = useRef(null);
  const closedTicketIdsRef = useRef(new Set());
  const [closingTicketIds, setClosingTicketIds] = useState(() => new Set());

  const removeTicketSmoothly = (ticketIdToRemove) => {
    const idNum = Number(ticketIdToRemove);
    closedTicketIdsRef.current.add(idNum);
    setClosingTicketIds((prev) => new Set(prev).add(idNum));
    setTimeout(() => {
      setTicketsList((current) => current.filter((t) => Number(t.id) !== idNum));
      setClosingTicketIds((prev) => {
        const next = new Set(prev);
        next.delete(idNum);
        return next;
      });
    }, 250);
  };

  // CARGA DE TICKETS (Permite modo silencioso para evitar parpadeos / flash)
  const loadTickets = async (page = 1, shouldReset = true, isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }

    try {
      const params = {
        status: status,
        queueIds: JSON.stringify(selectedQueueIds),
        pageNumber: page,
        showAll: showAll.toString()
      };

      if (searchParam) {
        params.searchParam = searchParam;
      }

      if (tags && tags.length > 0) {
        params.tags = JSON.stringify(tags);
      }

      if (users && users.length > 0) {
        params.users = JSON.stringify(users);
      }

      if (dateRange?.from) {
        params.date = dateRange.from;
      }

      if (dateRange?.until) {
        params.updatedAt = dateRange.until;
      }

      const { data } = await api.get("/tickets", { params });

      if (shouldReset) {
        setTicketsList(data.tickets || []);
      } else {
        setTicketsList(prev => [...prev, ...(data.tickets || [])]);
      }

      setHasMore(data.hasMore);

    } catch (error) {
      console.error("Error cargando tickets:", error);
      if (shouldReset) {
        setTicketsList([]);
      }
      setHasMore(false);
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  const queueIdsKey = JSON.stringify(selectedQueueIds || []);
  const tagsKey = JSON.stringify(tags || []);
  const usersKey = JSON.stringify(users || []);

  // CARGA INICIAL Y AL CAMBIAR DEPENDENCIAS
  useEffect(() => {
    setPageNumber(1);
    loadTickets(1, true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, queueIdsKey, showAll, searchParam, tagsKey, usersKey, dateRange]);

  // CARGA MÁS TICKETS CUANDO CAMBIA pageNumber
  useEffect(() => {
    if (pageNumber > 1) {
      loadTickets(pageNumber, false, false);
    }
  }, [pageNumber]);

  // LISTENERS DE SOCKET PARA ACTUALIZACIONES EN TIEMPO REAL (ESTILO WHATSAPP WEB)
  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const handleSocketEvent = (data) => {
      // 0. Eliminación reactiva con transición suave (ej. ticket cerrado o borrado)
      if (data?.action === "delete" && data?.ticketId) {
        removeTicketSmoothly(data.ticketId);
        return;
      }

      // 1. Actualización reactiva instantánea en memoria
      const ticket = data?.ticket || data?.message?.ticket;
      const targetTicketId = Number(ticket?.id || data?.message?.ticketId || data?.ticketId);

      // Si el ticket está marcado como cerrado y este panel muestra abiertos o pendientes, ignorar
      if (targetTicketId && closedTicketIdsRef.current.has(targetTicketId) && (status === "open" || status === "pending")) {
        return;
      }

      setTicketsList((prev) => {
        const isGroupTicket = ticket?.isGroup === true || ticket?.isGroup === "true";
        if (isGroupTicket) return prev;

        const existsIndex = prev.findIndex((t) => Number(t.id) === targetTicketId);

        // Si el ticket cambió a otro estado (por ejemplo, cerrado o resuelto), remover de este tab
        if (ticket?.status && status && ticket.status !== status) {
          if (existsIndex !== -1) {
            const updated = [...prev];
            updated.splice(existsIndex, 1);
            return updated;
          }
          return prev;
        }

        // Si ya existe en la lista, actualizar sus datos in-place en 0 ms
        if (existsIndex !== -1) {
          const updated = [...prev];
          const currentItem = updated[existsIndex];

          const hasNewMessage = data.action === "create" || Boolean(data.message);
          const isIncoming = data.message && !data.message.fromMe;

          const newUnread = isIncoming 
            ? (ticket?.unreadMessages ?? ((currentItem.unreadMessages || 0) + 1))
            : (ticket?.unreadMessages !== undefined ? ticket.unreadMessages : currentItem.unreadMessages);

          const lastBody = data.message?.body || ticket?.lastMessage || currentItem.lastMessage;
          const updatedDate = data.message?.createdAt || ticket?.updatedAt || new Date().toISOString();

          updated[existsIndex] = {
            ...currentItem,
            ...(ticket || {}),
            lastMessage: lastBody,
            updatedAt: updatedDate,
            unreadMessages: newUnread
          };

          // Si llegó un nuevo mensaje, subirlo a la cabecera inmediatamente
          if (hasNewMessage) {
            const [movedItem] = updated.splice(existsIndex, 1);
            updated.unshift(movedItem);
          }
          return updated;
        }

        // Si es un ticket nuevo de este mismo status, insertarlo arriba inmediatamente
        if (ticket && (!status || ticket.status === status)) {
          const lastBody = data.message?.body || ticket.lastMessage;
          const updatedDate = data.message?.createdAt || ticket.updatedAt || new Date().toISOString();
          return [{
            ...ticket,
            lastMessage: lastBody,
            updatedAt: updatedDate
          }, ...prev];
        }

        return prev;
      });

      // 2. Sincronización silenciosa en background con debounce inteligente (1500ms)
      if (socketReloadTimer.current) {
        clearTimeout(socketReloadTimer.current);
      }
      socketReloadTimer.current = setTimeout(() => {
        loadTickets(1, true, true);
      }, 1500);
    };

    socket.on(`company-${companyId}-ticket`, handleSocketEvent);
    socket.on(`company-${companyId}-appMessage`, handleSocketEvent);

    const handleSettingsEvent = (data) => {
      if (data?.action === "update" && data?.setting?.key === "showTicketWaitTime") {
        localStorage.setItem("showTicketWaitTime", data.setting.value);
        window.dispatchEvent(new Event("settings-update"));
      }
    };
    socket.on(`company-${companyId}-settings`, handleSettingsEvent);

    return () => {
      if (socketReloadTimer.current) {
        clearTimeout(socketReloadTimer.current);
      }
      socket.off(`company-${companyId}-ticket`, handleSocketEvent);
      socket.off(`company-${companyId}-appMessage`, handleSocketEvent);
      socket.off(`company-${companyId}-settings`, handleSettingsEvent);
    };
  }, [status, socketManager, selectedQueueIds, showAll, searchParam, tags, users, dateRange]);

  // LISTENER DE ACTUALIZACIONES OPTIMISTAS LOCALES A 0 MS
  useEffect(() => {
    const handleOptimisticUpdate = (e) => {
      const { type, ticketId, tags, status: newStatus, unreadMessages, lastMessage, ticket: optTicket, rollbackTicket } = e.detail || {};

      setTicketsList((prev) => {
        if (type === "rollback" && rollbackTicket) {
          const exists = prev.some((t) => Number(t.id) === Number(rollbackTicket.id));
          if (!exists && (!status || rollbackTicket.status === status)) {
            return [rollbackTicket, ...prev];
          }
          return prev;
        }

        if (!ticketId) return prev;
        const targetId = Number(ticketId);
        const existsIndex = prev.findIndex((t) => Number(t.id) === targetId);

        if (type === "status") {
          if (newStatus === "closed") {
            if (existsIndex !== -1 && (status === "open" || status === "pending")) {
              removeTicketSmoothly(targetId);
              return prev;
            }
            return prev;
          }

          if (newStatus === "open") {
            closedTicketIdsRef.current.delete(targetId);
            if (status === "pending" && existsIndex !== -1) {
              const updated = [...prev];
              updated.splice(existsIndex, 1);
              return updated;
            }
            if (status === "open") {
              if (existsIndex !== -1) {
                const updated = [...prev];
                updated[existsIndex] = { ...updated[existsIndex], status: "open" };
                return updated;
              }
              if (optTicket) {
                return [{ ...optTicket, status: "open", updatedAt: new Date().toISOString() }, ...prev];
              }
            }
          }
        }

        if (existsIndex === -1) return prev;
        const updated = [...prev];

        if (type === "tags") {
          updated[existsIndex] = {
            ...updated[existsIndex],
            tags: Array.isArray(tags) ? [...tags] : []
          };
          return updated;
        }

        if (type === "unread") {
          updated[existsIndex] = {
            ...updated[existsIndex],
            unreadMessages: unreadMessages !== undefined ? unreadMessages : 0
          };
          return updated;
        }

        if (type === "lastMessage") {
          const item = {
            ...updated[existsIndex],
            lastMessage: lastMessage || updated[existsIndex].lastMessage,
            updatedAt: new Date().toISOString()
          };
          updated.splice(existsIndex, 1);
          return [item, ...updated];
        }

        return prev;
      });
    };

    window.addEventListener("ticket-optimistic-update", handleOptimisticUpdate);
    return () => {
      window.removeEventListener("ticket-optimistic-update", handleOptimisticUpdate);
    };
  }, [status]);

  // ACTUALIZAR CONTADOR EXCLUYENDO TICKETS DE GRUPO
  useEffect(() => {
    if (updateCount) {
      const nonGroupTickets = ticketsList.filter(ticket => {
        const isGroupTicket = ticket.isGroup === true || ticket.isGroup === 'true';
        return !isGroupTicket;
      });
      
      updateCount(nonGroupTickets.length);
    }
  }, [ticketsList, updateCount]);

  const loadMore = () => {
    if (hasMore && !loading) {
      setPageNumber((prevState) => prevState + 1);
    }
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  // Filtrado de tickets que no son de grupo
  const nonGroupTickets = ticketsList.filter(ticket => {
    const isGroupTicket = ticket.isGroup === true || ticket.isGroup === 'true';
    return !isGroupTicket;
  });

  return (
    <Paper className={classes.ticketsListWrapper} style={style}>
      <Paper square elevation={0} className={classes.ticketsList} onScroll={handleScroll}>
        <List style={{ paddingTop: 0, paddingRight: 2 }}>
          {nonGroupTickets.length === 0 && !loading ? (
            <div className={classes.noTicketsDiv}>
              <span className={classes.noTicketsTitle}>{i18n.t("ticketsList.noTicketsTitle")}</span>
              <p className={classes.noTicketsText}>{i18n.t("ticketsList.noTicketsMessage")}</p>
            </div>
          ) : (
            nonGroupTickets.map((ticket) => (
              <TicketListItem
                ticket={ticket}
                key={ticket.id}
                isClosing={closingTicketIds.has(Number(ticket.id))}
              />
            ))
          )}
          {loading && nonGroupTickets.length === 0 && <TicketsListSkeleton />}
        </List>
      </Paper>
    </Paper>
  );
};

export default React.memo(TicketsListCustom);