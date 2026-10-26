import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { unstable_batchedUpdates } from "react-dom";
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
  const selectedQueueIdsRef = useRef(selectedQueueIds);
  selectedQueueIdsRef.current = selectedQueueIds;
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const usersRef = useRef(users);
  usersRef.current = users;
  const dateRangeRef = useRef(dateRange);
  dateRangeRef.current = dateRange;

  // CARGA DE TICKETS (Permite modo silencioso para evitar parpadeos / flash)
  const loadTickets = async (page = 1, shouldReset = true, isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }

    try {
      const params = {
        status: status,
        queueIds: JSON.stringify(selectedQueueIdsRef.current || []),
        pageNumber: page,
        showAll: showAll.toString()
      };

      if (searchParam) {
        params.searchParam = searchParam;
      }

      if (tagsRef.current && tagsRef.current.length > 0) {
        params.tags = JSON.stringify(tagsRef.current);
      }

      if (usersRef.current && usersRef.current.length > 0) {
        params.users = JSON.stringify(usersRef.current);
      }

      if (dateRangeRef.current?.from) {
        params.date = dateRangeRef.current.from;
      }

      if (dateRangeRef.current?.until) {
        params.updatedAt = dateRangeRef.current.until;
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

    if (status) {
      socket.emit("joinTickets", status);
    }

    const handleSocketEvent = (data) => {
      unstable_batchedUpdates(() => {
        // 0. Eliminación o salida de cola/ticket
        if (data?.action === "delete" && data?.ticketId) {
          setTicketsList((prev) => prev.filter((t) => t.id !== +data.ticketId));
          return;
        }

        // 1. Mensajes leídos: poner contador de no leídos en 0 al instante
        if (data?.action === "updateUnread" && data?.ticketId) {
          setTicketsList((prev) =>
            prev.map((t) => (t.id === +data.ticketId ? { ...t, unreadMessages: 0 } : t))
          );
          return;
        }

        // 2. Actualización reactiva instantánea en memoria (tickets, tags, mensajes)
        if (data?.ticket) {
          setTicketsList((prev) => {
            const ticket = data.ticket;
            const isGroupTicket = ticket.isGroup === true || ticket.isGroup === "true";
            if (isGroupTicket) return prev;

            const activeQueueIds = selectedQueueIdsRef.current;
            // Si hay filtro de colas seleccionado y el ticket no pertenece a esas colas:
            if (Array.isArray(activeQueueIds) && activeQueueIds.length > 0) {
              if (ticket.queueId && !activeQueueIds.includes(ticket.queueId)) {
                return prev.filter((t) => t.id !== ticket.id);
              }
            }

            const existsIndex = prev.findIndex((t) => t.id === ticket.id);

            // Si el ticket cambió a otro estado (por ejemplo, cerrado o resuelto), remover de este tab
            if (status && ticket.status !== status) {
              if (existsIndex !== -1) {
                const updated = [...prev];
                updated.splice(existsIndex, 1);
                return updated;
              }
              return prev;
            }

            // Determinar el último mensaje fresco y fecha
            const isMedia = Boolean(data.message?.mediaType || data.message?.mediaUrl);
            const rawBody = (data.message?.body || "").trim();
            const isGenericBody = !rawBody || rawBody === "-" || rawBody === "sticker";

            let freshLastMessage = ticket.lastMessage;

            if (isMedia) {
              const mt = (data.message.mediaType || "").toLowerCase();
              const isSticker = mt === "sticker" || (data.message?.mediaUrl && data.message.mediaUrl.toLowerCase().includes(".webp"));
              if (isSticker) {
                freshLastMessage = "💟 Sticker";
              } else if (rawBody && !isGenericBody) {
                freshLastMessage = mt === "image" ? `📷 ${rawBody}` : mt === "video" ? `📹 ${rawBody}` : mt === "audio" ? `🎵 ${rawBody}` : `📄 ${rawBody}`;
              } else {
                freshLastMessage = mt === "image" ? "📷 Imagen" : mt === "video" ? "📹 Video" : mt === "audio" ? "🎵 Audio" : "📄 Archivo";
              }
            } else if (rawBody && !isGenericBody) {
              freshLastMessage = rawBody;
            } else if (ticket.lastMessage && ticket.lastMessage !== "-" && ticket.lastMessage !== "Archivo de medios") {
              freshLastMessage = ticket.lastMessage;
            }
            const freshUpdatedAt = data.message?.createdAt || ticket.updatedAt || new Date().toISOString();

            // Si ya existe en la lista, actualizar sus datos in-place
            if (existsIndex !== -1) {
              const currentItem = prev[existsIndex];
              const updated = [...prev];

              let newUnread = ticket.unreadMessages !== undefined ? ticket.unreadMessages : (currentItem.unreadMessages || 0);
              if (data.message && !data.message.fromMe && !data.message.read) {
                newUnread = (currentItem.unreadMessages || 0) + 1;
              }

              const updatedTicket = {
                ...currentItem,
                ...ticket,
                lastMessage: freshLastMessage !== undefined ? freshLastMessage : currentItem.lastMessage,
                updatedAt: freshUpdatedAt,
                unreadMessages: newUnread
              };

              updated[existsIndex] = updatedTicket;

              // Si llegó un nuevo mensaje o acción create, mover al primer lugar de la lista
              if (data.action === "create" || data.message) {
                if (existsIndex > 0) {
                  const [movedItem] = updated.splice(existsIndex, 1);
                  updated.unshift(movedItem);
                }
              }
              return updated;
            }

            // Si es un ticket nuevo de este mismo status, insertarlo arriba
            if (!status || ticket.status === status) {
              const newTicket = {
                ...ticket,
                lastMessage: freshLastMessage !== undefined ? freshLastMessage : ticket.lastMessage,
                updatedAt: freshUpdatedAt
              };
              return [newTicket, ...prev];
            }

            return prev;
          });
        }

        // 3. Sincronización en background con debounce SOLO si hay filtros complejos activos
        const hasComplexFilters =
          Boolean(searchParam) ||
          (Array.isArray(tagsRef.current) && tagsRef.current.length > 0) ||
          (Array.isArray(usersRef.current) && usersRef.current.length > 0) ||
          Boolean(dateRangeRef.current?.from);

        if (hasComplexFilters) {
          if (socketReloadTimer.current) {
            clearTimeout(socketReloadTimer.current);
          }
          socketReloadTimer.current = setTimeout(() => {
            loadTickets(1, true, true);
          }, 2000);
        }
      });
    };

    socket.on(`company-${companyId}-ticket`, handleSocketEvent);
    socket.on(`company-${companyId}-appMessage`, handleSocketEvent);

    const handleContactEvent = (data) => {
      if (data?.action === "update" && data?.contact) {
        unstable_batchedUpdates(() => {
          setTicketsList((prev) =>
            prev.map((t) => {
              if (t.contactId === data.contact.id || t.contact?.id === data.contact.id) {
                return {
                  ...t,
                  contact: {
                    ...t.contact,
                    ...data.contact,
                  },
                };
              }
              return t;
            })
          );
        });
      }
    };
    socket.on(`company-${companyId}-contact`, handleContactEvent);

    const handleSettingsEvent = (data) => {
      if (data?.action === "update" && data?.setting?.key) {
        if (["showTicketWaitTime", "hideConnectionTag", "hideAgentTag", "hideTicketTags"].includes(data.setting.key)) {
          localStorage.setItem(data.setting.key, data.setting.value);
          window.dispatchEvent(new Event("settings-update"));
        }
      }
    };
    socket.on(`company-${companyId}-settings`, handleSettingsEvent);

    return () => {
      if (status) {
        socket.emit("leaveTickets", status);
      }
      if (socketReloadTimer.current) {
        clearTimeout(socketReloadTimer.current);
      }
      socket.off(`company-${companyId}-ticket`, handleSocketEvent);
      socket.off(`company-${companyId}-appMessage`, handleSocketEvent);
      socket.off(`company-${companyId}-contact`, handleContactEvent);
      socket.off(`company-${companyId}-settings`, handleSettingsEvent);
    };
  }, [status, socketManager, showAll, searchParam]);

  // Filtrado memoizado de tickets que no son de grupo
  const nonGroupTickets = useMemo(() => {
    return ticketsList.filter(ticket => {
      const isGroupTicket = ticket.isGroup === true || ticket.isGroup === 'true';
      return !isGroupTicket;
    });
  }, [ticketsList]);

  // ACTUALIZAR CONTADOR EXCLUYENDO TICKETS DE GRUPO
  useEffect(() => {
    if (updateCount) {
      updateCount(nonGroupTickets.length);
    }
  }, [nonGroupTickets, updateCount]);

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
            nonGroupTickets.map((ticket) => <TicketListItem ticket={ticket} key={ticket.id} />)
          )}
          {loading && nonGroupTickets.length === 0 && <TicketsListSkeleton />}
        </List>
      </Paper>
    </Paper>
  );
};

export default React.memo(TicketsListCustom);