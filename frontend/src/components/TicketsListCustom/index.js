import React, { useState, useEffect, useContext } from "react";
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
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  ticketsList: {
    flex: 1,
    maxHeight: "100%",
    overflowY: "scroll",
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

  // CARGA MANUAL DE TICKETS
  const loadTickets = async (page = 1, shouldReset = true) => {
    setLoading(true);

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

      // DEBUG: Mostrar información de los tickets recibidos
      //console.log("=== DEBUG TICKETS LIST ===");
      //console.log("Status filtrado:", status);
      //console.log("Total tickets recibidos:", data.tickets?.length || 0);
      //console.log("Tickets recibidos:", data.tickets);
      
/*       if (data.tickets && data.tickets.length > 0) {
        data.tickets.forEach(ticket => {
          console.log(`Ticket ${ticket.id}:`, {
            id: ticket.id,
            contact: ticket.contact?.name,
            status: ticket.status,
            isGroup: ticket.isGroup,
            userId: ticket.userId,
            whatsappId: ticket.whatsappId,
            whatsappName: ticket.whatsapp?.name
          });
        });
      } */

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
      setLoading(false);
    }
  };

  // CARGA INICIAL Y AL CAMBIAR DEPENDENCIAS
  useEffect(() => {
    setPageNumber(1);
    loadTickets(1, true);
  }, [status, selectedQueueIds, showAll, searchParam, tags, users, dateRange]);

  // CARGA MÁS TICKETS CUANDO CAMBIA pageNumber
  useEffect(() => {
    if (pageNumber > 1) {
      loadTickets(pageNumber, false);
    }
  }, [pageNumber]);

  // LISTENERS DE SOCKET PARA ACTUALIZACIONES EN TIEMPO REAL
  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const handleSocketEvent = (data) => {
      loadTickets(1, true);
    };

    socket.on(`company-${companyId}-ticket`, handleSocketEvent);
    socket.on(`company-${companyId}-appMessage`, handleSocketEvent);

    return () => {
      socket.off(`company-${companyId}-ticket`, handleSocketEvent);
      socket.off(`company-${companyId}-appMessage`, handleSocketEvent);
    };
  }, [status, socketManager, selectedQueueIds, showAll, searchParam, tags, users, dateRange]);

  // SOLUCIÓN: ACTUALIZAR CONTADOR EXCLUYENDO TICKETS DE GRUPO
  useEffect(() => {
    if (updateCount) {
      // Filtrar tickets que NO son grupos antes de contar
      const nonGroupTickets = ticketsList.filter(ticket => {
        // Excluir tickets de grupo
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

  // DEBUG: Mostrar información del filtrado
  const nonGroupTickets = ticketsList.filter(ticket => {
    const isGroupTicket = ticket.isGroup === true || ticket.isGroup === 'true';
    const isBusinessWhatsapp = ticket.whatsapp?.type === "whatsapp_business";
    
    //console.log(`Filtrado ticket ${ticket.id}:`, {
    //  id: ticket.id,
    //  isGroup: ticket.isGroup,
    //  isGroupTicket: isGroupTicket,
    //  whatsappType: ticket.whatsapp?.type,
    //  incluido: !isGroupTicket
    //});
    
    return !isGroupTicket;
  });


  //console.log("=== RESULTADO FILTRADO ===");
  //console.log("Total tickets antes de filtrar:", ticketsList.length);
  //console.log("Total tickets después de filtrar:", nonGroupTickets.length);
  //console.log("Tickets filtrados:", nonGroupTickets.map(t => ({ id: t.id, contact: t.contact?.name })));

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
          {loading && <TicketsListSkeleton />}
        </List>
      </Paper>
    </Paper>
  );
};

export default TicketsListCustom;