import React, { useState, useEffect, useReducer, useContext } from 'react';

import { makeStyles } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import Paper from '@material-ui/core/Paper';

import TicketListItem from '../TicketListItemCustom';
import TicketsListSkeleton from '../TicketsListSkeleton';

import useTickets from '../../hooks/useTickets';
import { i18n } from '../../translate/i18n';
import { AuthContext } from '../../context/Auth/AuthContext';
import { SocketContext } from "../../context/Socket/SocketContext";

const useStyles = makeStyles((theme) => ({
  ticketsListWrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },

  ticketsList: {
    flex: 1,
    maxHeight: '100%',
    overflowY: 'scroll',
    ...theme.scrollbarStyles,
    borderTop: '2px solid rgba(0, 0, 0, 0.12)',
  },

  ticketsListHeader: {
    color: 'rgb(67, 83, 105)',
    zIndex: 2,
    backgroundColor: 'white',
    borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  ticketsCount: {
    fontWeight: 'normal',
    color: 'rgb(104, 121, 146)',
    marginLeft: '8px',
    fontSize: '14px',
  },

  noTicketsText: {
    textAlign: 'center',
    color: 'rgb(104, 121, 146)',
    fontSize: '14px',
    lineHeight: '1.4',
  },

  noTicketsTitle: {
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: '600',
    margin: '0px',
  },

  noTicketsDiv: {
    display: 'flex',
    height: '100px',
    margin: 40,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

const reducer = (state, action) => {
  if (action.type === 'LOAD_TICKETS') {
    const newTickets = action.payload;

    newTickets.forEach((ticket) => {
      const ticketIndex = state.findIndex((t) => t.id === ticket.id);
      if (ticketIndex !== -1) {
        state[ticketIndex] = ticket;
        if (ticket.unreadMessages > 0) {
          state.unshift(state.splice(ticketIndex, 1)[0]);
        }
      } else {
        state.push(ticket);
      }
    });

    return [...state];
  }

  if (action.type === 'RESET_UNREAD') {
    const ticketId = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      state[ticketIndex].unreadMessages = 0;
    }

    return [...state];
  }

  if (action.type === 'UPDATE_TICKET') {
    const ticket = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
    } else {
      state.unshift(ticket);
    }

    return [...state];
  }

  if (action.type === 'UPDATE_TICKET_UNREAD_MESSAGES') {
    const ticket = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
      state.unshift(state.splice(ticketIndex, 1)[0]);
    } else {
      state.unshift(ticket);
    }

    return [...state];
  }

  if (action.type === 'UPDATE_TICKET_CONTACT') {
    const contact = action.payload;
    const ticketIndex = state.findIndex((t) => t.contactId === contact.id);
    if (ticketIndex !== -1) {
      state[ticketIndex].contact = contact;
    }
    return [...state];
  }

  if (action.type === 'DELETE_TICKET') {
    const ticketId = action.payload;
    const ticketIndex = state.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      state.splice(ticketIndex, 1);
    }

    return [...state];
  }

  if (action.type === 'RESET') {
    return [];
  }
};

const TicketsListGroup = (props) => {
  const {
    status,
    searchParam,
    tags,
    users,
    showAll,
    selectedQueueIds,
    updateCount,
    style,
  } = props;
  const classes = useStyles();
  const [pageNumber, setPageNumber] = useState(1);
  let [ticketsList, dispatch] = useReducer(reducer, []);
  const socketManager = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const { profile, queues } = user;

  // MODIFICACIÓN CLAVE: Siempre cargar tickets sin filtrar por status para grupos
  const { tickets, hasMore, loading } = useTickets({
    pageNumber,
    searchParam,
    status: undefined, // No aplicar filtro de status
    showAll: true, // Siempre mostrar todos para grupos
    tags: JSON.stringify(tags),
    users: JSON.stringify(users),
    queueIds: JSON.stringify(selectedQueueIds),
  });

  useEffect(() => {
    dispatch({ type: 'RESET' });
    setPageNumber(1);
  }, [searchParam, dispatch, tags, users, selectedQueueIds]); // Removido status de las dependencias

  useEffect(() => {
    const filteredTickets = tickets.filter((t) => {
      // Para tickets de grupo, mostrar siempre
      if (t.isGroup === true) return true;

      // Para tickets normales, aplicar los filtros normales
      if (showAll) return true;

      const isInUserQueue = queues.map((q) => q.id).includes(t.queueId);
      return isInUserQueue;
    });

    dispatch({ type: 'LOAD_TICKETS', payload: filteredTickets });
  }, [tickets, searchParam, queues, profile, showAll]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const shouldUpdateTicket = (ticket) => {
      // Para tickets de grupo, siempre actualizar
      if (ticket.isGroup === true) return true;
      
      // Para tickets normales, aplicar la lógica normal
      return (!ticket.userId || ticket.userId === user?.id || showAll) &&
             (!ticket.queueId || selectedQueueIds.indexOf(ticket.queueId) > -1);
    };

    const notBelongsToUserQueues = (ticket) => {
      // Los tickets de grupo nunca se eliminan por filtro de colas
      if (ticket.isGroup === true) return false;
      
      return ticket.queueId && selectedQueueIds.indexOf(ticket.queueId) === -1;
    };

    socket.on("ready", () => {
      // Para grupos, unirse a todos los estados
      socket.emit("joinTickets", "group"); // o el evento que corresponda para grupos
    });

    socket.on(`company-${companyId}-ticket`, (data) => {
      if (data.action === "updateUnread") {
        dispatch({
          type: "RESET_UNREAD",
          payload: data.ticketId,
        });
      }

      // MODIFICACIÓN: Para grupos, no verificar el status
      if (data.action === "update" && shouldUpdateTicket(data.ticket)) {
        // Solo aplicar filtro de status para tickets no-grupo
        if (data.ticket.isGroup === true || data.ticket.status === status) {
          dispatch({
            type: "UPDATE_TICKET",
            payload: data.ticket,
          });
        }
      }

      if (data.action === "update" && notBelongsToUserQueues(data.ticket)) {
        dispatch({ type: "DELETE_TICKET", payload: data.ticket.id });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_TICKET", payload: data.ticketId });
      }
    });

    socket.on(`company-${companyId}-appMessage`, (data) => {
      const queueIds = queues.map((q) => q.id);
      
      // Para grupos, no aplicar filtro de colas
      if (profile === "user" && data.ticket?.isGroup !== true) {
        if (queueIds.indexOf(data.ticket?.queue?.id) === -1 || data.ticket.queue === null) {
          return;
        }
      }

      if (data.action === "create" && shouldUpdateTicket(data.ticket)) {
        // Para grupos, no verificar status
        if (data.ticket.isGroup === true || status === undefined || data.ticket.status === status) {
          dispatch({
            type: "UPDATE_TICKET_UNREAD_MESSAGES",
            payload: data.ticket,
          });
        }
      }
    });

    socket.on(`company-${companyId}-presence`, (data) => {
      dispatch({
        type: "UPDATE_TICKET_PRESENCE",
        payload: data,
      });
    });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data.action === "update") {
        dispatch({
          type: "UPDATE_TICKET_CONTACT",
          payload: data.contact,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [status, showAll, user, selectedQueueIds, tags, users, profile, queues, socketManager]);

  useEffect(() => {
    const count = ticketsList.filter((ticket) => ticket.isGroup).length;
    if (typeof updateCount === 'function') {
      updateCount(count);
    }
  }, [ticketsList, updateCount]);

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  // Filtrar SOLO tickets de grupo para mostrar
  const groupTickets = ticketsList.filter(ticket => 
    ticket.isGroup.toString() === 'true'
  );

  return (
    <Paper className={classes.ticketsListWrapper} style={style}>
      <Paper
        square
        name='closed'
        elevation={0}
        className={classes.ticketsList}
        onScroll={handleScroll}
      >
        <List style={{ paddingTop: 0 }}>
          {groupTickets.map((ticket) => (
            <TicketListItem ticket={ticket} key={ticket.id} />
          ))}
          {loading && <TicketsListSkeleton />}
        </List>
      </Paper>
    </Paper>
  );
};

export default TicketsListGroup;