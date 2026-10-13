import React, { useState, useEffect, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import Board from "react-trello";
import { toast } from "react-toastify";
import LaneTitle from "../../components/Kanban/LaneTitle";
import CardTitle from "../../components/Kanban/CardTitle";
import FooterButtons from "../../components/Kanban/FooterButtons";
import {
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
  useTheme
} from "@material-ui/core";
import { MoreVert, Archive } from "@material-ui/icons";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    padding: theme.spacing(2),
    height: "calc(100vh - 64px)",
    backgroundColor: theme.palette.background.default,
    fontFamily: "'Roboto', sans-serif",
    overflow: "hidden",
    [theme.breakpoints.down("sm")]: {
      height: "auto",
      minHeight: "100vh",
      padding: theme.spacing(1),
    },
  },
  boardContainer: {
    width: "100%",
    "& .react-trello-board": {
      backgroundColor: "transparent !important",
    },
    "& .react-trello-lane": {
      backgroundColor: theme.palette.background.paper,
      borderRadius: "8px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      margin: "0 8px",
      color: theme.palette.text.primary,
      [theme.breakpoints.down("sm")]: {
        margin: "8px 0",
        width: "100% !important",
      },
      "& header": {
        color: theme.palette.text.primary,
        "& span": {
          color: theme.palette.text.primary,
        }
      }
    },
  },
}));

const Kanban = () => {
  const theme = useTheme();
  const isDark = (theme.palette?.type || theme.mode) === "dark";
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const queueIds = user.queues?.map((q) => q.id || q.UserQueue?.queueId) || [];

  const [tags, setTags] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [laneQuantities, setLaneQuantities] = useState({});
  const [file, setFile] = useState({ lanes: [] });
  const [menuPosition, setMenuPosition] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [actionType, setActionType] = useState("");

  const fetchTags = async () => {
    try {
      const { data } = await api.get("/tags/kanban");
      setTags(data.lista || []);
    } catch (err) {
      toast.error("Error al cargar las etiquetas");
    }
  };

  const fetchTickets = async () => {
    try {
      const { data } = await api.get("/ticket/kanban", {
        params: {
          queueIds: JSON.stringify(queueIds),
          teste: true,
        },
      });
      setTickets(data.tickets);
    } catch (err) {
      toast.error("Error al cargar los tickets");
      setTickets([]);
    }
  };

  useEffect(() => {
    fetchTags();
    fetchTickets();
  }, []);

  useEffect(() => {
    const cantidades = { "0": tickets.filter(t => t.tags.length === 0).length };
    tags.forEach(tag => {
      cantidades[tag.id.toString()] = tickets.filter(t =>
        t.tags.some(tg => tg.id === tag.id)
      ).length;
    });
    setLaneQuantities(cantidades);
  }, [tags, tickets]);

  const handleMenuClick = (event, ticket) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ mouseX: event.clientX - 2, mouseY: event.clientY - 4 });
    setSelectedTicket(ticket);
  };

  const handleMenuClose = () => {
    setMenuPosition(null);
  };

  const handleActionClick = (type) => {
    setActionType(type);
    setOpenDialog(true);
    handleMenuClose();
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setSelectedTicket(null);
  };

  const confirmAction = async () => {
    try {
      if (actionType === "archive") {
        await api.delete(`/ticket-tags/${selectedTicket.id}`);
        toast.success("Ticket archivado con éxito");
      }
      fetchTags();
      fetchTickets();
    } catch (err) {
      toast.error("Error al procesar la acción");
    } finally {
      handleDialogClose();
    }
  };

  useEffect(() => {
    const lanes = [
      {
        id: "0",
        title: "Abiertos", // <- ahora es string
        style: {
          backgroundColor: isDark ? "#182229" : "#f0f2f5",
          borderTop: "4px solid #00a884",
          color: isDark ? "#e9edef" : "#111b21",
        },
        cards: tickets.filter(t => t.tags.length === 0).map(ticket => ({
          id: ticket.id.toString(),
          title: "",
          label: `#${ticket.id}`,
          draggable: true,
          href: "/tickets/" + ticket.uuid,
          customCard: (
            <div style={{
              borderRadius: 5,
              backgroundColor: isDark ? "#202c33" : "#e3f2fd",
              marginBottom: 5,
              marginTop: 5,
              padding: 10,
              boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.3)" : "none"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <CardTitle ticket={ticket} userProfile={user.profile} />
                <Tooltip title="Opciones">
                  <IconButton size="small" onClick={(e) => handleMenuClick(e, ticket)}>
                    <MoreVert fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
              <FooterButtons ticket={ticket} />
            </div>
          )
        })),
      },
      ...tags.map(tag => ({
        id: tag.id.toString(),
        title: tag.name, // <- ahora es string
        style: {
          backgroundColor: isDark ? "#182229" : `${tag.color}10`,
          borderTop: `4px solid ${tag.color}`,
          color: isDark ? "#e9edef" : "#111b21",
        },
        cards: tickets.filter(t =>
          t.tags.some(tg => tg.id === tag.id)
        ).map(ticket => ({
          id: ticket.id.toString(),
          title: "",
          label: `#${ticket.id}`,
          draggable: true,
          href: "/tickets/" + ticket.uuid,
          customCard: (
            <div style={{
              borderRadius: 5,
              backgroundColor: isDark ? "#202c33" : "#e3f2fd",
              marginBottom: 5,
              marginTop: 5,
              padding: 10,
              boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.3)" : "none"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <CardTitle ticket={ticket} userProfile={user.profile} />
                <Tooltip title="Opciones">
                  <IconButton size="small" onClick={(e) => handleMenuClick(e, ticket)}>
                    <MoreVert fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
              <FooterButtons ticket={ticket} />
            </div>
          )
        }))
      }))
    ];
    setFile({ lanes });
  }, [tags, tickets, laneQuantities, user.profile]);

  const handleCardMove = async (sourceLaneId, targetLaneId, cardId, index, card) => {
    try {
      if (sourceLaneId !== targetLaneId) {
        await api.delete(`/ticket-tags/${cardId}`);
        if (targetLaneId !== "0") {
          await api.put(`/ticket-tags/${cardId}/${targetLaneId}`);
        }
        toast.success("Ticket movido con éxito");
      }

      setFile(prev => {
        let movingCard = null;
        const newLanes = prev.lanes.map(lane => {
          if (lane.id === sourceLaneId) {
            const newCards = lane.cards.filter(c => {
              if (c.id === cardId) {
                movingCard = c;
                return false;
              }
              return true;
            });
            return { ...lane, cards: newCards };
          }
          return lane;
        }).map(lane => {
          if (lane.id === targetLaneId && movingCard) {
            const newCards = [...lane.cards];
            newCards.splice(index, 0, movingCard);
            return { ...lane, cards: newCards };
          }
          return lane;
        });
        return { lanes: newLanes };
      });
    } catch (err) {
      toast.error("Error al mover el ticket");
    }
  };

  // 🧠 Nuevo: render personalizado de headers sin romper propTypes
  const CustomLaneHeader = ({ title, id }) => {
    const quantity = laneQuantities[id] || 0;
    const tagColor = tags.find(t => t.id.toString() === id)?.color;
    return (
      <LaneTitle
        firstLane={id === "0"}
        quantity={quantity}
        squareColor={id !== "0" ? tagColor : undefined}
      >
        {title}
      </LaneTitle>
    );
  };

  return (
    <div className={classes.root}>
      <div className={classes.boardContainer}>
        <Board
          data={file}
          onCardMoveAcrossLanes={handleCardMove}
          laneStyle={{ maxHeight: "80vh", minWidth: "280px", width: "280px" }}
          hideCardDeleteIcon
          style={{ backgroundColor: "transparent", height: "100%", fontFamily: "'Roboto', sans-serif" }}
          responsive
          collapsibleLanes
          components={{
            Card: ({ customCard }) => customCard,
            LaneHeader: CustomLaneHeader // <- renderiza JSX sin romper 'title: string'
          }}
        />
      </div>

      <Menu
        open={Boolean(menuPosition)}
        onClose={handleMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          menuPosition !== null
            ? { top: menuPosition.mouseY, left: menuPosition.mouseX }
            : undefined
        }
        PaperProps={{ style: { zIndex: 1500 } }}
      >
        <MenuItem onClick={() => handleActionClick("archive")}>
          <Archive fontSize="small" style={{ marginRight: 8 }} />
          Finalizar
        </MenuItem>
      </Menu>

      <Dialog open={openDialog} onClose={handleDialogClose}>
        <DialogTitle>Desvincular Ticket</DialogTitle>
        <DialogContent>
          ¿Estás seguro de que deseas desvincular este ticket de todas las etiquetas kanban? El chat permanecerá intacto.
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary">Cancelar</Button>
          <Button onClick={confirmAction} color="secondary" variant="contained">Confirmar</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Kanban;
